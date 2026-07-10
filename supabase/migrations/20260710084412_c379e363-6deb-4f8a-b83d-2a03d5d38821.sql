
CREATE TABLE public.family_forms (
  id BIGSERIAL PRIMARY KEY,
  registry_district TEXT NOT NULL,
  registry_town TEXT NOT NULL,
  sect TEXT,
  registry_number TEXT,
  winter_country TEXT,
  winter_governorate TEXT,
  winter_district TEXT,
  winter_town TEXT,
  winter_street TEXT,
  winter_phone TEXT,
  summer_country TEXT,
  summer_governorate TEXT,
  summer_district TEXT,
  summer_town TEXT,
  summer_street TEXT,
  summer_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.individuals (
  id BIGSERIAL PRIMARY KEY,
  family_form_id BIGINT NOT NULL REFERENCES public.family_forms(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  father_name TEXT,
  mother_name TEXT,
  birth_year INTEGER,
  mobile TEXT,
  current_residence TEXT,
  marital_status TEXT,
  lives_with_family BOOLEAN DEFAULT true,
  is_military BOOLEAN DEFAULT false,
  political_leaning TEXT,
  preferred_candidate TEXT,
  voter_status TEXT,
  has_voted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_individuals_family ON public.individuals(family_form_id);
CREATE INDEX idx_individuals_names ON public.individuals(first_name, last_name);
CREATE INDEX idx_family_town ON public.family_forms(registry_town);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_forms TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.individuals TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.family_forms_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.individuals_id_seq TO anon, authenticated;
GRANT ALL ON public.family_forms TO service_role;
GRANT ALL ON public.individuals TO service_role;
GRANT ALL ON SEQUENCE public.family_forms_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.individuals_id_seq TO service_role;

ALTER TABLE public.family_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read family_forms" ON public.family_forms FOR SELECT USING (true);
CREATE POLICY "public write family_forms" ON public.family_forms FOR INSERT WITH CHECK (true);
CREATE POLICY "public update family_forms" ON public.family_forms FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete family_forms" ON public.family_forms FOR DELETE USING (true);

CREATE POLICY "public read individuals" ON public.individuals FOR SELECT USING (true);
CREATE POLICY "public write individuals" ON public.individuals FOR INSERT WITH CHECK (true);
CREATE POLICY "public update individuals" ON public.individuals FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete individuals" ON public.individuals FOR DELETE USING (true);
