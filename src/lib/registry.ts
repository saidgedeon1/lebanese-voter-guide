import { supabase } from "@/integrations/supabase/client";

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

export const RELATION_OPTIONS = ["والد", "والدة", "ابن", "ابنة", "زوج", "زوجة"] as const;
export const MARITAL_OPTIONS = ["متزوج", "أعزب", "مطلق", "أرمل"] as const;
export const POLITICAL_OPTIONS = ["مؤيد", "معارض", "رمادي", "غير مهتم"] as const;
export const VOTER_STATUS_OPTIONS = ["مقيم", "مغترب"] as const;

// @ts-ignore - table not in generated types until refresh
const sb: any = supabase;

export async function fetchStats() {
  const [{ count: individuals }, { count: families }, { count: supporters }, { count: military }, { count: voted }] =
    await Promise.all([
      sb.from("individuals").select("*", { count: "exact", head: true }),
      sb.from("family_forms").select("*", { count: "exact", head: true }),
      sb.from("individuals").select("*", { count: "exact", head: true }).eq("political_leaning", "مؤيد"),
      sb.from("individuals").select("*", { count: "exact", head: true }).eq("is_military", true),
      sb.from("individuals").select("*", { count: "exact", head: true }).eq("has_voted", true),
    ]);
  return {
    individuals: individuals ?? 0,
    families: families ?? 0,
    supporters: supporters ?? 0,
    military: military ?? 0,
    voted: voted ?? 0,
  };
}

export async function listIndividuals(filters: {
  residence?: string;
  political?: string;
  town?: string;
} = {}) {
  let q = sb
    .from("individuals")
    .select("*, family:family_forms(*)")
    .order("id", { ascending: false })
    .limit(500);
  if (filters.residence) q = q.ilike("current_residence", `%${filters.residence}%`);
  if (filters.political) q = q.eq("political_leaning", filters.political);
  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as (Individual & { family: FamilyForm })[];
  if (filters.town) rows = rows.filter((r) => r.family?.registry_town?.includes(filters.town!));
  return rows;
}

export async function searchByName(name: string) {
  if (!name.trim()) return [] as (Individual & { family: FamilyForm })[];
  const like = `%${name.trim()}%`;
  const { data, error } = await sb
    .from("individuals")
    .select("*, family:family_forms(*)")
    .or(`first_name.ilike.${like},last_name.ilike.${like},father_name.ilike.${like}`)
    .limit(50);
  if (error) throw error;
  return (data ?? []) as (Individual & { family: FamilyForm })[];
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
