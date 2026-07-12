/** Common Lebanese name spellings → Arabic forms used in the registry. */

function normalizeArabic(input: string | null | undefined) {
  return (input ?? "")
    .normalize("NFKC")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\u0640/g, "")
    .trim()
    .toLowerCase();
}

const NAME_ALIASES: Record<string, string[]> = {
  // first names
  pamela: ["باميلا"],
  elias: ["الياس", "إلياس"],
  ilyas: ["الياس", "إلياس"],
  elie: ["ايلي", "إيلي"],
  hanna: ["حنا"],
  george: ["جورج"],
  georges: ["جورج"],
  joseph: ["جوزيف", "يوسف"],
  youssef: ["يوسف"],
  yousef: ["يوسف"],
  rimonda: ["ريموندا"],
  raymonda: ["ريموندا"],
  raymond: ["ريمون"],
  stephanie: ["ستيفاني"],
  stefanie: ["ستيفاني"],
  jessica: ["جيسكا", "جسيكا"],
  rana: ["رنا"],
  elsy: ["السي"],
  elsie: ["السي"],
  christelle: ["كريستيل"],
  cristel: ["كريستيل"],
  christian: ["كريستيان"],
  dory: ["دوري"],
  dore: ["دوري"],
  karim: ["كريم"],
  jean: ["جان"],
  john: ["جون", "حنا"],
  johnny: ["جوني"],
  jony: ["جوني"],
  peter: ["بطرس"],
  boutros: ["بطرس"],
  botros: ["بطرس"],
  maroun: ["مارون"],
  anthony: ["انطوان", "انطوني"],
  antoine: ["انطوان"],
  tony: ["طوني"],
  michael: ["مايكل", "ميشال", "ميشيل"],
  michel: ["ميشال", "ميشيل"],
  nicholas: ["نقولا"],
  nicola: ["نقولا"],
  nicolas: ["نقولا"],
  abbas: ["عباس"],
  olga: ["اولغا"],
  fadia: ["فاديا"],
  josephine: ["جوزفين"],
  maya: ["مايا"],
  rita: ["ريتا"],
  reem: ["ريم"],
  rima: ["ريما"],
  nadine: ["ندين", "نادين"],
  chantal: ["شانتال"],
  giovanni: ["جيوفاني"],
  joel: ["جويل"],
  yorgho: ["يورغو"],
  yorgos: ["يورغو"],
  samir: ["سمير"],
  nabil: ["نبيل"],
  fadi: ["فادي"],
  rania: ["رانيا", "رانية"],
  marie: ["ماري"],
  mary: ["ماري"],
  "marie joe": ["ماري جو"],
  "marie jo": ["ماري جو"],
  patrick: ["باتريك"],
  paul: ["بول", "بولس"],
  pierre: ["بيار"],
  mark: ["مارك"],
  marc: ["مارك"],
  karen: ["كارين"],
  carla: ["كارلا"],
  amanda: ["اماندا"],
  natalie: ["ناتالي"],
  // surnames
  khalil: ["خليل"],
  feghali: ["الفغالي", "فغالي"],
  faghaly: ["الفغالي"],
  "el feghali": ["الفغالي"],
  elfeghali: ["الفغالي"],
  samrani: ["السمراني"],
  "el samrani": ["السمراني"],
  haddad: ["الحداد", "حداد"],
  "el haddad": ["الحداد"],
  habash: ["حبش"],
  "abu assi": ["ابو عاصي"],
  abuassi: ["ابو عاصي"],
  abouassi: ["ابو عاصي"],
  ayle: ["العيلة"],
  aile: ["العيلة"],
  "el ayle": ["العيلة"],
  khoury: ["الخوري", "خوري"],
  "el khoury": ["الخوري"],
  sawaya: ["صوايا"],
  aboud: ["عبود"],
  saliba: ["صليبا"],
  lahoud: ["لحود"],
  hassoun: ["حسون"],
  "abi aad": ["ابي عاد"],
  abiaad: ["ابي عاد"],
  madi: ["ماضي"],
  ghattas: ["غطاس"],
  kokabani: ["الكوكباني"],
  "el kokabani": ["الكوكباني"],
};

function stripLatinNoise(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasLatin(value: string) {
  return /[a-zA-Z]/.test(value);
}

function hasArabic(value: string) {
  return /[\u0600-\u06FF]/.test(value);
}

/** Map Arabic letters to a stable Latin phonetic skeleton. */
function arabicToPhonemes(value: string) {
  const map: Record<string, string> = {
    ا: "a",
    أ: "a",
    إ: "i",
    آ: "a",
    ء: "",
    ئ: "i",
    ؤ: "o",
    ب: "b",
    پ: "b",
    ت: "t",
    ث: "t",
    ج: "j",
    ح: "h",
    خ: "x",
    د: "d",
    ذ: "z",
    ر: "r",
    ز: "z",
    س: "s",
    ش: "9",
    ص: "s",
    ض: "d",
    ط: "t",
    ظ: "z",
    ع: "a",
    غ: "8",
    ف: "f",
    ق: "k",
    ك: "k",
    گ: "k",
    ل: "l",
    م: "m",
    ن: "n",
    ه: "h",
    و: "o",
    ي: "i",
    ى: "a",
    ة: "a",
  };
  let out = "";
  for (const ch of normalizeArabic(value)) {
    out += map[ch] ?? "";
  }
  return out;
}

/** Normalize English spelling quirks used for Lebanese names. */
function latinToPhonemes(value: string) {
  let s = stripLatinNoise(value);
  if (/^(al|el)\s+/.test(s)) s = s.replace(/^(al|el)\s+/, "");
  s = s.replace(/\s+/g, "");
  s = s
    .replace(/ph/g, "f")
    .replace(/kh/g, "x")
    .replace(/gh/g, "8")
    .replace(/sh/g, "9")
    .replace(/ch/g, "9")
    .replace(/th/g, "t")
    .replace(/ou|oo|ue|uw/g, "o")
    .replace(/u/g, "o")
    .replace(/ee|ie|ei|y/g, "i")
    .replace(/aa|ah/g, "a")
    .replace(/p/g, "b")
    .replace(/v/g, "f")
    .replace(/c/g, "k")
    .replace(/q/g, "k")
    .replace(/^e(?=l)/, "a"); // elias → alias
  s = s.replace(/(.)\1+/g, "$1");
  return s;
}

export function phoneticKey(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (hasArabic(raw)) return arabicToPhonemes(raw).replace(/(.)\1+/g, "$1");
  if (hasLatin(raw)) return latinToPhonemes(raw);
  return normalizeArabic(raw);
}

function lookupAliases(token: string) {
  const key = stripLatinNoise(token);
  if (!key) return [] as string[];
  const direct = NAME_ALIASES[key];
  if (direct) return direct;
  const compact = key.replace(/\s+/g, "");
  return NAME_ALIASES[compact] ?? [];
}

/** Expand a typed token into Arabic + original forms for matching. */
export function expandSearchToken(token: string) {
  const trimmed = token.trim();
  if (!trimmed) return [] as string[];
  const out = new Set<string>();
  out.add(trimmed);
  out.add(normalizeArabic(trimmed));
  for (const alias of lookupAliases(trimmed)) {
    out.add(alias);
    out.add(normalizeArabic(alias));
  }
  return [...out].filter(Boolean);
}

export function nameTokenMatches(field: string | null | undefined, queryToken: string) {
  if (!field?.trim() || !queryToken.trim()) return false;
  const fieldNorm = normalizeArabic(field);
  for (const variant of expandSearchToken(queryToken)) {
    const variantNorm = normalizeArabic(variant);
    if (!variantNorm) continue;
    if (fieldNorm.includes(variantNorm) || variantNorm.includes(fieldNorm)) return true;
  }

  const qKey = phoneticKey(queryToken);
  const fKey = phoneticKey(field);
  if (qKey.length >= 2 && fKey.length >= 2) {
    if (fKey === qKey) return true;
    if (qKey.length >= 3 && (fKey.includes(qKey) || qKey.includes(fKey))) return true;
  }
  return false;
}

export function nameFieldsMatch(
  fields: Array<string | null | undefined>,
  queryTokens: string[],
) {
  if (!queryTokens.length) return false;
  if (queryTokens.length === 1) {
    return fields.some((field) => nameTokenMatches(field, queryTokens[0]!));
  }
  // Every query token must match at least one field (order-flexible).
  return queryTokens.every((token) => fields.some((field) => nameTokenMatches(field, token)));
}

export function isMostlyLatinQuery(query: string) {
  const letters = query.replace(/[^a-zA-Z\u0600-\u06FF]/g, "");
  if (!letters) return false;
  const latin = (letters.match(/[a-zA-Z]/g) ?? []).length;
  return latin / letters.length >= 0.6;
}
