import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import {
  upsertFamilyWithIndividuals,
  type FamilyForm,
  type Individual,
  MARITAL_OPTIONS,
  POLITICAL_OPTIONS,
  RELATION_OPTIONS,
  normalizeRelation,
  normalizeVoterStatus,
  parseBirthYear,
  resolveMaritalStatus,
  resolveDeceasedForSave,
  stripDeceasedMarker,
} from "@/lib/registry";

export const EXCEL_HEADERS = [
  "مفتاح العائلة",
  "قضاء النفوس",
  "بلدة النفوس",
  "المذهب",
  "رقم السجل",
  "صلة القرابة",
  "الاسم الأول",
  "الشهرة",
  "اسم الأب",
  "اسم الأم",
  "سنة الولادة",
  "الجوال",
  "السكن الحالي",
  "الوضع العائلي",
  "وضع الناخب",
  "الميول السياسية",
  "الصوت التفضيلي",
  "السكن مع الأهل",
  "عسكري",
  "اقترع",
  "بلد الشتاء",
  "محافظة الشتاء",
  "قضاء الشتاء",
  "بلدة الشتاء",
  "شارع الشتاء",
  "هاتف الشتاء",
  "بلد الصيف",
  "محافظة الصيف",
  "قضاء الصيف",
  "بلدة الصيف",
  "شارع الصيف",
  "هاتف الصيف",
] as const;

export type ExcelImportRow = {
  rowNumber: number;
  familyKey: string;
  family: Omit<FamilyForm, "id" | "created_at">;
  individual: Omit<Individual, "id" | "family_form_id">;
  errors: string[];
};

export type ExcelImportPreview = {
  rows: ExcelImportRow[];
  families: number;
  people: number;
  errorCount: number;
};

function cell(raw: Record<string, unknown>, key: string) {
  const value = raw[key];
  if (value == null) return "";
  return String(value).trim();
}

function parseBool(value: string, fallback: boolean) {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (["نعم", "yes", "true", "1", "y"].includes(normalized)) return true;
  if (["لا", "no", "false", "0", "n"].includes(normalized)) return false;
  return fallback;
}

function pickOption(value: string, options: readonly string[], fallback: string) {
  if (!value) return fallback;
  const match = options.find((option) => option === value);
  return match ?? fallback;
}

function pickRelation(value: string, errors: string[]) {
  const raw = (value ?? "").trim();
  if (!raw) {
    errors.push("صلة القرابة مطلوبة");
    return "ابن";
  }
  const normalized = normalizeRelation(raw);
  if ((RELATION_OPTIONS as readonly string[]).includes(normalized)) return normalized;
  errors.push(`صلة القرابة غير معروفة: ${raw}`);
  return normalized || raw;
}

function familyKeyFrom(raw: Record<string, unknown>, lastName: string) {
  const explicit = cell(raw, "مفتاح العائلة");
  if (explicit) return explicit;

  return [cell(raw, "قضاء النفوس"), cell(raw, "بلدة النفوس"), cell(raw, "رقم السجل"), lastName]
    .filter(Boolean)
    .join(" | ");
}

export function downloadImportTemplate() {
  const sample = [
    EXCEL_HEADERS,
    [
      "حداد-1",
      "الشوف",
      "بريح",
      "ماروني",
      "12",
      "رب العائلة",
      "جورج",
      "حداد",
      "إلياس",
      "ماري خوري",
      "1970",
      "03123456",
      "جونيه - الصفرا",
      "متزوج",
      "مقيم",
      "القوات اللبنانية",
      "",
      "نعم",
      "لا",
      "لا",
      "لبنان",
      "جبل لبنان",
      "كسروان",
      "الصفرا",
      "",
      "",
      "لبنان",
      "جبل لبنان",
      "الشوف",
      "بريح",
      "",
      "",
    ],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(sample);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "استمارة");
  XLSX.writeFile(book, "نموذج-استيراد-عائلات.xlsx");
}

function yn(value: boolean | null | undefined) {
  return value ? "نعم" : "لا";
}

async function fetchAllFamiliesWithMembers() {
  const pageSize = 500;
  let from = 0;
  const all: Array<FamilyForm & { individuals?: Individual[] | null }> = [];
  while (true) {
    const { data, error } = await supabase
      .from("family_forms")
      .select("*, individuals(*)")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as Array<FamilyForm & { individuals?: Individual[] | null }>;
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/** Full backup Excel (same columns as import) + JSON with IDs for restore safety. */
export async function downloadFullBackup() {
  const families = await fetchAllFamiliesWithMembers();
  const excelRows: (string | number)[][] = [[...EXCEL_HEADERS]];
  let peopleCount = 0;

  for (const fam of families) {
    const members = [...(fam.individuals ?? [])].sort((a, b) => a.id - b.id);
    const familyKey = `F-${fam.id}`;
    if (members.length === 0) {
      excelRows.push([
        familyKey,
        fam.registry_district || "",
        fam.registry_town || "",
        fam.sect || "",
        fam.registry_number || "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        fam.winter_country || "",
        fam.winter_governorate || "",
        fam.winter_district || "",
        fam.winter_town || "",
        fam.winter_street || "",
        fam.winter_phone || "",
        fam.summer_country || "",
        fam.summer_governorate || "",
        fam.summer_district || "",
        fam.summer_town || "",
        fam.summer_street || "",
        fam.summer_phone || "",
      ]);
      continue;
    }

    for (const m of members) {
      peopleCount += 1;
      excelRows.push([
        familyKey,
        fam.registry_district || "",
        fam.registry_town || "",
        fam.sect || "",
        fam.registry_number || "",
        m.relation || "",
        m.first_name || "",
        m.last_name || "",
        m.father_name || "",
        m.mother_name || "",
        m.birth_year?.toString() || "",
        m.mobile || "",
        m.current_residence || "",
        m.marital_status || "",
        m.voter_status || "",
        m.political_leaning || "",
        m.preferred_candidate || "",
        yn(m.lives_with_family),
        yn(m.is_military),
        yn(m.has_voted),
        fam.winter_country || "",
        fam.winter_governorate || "",
        fam.winter_district || "",
        fam.winter_town || "",
        fam.winter_street || "",
        fam.winter_phone || "",
        fam.summer_country || "",
        fam.summer_governorate || "",
        fam.summer_district || "",
        fam.summer_town || "",
        fam.summer_street || "",
        fam.summer_phone || "",
      ]);
    }
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(excelRows);
  XLSX.utils.book_append_sheet(book, sheet, "استمارة");
  const meta = XLSX.utils.aoa_to_sheet([
    ["تاريخ النسخة", new Date().toISOString()],
    ["عدد العائلات", families.length],
    ["عدد الأفراد", peopleCount],
    ["ملاحظة", "يمكن إعادة استيراد ورقة استمارة من صفحة الاستيراد"],
  ]);
  XLSX.utils.book_append_sheet(book, meta, "ملخص");
  XLSX.writeFile(book, `backup-الماكينة-الانتخابية-${stamp}.xlsx`);

  // JSON with IDs for a full structural backup
  const payload = {
    exported_at: new Date().toISOString(),
    families_count: families.length,
    people_count: peopleCount,
    families: families.map((fam) => ({
      ...fam,
      individuals: [...(fam.individuals ?? [])].sort((a, b) => a.id - b.id),
    })),
  };
  const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(jsonBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-الماكينة-الانتخابية-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);

  return { families: families.length, people: peopleCount };
}

export async function parseExcelFile(file: File): Promise<ExcelImportPreview> {
  const buffer = await file.arrayBuffer();
  const book = XLSX.read(buffer, { type: "array" });
  const sheetName = book.SheetNames[0];
  if (!sheetName) throw new Error("الملف لا يحتوي على ورقة.");
  const sheet = book.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const rows: ExcelImportRow[] = json.map((raw, index) => {
    const errors: string[] = [];
    const firstName = cell(raw, "الاسم الأول");
    const lastName = cell(raw, "الشهرة");
    const district = cell(raw, "قضاء النفوس");
    const town = cell(raw, "بلدة النفوس");
    const relation = pickRelation(cell(raw, "صلة القرابة"), errors);

    if (!firstName) errors.push("الاسم الأول مطلوب");
    if (!lastName) errors.push("الشهرة مطلوبة");
    if (!district) errors.push("قضاء النفوس مطلوب");
    if (!town) errors.push("بلدة النفوس مطلوبة");

    const familyKey = familyKeyFrom(raw, lastName) || `صف-${index + 2}`;
    const rawMarital = cell(raw, "الوضع العائلي");
    const marital = resolveMaritalStatus(relation, rawMarital);
    if (rawMarital && !(MARITAL_OPTIONS as readonly string[]).includes(marital as (typeof MARITAL_OPTIONS)[number])) {
      errors.push(`الوضع العائلي غير معروف: ${rawMarital}`);
    }

    const deceased = resolveDeceasedForSave({
      voter_status: normalizeVoterStatus(cell(raw, "وضع الناخب")),
      preferred_candidate: cell(raw, "الصوت التفضيلي"),
      promoteLegacyMarker: true,
    });

    return {
      rowNumber: index + 2,
      familyKey,
      family: {
        registry_district: district,
        registry_town: town,
        sect: cell(raw, "المذهب") || null,
        registry_number: cell(raw, "رقم السجل") || null,
        winter_country: cell(raw, "بلد الشتاء") || "لبنان",
        winter_governorate: cell(raw, "محافظة الشتاء") || null,
        winter_district: cell(raw, "قضاء الشتاء") || null,
        winter_town: cell(raw, "بلدة الشتاء") || null,
        winter_street: cell(raw, "شارع الشتاء") || null,
        winter_phone: cell(raw, "هاتف الشتاء") || null,
        summer_country: cell(raw, "بلد الصيف") || "لبنان",
        summer_governorate: cell(raw, "محافظة الصيف") || null,
        summer_district: cell(raw, "قضاء الصيف") || null,
        summer_town: cell(raw, "بلدة الصيف") || null,
        summer_street: cell(raw, "شارع الصيف") || null,
        summer_phone: cell(raw, "هاتف الصيف") || null,
      },
      individual: {
        relation,
        first_name: firstName,
        last_name: lastName,
        father_name: cell(raw, "اسم الأب") || null,
        mother_name: cell(raw, "اسم الأم") || null,
        birth_year: parseBirthYear(cell(raw, "سنة الولادة")),
        mobile: cell(raw, "الجوال") || null,
        current_residence: cell(raw, "السكن الحالي") || null,
        marital_status: marital,
        lives_with_family: parseBool(cell(raw, "السكن مع الأهل"), true),
        is_military: parseBool(cell(raw, "عسكري"), false),
        political_leaning: pickOption(cell(raw, "الميول السياسية"), POLITICAL_OPTIONS, "مستقل"),
        preferred_candidate: deceased.preferred_candidate,
        voter_status: deceased.voter_status,
        has_voted: parseBool(cell(raw, "اقترع"), false),
      },
      errors,
    };
  });

  const familyKeys = new Set(rows.map((row) => row.familyKey));

  return {
    rows,
    families: familyKeys.size,
    people: rows.length,
    errorCount: rows.filter((row) => row.errors.length > 0).length,
  };
}

export async function importExcelRows(rows: ExcelImportRow[]) {
  const valid = rows.filter((row) => row.errors.length === 0);
  if (valid.length === 0) {
    throw new Error("لا توجد صفوف صالحة للاستيراد.");
  }

  const grouped = new Map<string, ExcelImportRow[]>();
  for (const row of valid) {
    const list = grouped.get(row.familyKey) ?? [];
    list.push(row);
    grouped.set(row.familyKey, list);
  }

  let importedFamilies = 0;
  let updatedFamilies = 0;
  let importedPeople = 0;
  let updatedPeople = 0;
  let addedPeople = 0;

  for (const familyRows of grouped.values()) {
    const family = familyRows[0]!.family;
    const individuals = familyRows.map((row) => {
      const deceased = resolveDeceasedForSave({
        voter_status: row.individual.voter_status,
        preferred_candidate: row.individual.preferred_candidate,
        promoteLegacyMarker: true,
      });
      return {
        ...row.individual,
        preferred_candidate: deceased.preferred_candidate ?? stripDeceasedMarker(row.individual.preferred_candidate),
        voter_status: deceased.voter_status,
      };
    });
    const matchLastName =
      individuals.find((i) => i.last_name)?.last_name ||
      familyRows[0]!.individual.last_name ||
      "";

    const result = await upsertFamilyWithIndividuals(family, individuals, matchLastName);
    if (result.created) {
      importedFamilies += 1;
      importedPeople += individuals.length;
    } else {
      updatedFamilies += 1;
      updatedPeople += result.updatedPeople;
      addedPeople += result.addedPeople;
    }
  }

  return {
    importedFamilies,
    importedPeople,
    updatedFamilies,
    updatedPeople,
    addedPeople,
  };
}
