/**
 * Recompute relations for every family form using parentage rules:
 * - زوجة = mother of head's children
 * - كنة = son's wife (not under الأبناء)
 * - صهر = daughter's husband
 */
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync("C:/Users/saidg/Projects/lebanese-voter-guide/.env", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[line.slice(0, i).trim()] = v;
  }
  return env;
}

const FEMALE_NAMES = new Set(
  [
    "نجلا", "جوسلين", "نورما", "هالا", "جنى", "منى", "نغم", "ريم", "فيكتوريا", "جوزفين", "نجوى", "ندى", "ريما", "ريتا",
    "نوال", "الين", "باميلا", "اموره", "كريستيل", "رولا", "رين", "ندين", "ماري جو", "ماري", "زهرة", "وردة", "ملكة",
    "اغنس", "نعيمة", "روز", "روزه", "زلفا", "تراز", "مهى", "نمره", "سميرة", "مريم", "ايفات", "نظيرة", "رانيه", "سوزان",
    "كاتيا", "نانسي", "لينا", "كارلا", "ديانا", "ايفا", "ميرا", "سابين", "جاكلين", "فدوى", "هند", "سلمى", "عبير",
    "رندة", "غادة", "وفاء", "سمر", "رند", "تالا", "يارا", "لاما", "سيليا", "ايما", "ايلا", "ماريا", "اليسا", "رنا",
    "ستيفاني", "جيسكا", "السي", "شانتال", "فاديا", "اولغا", "سهام", "مايا", "كريستيل", "ريموندا", "لميا", "روزات",
  ].map((n) => n.trim()),
);

function isFemaleName(name) {
  const n = (name || "").trim();
  if (!n) return false;
  if (FEMALE_NAMES.has(n)) return true;
  if (/ة$/.test(n) || /ى$/.test(n)) return true;
  return FEMALE_NAMES.has(n.split(/\s+/)[0] || "");
}

function shareParents(a, b) {
  return Boolean(
    a.father_name &&
      b.father_name &&
      a.father_name === b.father_name &&
      a.mother_name &&
      b.mother_name &&
      a.mother_name === b.mother_name,
  );
}

function assignRelations(people) {
  if (people.length === 1) {
    people[0].relation = "رب العائلة";
    return people;
  }

  const asFather = new Map();
  for (const p of people) {
    if (p.father_name) asFather.set(p.father_name, (asFather.get(p.father_name) || 0) + 1);
  }

  let head =
    people
      .map((p) => ({ p, score: asFather.get(p.first_name) || 0 }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.p || null;

  if (!head) head = people[0];

  const directChildren = people.filter((p) => p !== head && p.father_name === head.first_name);
  const childNames = new Set(directChildren.map((c) => c.first_name));
  const headWifeNames = new Set(directChildren.map((c) => c.mother_name).filter(Boolean));

  if (!headWifeNames.size) {
    const fallback = people.find(
      (p) =>
        p !== head &&
        !shareParents(p, head) &&
        p.last_name &&
        head.last_name &&
        p.last_name !== head.last_name &&
        !(asFather.get(p.first_name) > 0),
    );
    if (fallback) headWifeNames.add(fallback.first_name);
  }

  for (const p of people) {
    if (p === head) {
      p.relation = "رب العائلة";
      continue;
    }
    if (p.first_name === head.mother_name) {
      p.relation = "والدة";
      continue;
    }
    if (p.first_name === head.father_name) {
      p.relation = "والد";
      continue;
    }
    if (p.father_name === head.first_name) {
      p.relation = isFemaleName(p.first_name) ? "ابنة" : "ابن";
      continue;
    }
    if (headWifeNames.has(p.first_name) && directChildren.some((c) => c.mother_name === p.first_name)) {
      p.relation = "زوجة";
      continue;
    }
    if (headWifeNames.has(p.first_name) && p.father_name !== head.first_name) {
      p.relation = "زوجة";
      continue;
    }

    const isDaughterInLaw = people.some(
      (kid) =>
        kid.mother_name === p.first_name &&
        kid.father_name &&
        childNames.has(kid.father_name) &&
        kid.father_name !== head.first_name,
    );
    if (isDaughterInLaw) {
      p.relation = "كنة";
      continue;
    }

    const isSonInLaw = people.some(
      (kid) =>
        kid.father_name === p.first_name &&
        kid.mother_name &&
        childNames.has(kid.mother_name) &&
        kid.mother_name !== head.first_name,
    );
    if (isSonInLaw) {
      p.relation = "صهر";
      continue;
    }

    if (
      isFemaleName(p.first_name) &&
      p.father_name !== head.first_name &&
      !headWifeNames.has(p.first_name) &&
      p.last_name &&
      head.last_name &&
      p.last_name !== head.last_name &&
      !shareParents(p, head)
    ) {
      p.relation = "كنة";
      continue;
    }

    if (shareParents(p, head)) {
      p.relation = isFemaleName(p.first_name) ? "ابنة" : "ابن";
      continue;
    }

    p.relation = isFemaleName(p.first_name) ? "ابنة" : "ابن";
  }

  return people;
}

const env = loadEnv();
const sb = createClient(env.VITE_SUPABASE_URL || env.SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY);

const { data: all, error } = await sb
  .from("individuals")
  .select("id,first_name,last_name,father_name,mother_name,relation,family_form_id")
  .limit(5000);
if (error) throw error;

const byForm = new Map();
for (const row of all) {
  const list = byForm.get(row.family_form_id) ?? [];
  list.push({ ...row });
  byForm.set(row.family_form_id, list);
}

let updated = 0;
const changes = [];
for (const [, members] of byForm) {
  const before = members.map((m) => `${m.id}:${m.relation}`);
  assignRelations(members);
  for (const m of members) {
    const prev = all.find((x) => x.id === m.id)?.relation;
    if (prev !== m.relation) {
      const { error: e2 } = await sb.from("individuals").update({ relation: m.relation }).eq("id", m.id);
      if (e2) throw e2;
      updated += 1;
      if (changes.length < 30) changes.push({ id: m.id, name: m.first_name, from: prev, to: m.relation });
    }
  }
  void before;
}

const counts = {};
const { data: after } = await sb.from("individuals").select("relation").limit(5000);
for (const r of after || []) counts[r.relation] = (counts[r.relation] || 0) + 1;

console.log(JSON.stringify({ forms: byForm.size, updated, counts, changes }, null, 2));
