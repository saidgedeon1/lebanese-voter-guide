import { supabase } from "@/integrations/supabase/client";
import { nameFieldsMatch, nameTokenMatches, scoreNameSearch } from "@/lib/name-search";

export type FamilyForm = {
  id: number;
  registry_district: string;
  registry_town: string;
  sect: string | null;
  registry_number: string | null;
  winter_country: string | null;
  winter_governorate: string | null;
  winter_district: string | null;
  winter_town: string | null;
  winter_street: string | null;
  winter_phone: string | null;
  summer_country: string | null;
  summer_governorate: string | null;
  summer_district: string | null;
  summer_town: string | null;
  summer_street: string | null;
  summer_phone: string | null;
  created_at: string;
};

export type Individual = {
  id: number;
  family_form_id: number;
  relation: string;
  first_name: string;
  last_name: string;
  father_name: string | null;
  mother_name: string | null;
  birth_year: number | null;
  mobile: string | null;
  current_residence: string | null;
  marital_status: string | null;
  lives_with_family: boolean | null;
  is_military: boolean | null;
  political_leaning: string | null;
  preferred_candidate: string | null;
  voter_status: string | null;
  has_voted: boolean | null;
};

export type FamilySummary = FamilyForm & {
  members: Individual[];
  family_name: string;
  member_count: number;
  eligible_voters: number;
  male_count: number;
  female_count: number;
  supporter_count: number;
  military_count: number;
  age_average: number | null;
  age_min: number | null;
  age_max: number | null;
  age_0_20: number;
  age_21_39: number;
  age_40_59: number;
  age_60_plus: number;
};

export const RELATION_OPTIONS = [
  "رب العائلة",
  "والد",
  "والدة",
  "ابن",
  "ابنة",
  "زوج",
  "زوجة",
  "كنة",
  "صهر",
] as const;
export const MARITAL_OPTIONS = ["متزوج", "أعزب", "مطلق", "أرمل"] as const;
export const POLITICAL_OPTIONS = ["مؤيد", "معارض", "رمادي", "غير مهتم"] as const;
export const VOTER_STATUS_OPTIONS = ["مقيم", "مغترب"] as const;

/** Normalize Arabic letters so search matches أ/إ/آ and ة/ه variants. */
export function normalizeArabic(input: string | null | undefined) {
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

/** Normalize common Lebanese spellings so spouses/parents still show in family views. */
export function normalizeRelation(relation: string | null | undefined) {
  const value = (relation ?? "").trim();
  const map: Record<string, string> = {
    "رب العائلة": "رب العائلة",
    "رب الاسرة": "رب العائلة",
    "رب الأسرة": "رب العائلة",
    "والد": "والد",
    "الاب": "والد",
    "الأب": "والد",
    "والدة": "والدة",
    "الام": "والدة",
    "الأم": "والدة",
    "ابن": "ابن",
    "ولد": "ابن",
    "ابنة": "ابنة",
    "بنت": "ابنة",
    "زوج": "زوج",
    "زوجة": "زوجة",
    "كنة": "كنة",
    "صهر": "صهر",
    "مرات": "زوجة",
    "مارة": "زوجة",
    "مرته": "زوجة",
    "مراته": "زوجة",
    "زوجه": "زوجة",
  };
  return map[value] ?? value;
}

const MARRIED_RELATIONS = new Set(["رب العائلة", "زوج", "زوجة", "كنة", "صهر"]);

function isMarriedStatus(status: string | null | undefined) {
  const value = (status ?? "").trim();
  return value === "متزوج" || value === "متزوجة";
}

/** Find spouse within the same form: by relation, co-parentage, then household head. */
export function findSpouse(person: Individual, members: Individual[]): Individual | null {
  if (!person || !members?.length) return null;
  const self = normalizeRelation(person.relation);

  const coParent = members.find((member) => {
    if (member.id === person.id) return false;
    return members.some(
      (child) =>
        child.id !== person.id &&
        child.id !== member.id &&
        ((child.father_name === person.first_name && child.mother_name === member.first_name) ||
          (child.mother_name === person.first_name && child.father_name === member.first_name)),
    );
  });
  if (coParent) return coParent;

  const byRelation = members.find((member) => {
    if (member.id === person.id) return false;
    const relation = normalizeRelation(member.relation);
    if (self === "زوج" || self === "رب العائلة" || self === "والد") {
      return relation === "زوجة";
    }
    if (self === "زوجة" || self === "والدة") {
      return relation === "زوج" || relation === "رب العائلة" || relation === "والد";
    }
    if (self === "كنة") {
      return relation === "صهر" || relation === "زوج";
    }
    if (self === "صهر") {
      return relation === "كنة" || relation === "زوجة";
    }
    return false;
  });
  if (byRelation) return byRelation;

  // كنة ↔ ابن متزوج when grandchildren are not listed on the form
  if (self === "كنة") {
    const sons = members.filter((m) => m.id !== person.id && normalizeRelation(m.relation) === "ابن");
    const marriedSons = sons.filter((m) => isMarriedStatus(m.marital_status));
    if (marriedSons.length === 1) return marriedSons[0];
    if (sons.length === 1) return sons[0];
  }

  if (self === "ابن" && isMarriedStatus(person.marital_status)) {
    const daughtersInLaw = members.filter(
      (m) => m.id !== person.id && normalizeRelation(m.relation) === "كنة",
    );
    if (daughtersInLaw.length === 1) return daughtersInLaw[0];
  }

  if (self === "زوجة" || self === "والدة") {
    const head = members.find((member) => {
      if (member.id === person.id) return false;
      const relation = normalizeRelation(member.relation);
      return relation === "رب العائلة" || relation === "زوج" || relation === "والد";
    });
    if (head) return head;
  }

  return null;
}

/** Show marital status consistently; married relations never appear as single. */
export function displayMaritalStatus(person: Individual, spouse?: Individual | null) {
  const self = normalizeRelation(person.relation);
  const female = FEMALE_RELATIONS.has(self);
  let status = (person.marital_status ?? "").trim();

  if (spouse || MARRIED_RELATIONS.has(self)) {
    if (!status || status === "أعزب" || status === "عزباء") status = "متزوج";
  }
  if (!status) return "—";

  if (female) {
    const map: Record<string, string> = {
      متزوج: "متزوجة",
      أعزب: "عزباء",
      مطلق: "مطلقة",
      أرمل: "أرملة",
    };
    return map[status] ?? status;
  }

  const map: Record<string, string> = {
    متزوجة: "متزوج",
    عزباء: "أعزب",
    مطلقة: "مطلق",
    أرملة: "أرمل",
  };
  return map[status] ?? status;
}

// @ts-ignore - table not in generated types until refresh
const sb: any = supabase;

const FEMALE_RELATIONS = new Set(["والدة", "ابنة", "زوجة", "كنة"]);
const MALE_RELATIONS = new Set(["رب العائلة", "والد", "ابن", "زوج", "صهر"]);

function getCurrentYear() {
  return new Date().getFullYear();
}

function getAge(birthYear: number | null) {
  if (!birthYear) return null;
  const age = getCurrentYear() - birthYear;
  if (age < 0 || age > 120) return null;
  return age;
}

function inferGender(relation: string) {
  const normalized = normalizeRelation(relation);
  if (FEMALE_RELATIONS.has(normalized)) return "female";
  if (MALE_RELATIONS.has(normalized)) return "male";
  return "unknown";
}

function getFamilyName(members: Individual[], registryTown: string) {
  const prioritized = ["رب العائلة", "والد", "زوج", "ابن", "والدة", "زوجة", "ابنة"];
  const anchor =
    prioritized
      .map((relation) =>
        members.find((member) => normalizeRelation(member.relation) === relation && member.last_name),
      )
      .find(Boolean) ?? members.find((member) => member.last_name);

  if (anchor?.last_name) {
    return `عائلة ${anchor.last_name}`;
  }

  return `عائلة ${registryTown}`;
}

function toFamilySummary(family: FamilyForm & { individuals?: Individual[] | null }): FamilySummary {
  const members = (family.individuals ?? []).slice().sort((a, b) => a.id - b.id);
  const ages = members
    .map((member) => getAge(member.birth_year))
    .filter((age): age is number => age !== null);

  return {
    ...family,
    members,
    family_name: getFamilyName(members, family.registry_town),
    member_count: members.length,
    eligible_voters: members.filter((member) => !member.is_military && (getAge(member.birth_year) ?? 999) >= 21).length,
    male_count: members.filter((member) => inferGender(member.relation) === "male").length,
    female_count: members.filter((member) => inferGender(member.relation) === "female").length,
    supporter_count: members.filter((member) => member.political_leaning === "مؤيد").length,
    military_count: members.filter((member) => member.is_military).length,
    age_average: ages.length ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : null,
    age_min: ages.length ? Math.min(...ages) : null,
    age_max: ages.length ? Math.max(...ages) : null,
    age_0_20: ages.filter((age) => age <= 20).length,
    age_21_39: ages.filter((age) => age >= 21 && age <= 39).length,
    age_40_59: ages.filter((age) => age >= 40 && age <= 59).length,
    age_60_plus: ages.filter((age) => age >= 60).length,
  };
}

export async function fetchStats() {
  const [
    { count: individuals },
    { count: families },
    { count: supporters },
    { count: military },
    { count: voted },
    { count: deceased },
  ] = await Promise.all([
    sb.from("individuals").select("*", { count: "exact", head: true }),
    sb.from("family_forms").select("*", { count: "exact", head: true }),
    sb.from("individuals").select("*", { count: "exact", head: true }).eq("political_leaning", "مؤيد"),
    sb.from("individuals").select("*", { count: "exact", head: true }).eq("is_military", true),
    sb.from("individuals").select("*", { count: "exact", head: true }).eq("has_voted", true),
    sb.from("individuals").select("*", { count: "exact", head: true }).ilike("preferred_candidate", "%متوف%"),
  ]);

  const totalPeople = individuals ?? 0;
  const deceasedCount = deceased ?? 0;

  return {
    individuals: totalPeople,
    families: families ?? 0,
    supporters: supporters ?? 0,
    military: military ?? 0,
    voted: voted ?? 0,
    deceased: deceasedCount,
    living: Math.max(0, totalPeople - deceasedCount),
  };
}

export async function listIndividuals(filters: {
  residence?: string;
  political?: string;
  town?: string;
  search?: string;
} = {}) {
  let q = sb
    .from("individuals")
    .select("*, family:family_forms(*)")
    .order("family_form_id", { ascending: false })
    .order("id", { ascending: true })
    .limit(5000);
  if (filters.residence) q = q.ilike("current_residence", `%${filters.residence}%`);
  if (filters.political) q = q.eq("political_leaning", filters.political);
  const { data, error } = await q;
  if (error) throw error;

  let rows = (data ?? []) as Array<
    Individual & {
      family: FamilyForm;
      spouse_name?: string | null;
    }
  >;

  if (filters.town) {
    rows = rows.filter((r) => r.family?.registry_town?.includes(filters.town!));
  }

  if (filters.search?.trim()) {
    const tokens = filters.search.trim().split(/\s+/).filter(Boolean);
    rows = rows.filter((r) => {
      const fields = [r.first_name, r.father_name, r.last_name, r.mother_name];
      if (tokens.length >= 3) {
        const [a, b, c] = tokens;
        if (nameTokenMatches(r.first_name, a!) && nameTokenMatches(r.father_name, b!) && nameTokenMatches(r.last_name, c!)) {
          return true;
        }
      }
      if (tokens.length === 2) {
        const [a, b] = tokens;
        if (
          nameTokenMatches(r.first_name, a!) &&
          (nameTokenMatches(r.last_name, b!) || nameTokenMatches(r.father_name, b!))
        ) {
          return true;
        }
        if (nameTokenMatches(r.last_name, `${a} ${b}`)) return true;
      }
      if (nameFieldsMatch(fields, [filters.search!.trim()])) return true;
      return nameFieldsMatch(fields, tokens);
    });
  }

  const byFamily = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = byFamily.get(row.family_form_id) ?? [];
    list.push(row);
    byFamily.set(row.family_form_id, list);
  }

  return rows.map((row) => {
    const relatives = byFamily.get(row.family_form_id) ?? [];
    const spouse = findSpouse(row, relatives);

    return {
      ...row,
      relation: normalizeRelation(row.relation) || row.relation,
      spouse_name: spouse
        ? [spouse.first_name, spouse.father_name, spouse.last_name].filter(Boolean).join(" ").trim()
        : null,
    };
  });
}

export async function searchByName(name: string) {
  const raw = name.trim();
  if (!raw) return [] as (Individual & { family: FamilyForm })[];
  const tokens = raw.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  const { data, error } = await sb
    .from("individuals")
    .select("*, family:family_forms(*)")
    .order("id", { ascending: false })
    .limit(5000);
  if (error) throw error;

  return ((data ?? []) as (Individual & { family: FamilyForm })[])
    .filter((row) => {
      const fields = [row.first_name, row.father_name, row.last_name, row.mother_name];

      // الاسم الثلاثي: الاسم + اسم الأب + الشهرة
      if (tokens.length >= 3) {
        const [a, b, c] = tokens;
        if (
          nameTokenMatches(row.first_name, a!) &&
          nameTokenMatches(row.father_name, b!) &&
          nameTokenMatches(row.last_name, c!)
        ) {
          return true;
        }
      }

      // اسم + شهرة أو اسم + أب
      if (tokens.length === 2) {
        const [a, b] = tokens;
        if (
          nameTokenMatches(row.first_name, a!) &&
          (nameTokenMatches(row.last_name, b!) || nameTokenMatches(row.father_name, b!))
        ) {
          return true;
        }
        // compound English surname: "abu assi", "el feghali"
        if (nameTokenMatches(row.first_name, a!) && nameTokenMatches(row.last_name, `${a} ${b}`)) {
          return true;
        }
        if (nameTokenMatches(row.last_name, `${a} ${b}`) || nameTokenMatches(row.first_name, `${a} ${b}`)) {
          return true;
        }
      }

      // Full query as one alias (e.g. "el feghali")
      if (nameFieldsMatch(fields, [raw])) return true;

      // Every token matches some name field (Arabic or English)
      if (nameFieldsMatch(fields, tokens)) return true;

      // Also match registry town / number for Arabic queries
      const needle = normalizeArabic(raw);
      const blob = normalizeArabic(
        [row.relation, row.family?.registry_town ?? "", row.family?.registry_number ?? ""].join(" "),
      );
      return Boolean(needle) && blob.includes(needle);
    })
    .sort((a, b) => {
      const scoreDiff = scoreNameSearch(b, tokens, raw) - scoreNameSearch(a, tokens, raw);
      if (scoreDiff !== 0) return scoreDiff;
      return a.first_name.localeCompare(b.first_name, "ar");
    })
    .slice(0, 150);
}

export async function getFamilyMembers(family_form_id: number) {
  const { data, error } = await sb
    .from("individuals")
    .select("*")
    .eq("family_form_id", family_form_id)
    .order("id");
  if (error) throw error;
  return (data ?? []) as Individual[];
}

export async function listFamilySummaries(filters: {
  search?: string;
  district?: string;
  town?: string;
  political?: string;
} = {}) {
  let q = sb
    .from("family_forms")
    .select("*, individuals(*)")
    .order("id", { ascending: false })
    .limit(500);

  if (filters.district) q = q.ilike("registry_district", `%${filters.district}%`);
  if (filters.town) q = q.ilike("registry_town", `%${filters.town}%`);

  const { data, error } = await q;
  if (error) throw error;

  const search = normalizeArabic(filters.search);

  return ((data ?? []) as Array<FamilyForm & { individuals?: Individual[] | null }>)
    .map(toFamilySummary)
    .filter((family) => {
      if (filters.political && !family.members.some((member) => member.political_leaning === filters.political)) {
        return false;
      }

      if (!search) return true;

      const haystacks = [
        family.family_name,
        family.registry_town,
        family.registry_district,
        family.registry_number ?? "",
        family.winter_phone ?? "",
        family.summer_phone ?? "",
        ...family.members.flatMap((member) => [
          member.first_name,
          member.last_name,
          member.father_name ?? "",
          member.mother_name ?? "",
          member.mobile ?? "",
          member.current_residence ?? "",
        ]),
      ];

      return haystacks.some((value) => normalizeArabic(value).includes(search));
    });
}

export async function createFamilyWithIndividuals(
  family: Omit<FamilyForm, "id" | "created_at">,
  individuals: Array<Omit<Individual, "id" | "family_form_id">>,
) {
  const { data: fam, error: e1 } = await sb.from("family_forms").insert(family).select().single();
  if (e1) throw e1;
  if (individuals.length > 0) {
    const rows = individuals.map((i) => ({ ...i, family_form_id: fam.id }));
    const { error: e2 } = await sb.from("individuals").insert(rows);
    if (e2) throw e2;
  }
  return fam as FamilyForm;
}

export async function getFamilyById(id: number) {
  const { data, error } = await sb
    .from("family_forms")
    .select("*, individuals(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return toFamilySummary(data as FamilyForm & { individuals?: Individual[] | null });
}

export async function updateFamilyForm(
  id: number,
  family: Omit<FamilyForm, "id" | "created_at">,
) {
  const { data, error } = await sb.from("family_forms").update(family).eq("id", id).select().single();
  if (error) throw error;
  return data as FamilyForm;
}

export async function deleteFamilyForm(id: number) {
  const { error } = await sb.from("family_forms").delete().eq("id", id);
  if (error) throw error;
}

export async function updateIndividual(
  id: number,
  individual: Omit<Individual, "id" | "family_form_id"> & { family_form_id?: number },
) {
  const { data, error } = await sb.from("individuals").update(individual).eq("id", id).select().single();
  if (error) throw error;
  return data as Individual;
}

export async function deleteIndividual(id: number) {
  const { error } = await sb.from("individuals").delete().eq("id", id);
  if (error) throw error;
}

export async function addIndividualToFamily(
  family_form_id: number,
  individual: Omit<Individual, "id" | "family_form_id">,
) {
  const { data, error } = await sb
    .from("individuals")
    .insert({ ...individual, family_form_id })
    .select()
    .single();
  if (error) throw error;
  return data as Individual;
}
