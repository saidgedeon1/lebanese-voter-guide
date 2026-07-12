/**
 * Enrich wife/in-law maiden surnames from the Brih 2026 electoral roll Excel.
 * Match: first name + father name + registry number → official الشهرة.
 */
import fs from "fs";
import path from "path";
import XLSX from "xlsx";
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

function norm(s) {
  return String(s || "")
    .normalize("NFKC")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function softName(s) {
  return norm(s).replace(/[اه]$/g, "");
}

function namesMatch(a, b) {
  const x = softName(a);
  const y = softName(b);
  if (!x || !y) return false;
  return x === y || x.startsWith(y) || y.startsWith(x);
}

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.xlsx?$/i.test(e.name)) acc.push(p);
  }
  return acc;
}

const TMP = "C:/Users/saidg/Projects/lebanese-voter-guide/.tmp-brih";
const rollFile = walk(TMP).find((f) => f.includes("2026") || f.includes("(1).xlsx"));
if (!rollFile) throw new Error("Election roll Excel not found");

const rows = XLSX.utils.sheet_to_json(XLSX.readFile(rollFile).Sheets[XLSX.readFile(rollFile).SheetNames[0]], {
  header: 1,
  defval: null,
});

// header row index 1 in that file
const roll = [];
for (const r of rows.slice(2)) {
  if (!Array.isArray(r) || !r[0]) continue;
  roll.push({
    first: String(r[0]).trim(),
    last: String(r[1] || "").trim(),
    father: String(r[2] || "").trim(),
    mother: String(r[3] || "").trim(),
    registry: String(r[7] || "").trim(),
  });
}
console.log("roll rows", roll.length);

const env = loadEnv();
const sb = createClient(env.VITE_SUPABASE_URL || env.SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY);

const { data: people, error } = await sb
  .from("individuals")
  .select("id,first_name,last_name,father_name,mother_name,relation,family_form_id, family:family_forms(registry_number,id)")
  .in("relation", ["زوجة", "كنة", "ابنة", "ابن"])
  .limit(5000);
if (error) throw error;

// Also load heads for comparison
const { data: heads } = await sb.from("individuals").select("family_form_id,last_name").eq("relation", "رب العائلة");
const headLast = Object.fromEntries((heads || []).map((h) => [h.family_form_id, h.last_name]));

let updated = 0;
const samples = [];

for (const person of people || []) {
  const reg = String(person.family?.registry_number || "").trim();
  if (!reg) continue;
  const nFirst = norm(person.first_name);
  const nFather = norm(person.father_name);
  const matches = roll.filter(
    (r) =>
      String(r.registry) === reg &&
      namesMatch(r.first, person.first_name) &&
      (!person.father_name || namesMatch(r.father, person.father_name)),
  );
  if (!matches.length) continue;
  const best = matches[0];
  if (!best.last) continue;

  const husbandLast = headLast[person.family_form_id];

  // Prefer official roll شهرة for wives/in-laws when current equals husband's or unknown
  const isWifeLike = person.relation === "زوجة" || person.relation === "كنة";
  if (
    isWifeLike &&
    best.last &&
    best.last !== person.last_name &&
    (person.last_name === husbandLast || person.last_name === "غير محدد" || !person.last_name)
  ) {
    const { error: e2 } = await sb.from("individuals").update({ last_name: best.last }).eq("id", person.id);
    if (e2) throw e2;
    updated += 1;
    if (samples.length < 20) {
      samples.push({
        id: person.id,
        name: person.first_name,
        from: person.last_name,
        to: best.last,
        relation: person.relation,
        reg,
      });
    }
  }
}

// Specific fixes from notes in household sheets
const { data: pamela } = await sb
  .from("individuals")
  .select("id,first_name,last_name,relation,father_name")
  .eq("first_name", "باميلا")
  .eq("father_name", "جورزيف");
for (const p of pamela || []) {
  await sb.from("individuals").update({ relation: "كنة", last_name: "الفغالي" }).eq("id", p.id);
  updated += 1;
  samples.push({ id: p.id, name: p.first_name, from: p.last_name, to: "الفغالي", relation: "كنة" });
}

console.log(JSON.stringify({ updated, samples }, null, 2));

// verify rimonda
const { data: rimonda } = await sb
  .from("individuals")
  .select("id,first_name,last_name,relation,father_name")
  .eq("first_name", "ريموندا")
  .eq("father_name", "فارس");
console.log("rimonda", rimonda);
