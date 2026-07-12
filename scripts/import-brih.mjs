import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve("C:/Users/saidg/Projects/lebanese-voter-guide");
const TMP = path.join(ROOT, ".tmp-brih");
const YEAR = new Date().getFullYear();
const YEAR2 = YEAR % 100;

const FEMALE_NAMES = new Set(
  [
    "نجلا",
    "جوسلين",
    "نورما",
    "هالا",
    "جنى",
    "منى",
    "نغم",
    "ريم",
    "فيكتوريا",
    "جوزفين",
    "نجوى",
    "ندى",
    "ريما",
    "ريتا",
    "نوال",
    "الين",
    "باميلا",
    "اموره",
    "كريستيل",
    "رولا",
    "رين",
    "ندين",
    "ماري جو",
    "ماري",
    "زهرة",
    "وردة",
    "ملكة",
    "اغنس",
    "نعيمة",
    "روز",
    "روزه",
    "زلفا",
    "تراز",
    "مهى",
    "نمره",
    "سميرة",
    "مريم",
    "ايفات",
    "نظيرة",
    "رانيه",
    "سوزان",
    "كاتيا",
    "نانسي",
    "لينا",
    "كارلا",
    "ديانا",
    "ايفا",
    "كلود",
    "ميرا",
    "سابين",
    "جاكلين",
    "فدوى",
    "هند",
    "سلمى",
    "عبير",
    "رندة",
    "غادة",
    "وفاء",
    "سمر",
    "رند",
    "تالا",
    "يارا",
    "لاما",
    "سيليا",
    "ايما",
    "ايلا",
    "نويا",
    "ماريا",
    "اليسا",
    "ايليا",
  ].map((n) => n.trim()),
);

function loadEnv() {
  const text = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function findBrihRoot(dir) {
  const kids = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory());
  if (kids.length === 1) return path.join(dir, kids[0].name);
  return dir;
}

function isFemaleName(name) {
  const n = (name || "").trim();
  if (!n) return false;
  if (FEMALE_NAMES.has(n)) return true;
  // common Arabic feminine endings, but avoid short male names
  if (/ة$/.test(n) || /ى$/.test(n)) return true;
  if (n.includes("ماري") || n.includes("آن") || n.endsWith("ا") && n.length >= 4) {
    // trailing ا is weak signal; only if known pattern
    if (["حنا", "عيسى", "موسى", "زكريا"].includes(n)) return false;
  }
  return FEMALE_NAMES.has(n.split(/\s+/)[0] || "");
}

function parseAgeOrYear(raw) {
  if (raw == null || raw === "") return { birth_year: null, deceased: false };
  const s = String(raw).trim();
  if (!s) return { birth_year: null, deceased: false };
  if (s.includes("متوف")) return { birth_year: null, deceased: true };

  const dateMatch = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dateMatch) return { birth_year: Number(dateMatch[3]), deceased: false };

  if (typeof raw === "number" && raw > 20000 && XLSX.SSF?.parse_date_code) {
    const excelDate = XLSX.SSF.parse_date_code(raw);
    if (excelDate?.y) return { birth_year: excelDate.y, deceased: false };
  }

  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) return { birth_year: null, deceased: false };

  // Full birth year
  if (n >= 1900 && n <= YEAR) return { birth_year: n, deceased: false };

  // Two-digit birth year (84 => 1984, 01 => 2001)
  if (n >= 0 && n <= 99) {
    const full = n <= YEAR2 ? 2000 + n : 1900 + n;
    return { birth_year: full, deceased: false };
  }

  return { birth_year: null, deceased: false };
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

  // Direct children of head (list him as father)
  const directChildren = people.filter((p) => p !== head && p.father_name === head.first_name);
  const childNames = new Set(directChildren.map((c) => c.first_name));

  // Head's wife = mother of his direct children
  const headWifeNames = new Set(
    directChildren.map((c) => c.mother_name).filter(Boolean),
  );

  // Fallback wife: different surname, not a child
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

    // Parents of head living in household
    if (p.first_name === head.mother_name) {
      p.relation = "والدة";
      continue;
    }
    if (p.first_name === head.father_name) {
      p.relation = "والد";
      continue;
    }

    // Direct child of head
    if (p.father_name === head.first_name) {
      p.relation = isFemaleName(p.first_name) ? "ابنة" : "ابن";
      continue;
    }

    // Head's wife: mother of his children
    if (
      headWifeNames.has(p.first_name) &&
      directChildren.some((c) => c.mother_name === p.first_name)
    ) {
      p.relation = "زوجة";
      continue;
    }
    if (headWifeNames.has(p.first_name) && !childNames.has(p.first_name)) {
      // fallback wife without shared kids yet
      const isChildOfHead = p.father_name === head.first_name;
      if (!isChildOfHead) {
        p.relation = "زوجة";
        continue;
      }
    }

    // Daughter-in-law (كنة): mother of kids whose father is a child of head
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

    // Son-in-law (صهر): father of kids whose mother is a child of head
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

    // Also detect in-law without grandchildren: married surname pattern /
    // person whose spouse is a child (co-listed) — soft: female not child of head with different family
    if (
      isFemaleName(p.first_name) &&
      p.father_name !== head.first_name &&
      !headWifeNames.has(p.first_name) &&
      p.last_name &&
      head.last_name &&
      p.last_name !== head.last_name &&
      !shareParents(p, head)
    ) {
      // Likely daughter-in-law living with family (maiden surname kept)
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

function parseWorkbook(filePath, registryNumber, folderName = "") {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  if (!rows.length) return null;

  const header = (rows[0] || []).map((c) => (c == null ? "" : String(c).trim()));

  if (header.includes("الشهرة") && header.includes("الجنس")) return null;
  if (header.every((h) => !h) && rows.length > 1) {
    const h2 = (rows[1] || []).map((c) => (c == null ? "" : String(c).trim()));
    if (h2.includes("الشهرة") && h2.includes("الجنس")) return null;
  }

  let colFamily = header.findIndex((h) => h === "العائلة" || h === "الشهرة");
  let colMother = header.findIndex((h) => h === "الام" || h === "الأم" || h.startsWith("الام"));
  let colFather = header.findIndex((h) => h === "الاب" || h === "الأب");
  let colName = header.findIndex((h) => h === "الاسم");
  const colAge = 6;

  if (colFamily < 0) colFamily = 7;
  if (colMother < 0) colMother = 8;
  if (colFather < 0) colFather = 10;
  if (colName < 0) colName = 12;

  // Folder names are often "الاسم الأب الشهرة" — use last token when Excel has no surname.
  const folderLast = String(folderName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .at(-1);

  const people = [];
  for (const row of rows.slice(1)) {
    if (!Array.isArray(row)) continue;
    const first = row[colName] == null ? "" : String(row[colName]).trim();
    if (!first) continue;
    const last = row[colFamily] == null ? "" : String(row[colFamily]).trim();
    const father = row[colFather] == null ? "" : String(row[colFather]).trim();
    const mother = row[colMother] == null ? "" : String(row[colMother]).trim();
    const parsed = parseAgeOrYear(row[colAge]);
    people.push({
      first_name: first,
      last_name: last,
      father_name: father || null,
      mother_name: mother || null,
      birth_year: parsed.birth_year,
      deceased: parsed.deceased,
      relation: "",
    });
  }

  if (!people.length) return null;

  const familyLast =
    people.find((p) => p.last_name && people.filter((x) => x.last_name === p.last_name).length)?.last_name ||
    people.find((p) => p.last_name)?.last_name ||
    folderLast ||
    "غير محدد";

  // Prefer the head-family surname for blank last names (not the wife's maiden name)
  const citedFather = people.map((p) => p.father_name).filter(Boolean);
  const probableHead = people.find((p) => citedFather.includes(p.first_name));
  const defaultLast = probableHead?.last_name || familyLast;

  for (const p of people) {
    if (!p.last_name) p.last_name = defaultLast;
  }

  assignRelations(people);

  // Wife should keep maiden last name from source; children/head keep family surname
  const individuals = people.map((p) => ({
    relation: p.relation,
    first_name: p.first_name,
    last_name: p.last_name,
    father_name: p.father_name,
    mother_name: p.mother_name,
    birth_year: p.birth_year,
    mobile: null,
    current_residence: null,
    marital_status: p.relation === "رب العائلة" || p.relation === "زوجة" || p.relation === "زوج" || p.relation === "كنة" || p.relation === "صهر" ? "متزوج" : "أعزب",
    lives_with_family: true,
    is_military: false,
    political_leaning: "غير مهتم",
    preferred_candidate: p.deceased ? "متوفي" : null,
    voter_status: "مقيم",
    has_voted: false,
  }));

  return {
    family: {
      registry_district: "الشوف",
      registry_town: "بريح",
      sect: null,
      registry_number: String(registryNumber),
      winter_country: "لبنان",
      winter_governorate: "جبل لبنان",
      winter_district: "الشوف",
      winter_town: "بريح",
      winter_street: null,
      winter_phone: null,
      summer_country: "لبنان",
      summer_governorate: "جبل لبنان",
      summer_district: "الشوف",
      summer_town: "بريح",
      summer_street: null,
      summer_phone: null,
    },
    individuals,
    source: filePath,
  };
}

function collectForms() {
  const brih = findBrihRoot(TMP);
  const registries = fs
    .readdirSync(brih, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d+$/.test(d.name))
    .map((d) => d.name)
    .sort((a, b) => Number(a) - Number(b));

  const forms = [];
  const skipped = [];

  for (const reg of registries) {
    const regDir = path.join(brih, reg);
    const personDirs = fs.readdirSync(regDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const pd of personDirs) {
      const pdir = path.join(regDir, pd.name);
      const files = fs.readdirSync(pdir).filter((n) => /\.xlsx?$/i.test(n));
      for (const file of files) {
        const full = path.join(pdir, file);
        try {
          const parsed = parseWorkbook(full, reg, pd.name);
          if (!parsed) {
            skipped.push({ full, reason: "empty-or-wrong-format" });
            continue;
          }
          forms.push(parsed);
        } catch (e) {
          skipped.push({ full, reason: e.message });
        }
      }
    }
  }

  return { forms, skipped, registries: registries.length };
}

async function deletePreviousBrihImport(sb) {
  // Replace all prior Brih/Chouf imports (this village bulk load).
  const { data: families, error } = await sb
    .from("family_forms")
    .select("id")
    .eq("registry_town", "بريح")
    .eq("registry_district", "الشوف");

  if (error) throw error;
  const ids = (families || []).map((f) => f.id);
  if (!ids.length) return { deletedFamilies: 0 };

  const { error: eInd } = await sb.from("individuals").delete().in("family_form_id", ids);
  if (eInd) throw eInd;
  const { error: eFam } = await sb.from("family_forms").delete().in("id", ids);
  if (eFam) throw eFam;

  return { deletedFamilies: ids.length };
}

async function main() {
  const dry = process.argv.includes("--dry");
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials in .env");

  const { forms, skipped, registries } = collectForms();
  const people = forms.reduce((s, f) => s + f.individuals.length, 0);
  const relationCounts = {};
  for (const f of forms) {
    for (const i of f.individuals) {
      relationCounts[i.relation] = (relationCounts[i.relation] || 0) + 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        registries,
        forms: forms.length,
        people,
        skipped: skipped.length,
        relationCounts,
        dry,
        sample: forms.slice(0, 5).map((f) => ({
          reg: f.family.registry_number,
          people: f.individuals.map((i) => ({
            n: i.first_name,
            l: i.last_name,
            r: i.relation,
            y: i.birth_year,
            father: i.father_name,
            mother: i.mother_name,
            d: i.preferred_candidate,
          })),
        })),
      },
      null,
      2,
    ),
  );

  if (dry) return;

  const sb = createClient(url, key);
  const deleted = await deletePreviousBrihImport(sb);
  console.log(JSON.stringify({ deleted }));

  let importedFamilies = 0;
  let importedPeople = 0;
  const errors = [];

  for (const form of forms) {
    const { data: fam, error: e1 } = await sb.from("family_forms").insert(form.family).select().single();
    if (e1) {
      errors.push({ source: form.source, stage: "family", message: e1.message });
      continue;
    }
    const rows = form.individuals.map((i) => ({ ...i, family_form_id: fam.id }));
    const { error: e2 } = await sb.from("individuals").insert(rows);
    if (e2) {
      errors.push({ source: form.source, stage: "individuals", message: e2.message, familyId: fam.id });
      continue;
    }
    importedFamilies += 1;
    importedPeople += rows.length;
  }

  console.log(
    JSON.stringify(
      {
        importedFamilies,
        importedPeople,
        errorCount: errors.length,
        errors: errors.slice(0, 10),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
