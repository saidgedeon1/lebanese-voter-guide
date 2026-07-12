import * as XLSX from "xlsx";
import {
  createFamilyWithIndividuals,
  type FamilyForm,
  type Individual,
  MARITAL_OPTIONS,
  POLITICAL_OPTIONS,
  RELATION_OPTIONS,
  VOTER_STATUS_OPTIONS,
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

function parseBool(value: string, fallback = false) {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (["نعم", "yes", "true", "1", "y"].includes(normalized)) return true;
  if (["لا", "no", "false", "0", "n"].includes(normalized)) return false;
  return fallback;
}

function parseBirthYear(value: string) {
  if (!value) return null;
  const year = Number.parseInt(value, 10);
  if (!Number.isFinite(year) || year < 1900 || year > new Date().getFullYear()) return null;
  return year;
}

function pickOption(value: string, options: readonly string[], fallback: string) {
  if (!value) return fallback;
  const match = options.find((option) => option === value);
  return match ?? fallback;
}

function familyKeyFrom(raw: Record<string, unknown>, lastName: string) {
  const explicit = cell(raw, "مفتاح العائلة");
  if (explicit) return explicit;

  return [
    cell(raw, "قضاء النفوس"),
    cell(raw, "بلدة النفوس"),
    cell(raw, "رقم السجل"),
    lastName,
  ]
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
      "مؤيد",
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
    [
      "حداد-1",
      "الشوف",
      "بريح",
      "ماروني",
      "12",
      "زوجة",
      "نانسي",
      "حداد",
      "ميشال",
      "روز أبي نادر",
      "1975",
      "03111111",
      "جونيه - الصفرا",
      "متزوج",
      "مقيم",
      "مؤيد",
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
  XLSX.utils.book_append_sheet(book, sheet, "استيراد");
  XLSX.writeFile(book, "قالب-استيراد-الناخبين.xlsx");
}

export async function parseExcelFile(file: File): Promise<ExcelImportPreview> {
  const buffer = await file.arrayBuffer();
  const book = XLSX.read(buffer, { type: "array" });
  const sheetName = book.SheetNames[0];
  if (!sheetName) {
    throw new Error("ملف الإكسل فارغ.");
  }

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
    const relation = pickOption(cell(raw, "صلة القرابة"), RELATION_OPTIONS, "رب العائلة");

    if (!firstName) errors.push("الاسم الأول مطلوب");
    if (!lastName) errors.push("الشهرة مطلوبة");
    if (!district) errors.push("قضاء النفوس مطلوب");
    if (!town) errors.push("بلدة النفوس مطلوبة");

    const familyKey = familyKeyFrom(raw, lastName) || `صف-${index + 2}`;

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
        marital_status: pickOption(cell(raw, "الوضع العائلي"), MARITAL_OPTIONS, "أعزب"),
        lives_with_family: parseBool(cell(raw, "السكن مع الأهل"), true),
        is_military: parseBool(cell(raw, "عسكري"), false),
        political_leaning: pickOption(cell(raw, "الميول السياسية"), POLITICAL_OPTIONS, "غير مهتم"),
        preferred_candidate: cell(raw, "الصوت التفضيلي") || null,
        voter_status: pickOption(cell(raw, "وضع الناخب"), VOTER_STATUS_OPTIONS, "مقيم"),
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
  let importedPeople = 0;

  for (const familyRows of grouped.values()) {
    const family = familyRows[0]!.family;
    const individuals = familyRows.map((row) => row.individual);
    await createFamilyWithIndividuals(family, individuals);
    importedFamilies += 1;
    importedPeople += individuals.length;
  }

  return { importedFamilies, importedPeople };
}
