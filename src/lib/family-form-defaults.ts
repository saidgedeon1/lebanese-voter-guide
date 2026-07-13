import { normalizeRelation } from "@/lib/registry";

/** Person-shaped fields used while drafting a family form. */
export type FormPerson = {
  relation: string;
  first_name: string;
  last_name: string;
  father_name: string;
  mother_name: string;
  marital_status: string;
};

const MARRIED_RELATIONS = new Set(["رب العائلة", "زوج", "زوجة", "كنة", "صهر"]);
const KEEP_OWN_SURNAME = new Set(["زوجة", "كنة", "صهر"]);
const CHILD_RELATIONS = new Set(["ابن", "ابنة"]);

export const QUICK_ADD_RELATIONS = [
  { relation: "زوجة", label: "+ زوجة" },
  { relation: "زوج", label: "+ زوج" },
  { relation: "كنة", label: "+ كنة" },
  { relation: "صهر", label: "+ صهر" },
  { relation: "والدة", label: "+ والدة" },
  { relation: "والد", label: "+ والد" },
  { relation: "ابن", label: "+ ابن" },
  { relation: "ابنة", label: "+ ابنة" },
] as const;

export function isMarriedRelation(relation: string | null | undefined) {
  return MARRIED_RELATIONS.has(normalizeRelation(relation));
}

export function defaultMaritalForRelation(relation: string | null | undefined) {
  return isMarriedRelation(relation) ? "متزوج" : "أعزب";
}

export function findHeadPerson<T extends FormPerson>(people: T[]): T | undefined {
  return (
    people.find((p) => {
      const r = normalizeRelation(p.relation);
      return r === "رب العائلة" || r === "والد" || r === "زوج";
    }) || people[0]
  );
}

export function findWifePerson<T extends FormPerson>(people: T[]): T | undefined {
  return people.find((p) => {
    const r = normalizeRelation(p.relation);
    return r === "زوجة" || r === "والدة";
  });
}

/**
 * Prefill rules for a new member (or when relation changes):
 * - زوجة / كنة / صهر: متزوج، ويحتفظون بشهرتهم (ما منعبّي شهرة العائلة)
 * - ابن / ابنة: شهرة العائلة + اسم الأب (رب العائلة) + اسم الأم (الزوجة)
 * - باقي الأقارب المتزوجين: وضع عائلي متزوج
 */
export function defaultsForRelation(
  relationInput: string,
  household: FormPerson[],
  familyLastName = "",
): Partial<FormPerson> {
  const relation = normalizeRelation(relationInput) || relationInput;
  const head = findHeadPerson(household);
  const wife = findWifePerson(household);
  const householdLast =
    familyLastName.trim() ||
    head?.last_name?.trim() ||
    household.find((p) => p.last_name.trim())?.last_name.trim() ||
    "";

  const patch: Partial<FormPerson> = {
    relation,
    marital_status: defaultMaritalForRelation(relation),
  };

  if (KEEP_OWN_SURNAME.has(relation)) {
    // Wife / daughter-in-law / son-in-law keep their own family name.
    patch.last_name = "";
  } else if (householdLast) {
    patch.last_name = householdLast;
  }

  if (CHILD_RELATIONS.has(relation)) {
    if (head?.first_name?.trim()) patch.father_name = head.first_name.trim();
    if (wife?.first_name?.trim()) patch.mother_name = wife.first_name.trim();
  } else {
    // Spouses / in-laws: don't inherit the household father's name.
    if (KEEP_OWN_SURNAME.has(relation) || relation === "زوج") {
      patch.father_name = "";
      patch.mother_name = "";
    }
  }

  return patch;
}

/** When the user changes صلة القرابة, normalize + fill empty fields only. */
export function patchOnRelationChange<T extends FormPerson>(
  current: T,
  nextRelation: string,
  household: FormPerson[],
  familyLastName = "",
): Partial<T> {
  const defaults = defaultsForRelation(nextRelation, household, familyLastName);
  const patch: Partial<T> = {
    relation: defaults.relation,
    marital_status: defaults.marital_status,
  } as Partial<T>;

  const rel = normalizeRelation(defaults.relation);

  if (!current.last_name.trim() && defaults.last_name) {
    (patch as FormPerson).last_name = defaults.last_name;
  }
  if (KEEP_OWN_SURNAME.has(rel) && current.last_name.trim() === familyLastName.trim()) {
    // Clear accidental household surname on wife/in-law so they can enter maiden name.
    (patch as FormPerson).last_name = "";
  }

  if (!current.father_name.trim() && defaults.father_name) {
    (patch as FormPerson).father_name = defaults.father_name;
  }
  if (!current.mother_name.trim() && defaults.mother_name) {
    (patch as FormPerson).mother_name = defaults.mother_name;
  }

  return patch;
}

export function relationFieldHint(relation: string | null | undefined) {
  const rel = normalizeRelation(relation);
  if (rel === "زوجة" || rel === "كنة") {
    return "الشهرة = عائلتها قبل الزواج (مش شهرة الزوج)";
  }
  if (rel === "صهر") {
    return "الشهرة = عائلته هو";
  }
  if (rel === "ابن" || rel === "ابنة") {
    return "اسم الأب والأم بيت عبّوا تلقائي من رب العائلة والزوجة";
  }
  return null;
}

export function tripleName(person: Pick<FormPerson, "first_name" | "father_name" | "last_name">) {
  return [person.first_name, person.father_name, person.last_name].filter((p) => p?.trim()).join(" ").trim();
}
