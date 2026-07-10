import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  RELATION_OPTIONS,
  MARITAL_OPTIONS,
  POLITICAL_OPTIONS,
  VOTER_STATUS_OPTIONS,
  createFamilyWithIndividuals,
} from "@/lib/registry";

export const Route = createFileRoute("/families/new")({
  component: NewFamily,
});

type IndividualDraft = {
  relation: string;
  first_name: string;
  last_name: string;
  father_name: string;
  mother_name: string;
  birth_year: string;
  mobile: string;
  current_residence: string;
  marital_status: string;
  lives_with_family: boolean;
  is_military: boolean;
  political_leaning: string;
  preferred_candidate: string;
  voter_status: string;
  has_voted: boolean;
};

const emptyIndividual = (relation = "ابن"): IndividualDraft => ({
  relation,
  first_name: "",
  last_name: "",
  father_name: "",
  mother_name: "",
  birth_year: "",
  mobile: "",
  current_residence: "",
  marital_status: "أعزب",
  lives_with_family: true,
  is_military: false,
  political_leaning: "غير مهتم",
  preferred_candidate: "",
  voter_status: "مقيم",
  has_voted: false,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-ar">{label}</label>
      {children}
    </div>
  );
}

function NewFamily() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [family, setFamily] = useState({
    registry_district: "",
    registry_town: "",
    sect: "",
    registry_number: "",
    winter_country: "لبنان",
    winter_governorate: "",
    winter_district: "",
    winter_town: "",
    winter_street: "",
    winter_phone: "",
    summer_country: "لبنان",
    summer_governorate: "",
    summer_district: "",
    summer_town: "",
    summer_street: "",
    summer_phone: "",
  });
  const [individuals, setIndividuals] = useState<IndividualDraft[]>([
    emptyIndividual("والد"),
    emptyIndividual("والدة"),
  ]);

  const mutation = useMutation({
    mutationFn: async () => {
      const cleaned = individuals
        .filter((i) => i.first_name.trim() && i.last_name.trim())
        .map((i) => ({
          ...i,
          birth_year: i.birth_year ? parseInt(i.birth_year, 10) : null,
        })) as any;
      return createFamilyWithIndividuals(family as any, cleaned);
    },
    onSuccess: () => navigate({ to: "/individuals" }),
  });

  const updateInd = (idx: number, patch: Partial<IndividualDraft>) => {
    setIndividuals((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black">استمارة عائلية جديدة</h1>
          <p className="text-sm text-muted-foreground mt-1">أدخل بيانات السجل والسكن، ثم أضف أفراد العائلة.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`chip ${step === 1 ? "!bg-primary !text-primary-foreground" : ""}`}>١ · بيانات السجل</span>
          <span className="text-muted-foreground">←</span>
          <span className={`chip ${step === 2 ? "!bg-primary !text-primary-foreground" : ""}`}>٢ · الأفراد</span>
        </div>
      </div>

      {step === 1 && (
        <div className="card-elev p-5 sm:p-8 space-y-8">
          <section>
            <h2 className="font-bold text-lg mb-4">بيانات السجل</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="قضاء النفوس"><input className="field" value={family.registry_district} onChange={(e) => setFamily({ ...family, registry_district: e.target.value })} placeholder="مثال: الشوف" /></Field>
              <Field label="بلدة النفوس"><input className="field" value={family.registry_town} onChange={(e) => setFamily({ ...family, registry_town: e.target.value })} placeholder="مثال: بريح" /></Field>
              <Field label="المذهب"><input className="field" value={family.sect} onChange={(e) => setFamily({ ...family, sect: e.target.value })} placeholder="مثال: ماروني" /></Field>
              <Field label="رقم السجل"><input className="field" value={family.registry_number} onChange={(e) => setFamily({ ...family, registry_number: e.target.value })} placeholder="مثال: 12" /></Field>
            </div>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-4">مكان السكن شتاءً</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="البلد"><input className="field" value={family.winter_country} onChange={(e) => setFamily({ ...family, winter_country: e.target.value })} /></Field>
              <Field label="المحافظة"><input className="field" value={family.winter_governorate} onChange={(e) => setFamily({ ...family, winter_governorate: e.target.value })} placeholder="جبل لبنان" /></Field>
              <Field label="القضاء"><input className="field" value={family.winter_district} onChange={(e) => setFamily({ ...family, winter_district: e.target.value })} placeholder="كسروان" /></Field>
              <Field label="البلدة/المدينة"><input className="field" value={family.winter_town} onChange={(e) => setFamily({ ...family, winter_town: e.target.value })} placeholder="الصفرا" /></Field>
              <Field label="الشارع"><input className="field" value={family.winter_street} onChange={(e) => setFamily({ ...family, winter_street: e.target.value })} /></Field>
              <Field label="الهاتف الثابت"><input className="field" value={family.winter_phone} onChange={(e) => setFamily({ ...family, winter_phone: e.target.value })} /></Field>
            </div>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-4">مكان السكن صيفاً</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="البلد"><input className="field" value={family.summer_country} onChange={(e) => setFamily({ ...family, summer_country: e.target.value })} /></Field>
              <Field label="المحافظة"><input className="field" value={family.summer_governorate} onChange={(e) => setFamily({ ...family, summer_governorate: e.target.value })} /></Field>
              <Field label="القضاء"><input className="field" value={family.summer_district} onChange={(e) => setFamily({ ...family, summer_district: e.target.value })} /></Field>
              <Field label="البلدة/المدينة"><input className="field" value={family.summer_town} onChange={(e) => setFamily({ ...family, summer_town: e.target.value })} /></Field>
              <Field label="الشارع"><input className="field" value={family.summer_street} onChange={(e) => setFamily({ ...family, summer_street: e.target.value })} /></Field>
              <Field label="الهاتف الثابت"><input className="field" value={family.summer_phone} onChange={(e) => setFamily({ ...family, summer_phone: e.target.value })} /></Field>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              className="btn-primary"
              disabled={!family.registry_district || !family.registry_town}
              onClick={() => setStep(2)}
            >
              التالي — إضافة الأفراد ←
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {individuals.map((ind, idx) => (
            <div key={idx} className="card-elev p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4 gap-2">
                <div className="flex items-center gap-2">
                  <span className="chip">فرد #{idx + 1}</span>
                  {ind.is_military && (
                    <span className="chip !bg-destructive !text-destructive-foreground">
                      عسكري — لا يحق له الاقتراع
                    </span>
                  )}
                </div>
                <button
                  className="text-destructive text-sm font-semibold hover:underline"
                  onClick={() => setIndividuals((p) => p.filter((_, i) => i !== idx))}
                >
                  حذف
                </button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="صلة القرابة">
                  <select className="field" value={ind.relation} onChange={(e) => updateInd(idx, { relation: e.target.value })}>
                    {RELATION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="الاسم الأول"><input className="field" value={ind.first_name} onChange={(e) => updateInd(idx, { first_name: e.target.value })} /></Field>
                <Field label="الشهرة / اسم العائلة"><input className="field" value={ind.last_name} onChange={(e) => updateInd(idx, { last_name: e.target.value })} /></Field>
                <Field label="اسم الأب"><input className="field" value={ind.father_name} onChange={(e) => updateInd(idx, { father_name: e.target.value })} /></Field>
                <Field label="اسم الأم والشهرة قبل الزواج"><input className="field" value={ind.mother_name} onChange={(e) => updateInd(idx, { mother_name: e.target.value })} /></Field>
                <Field label="التولد (سنة الولادة)"><input className="field" inputMode="numeric" value={ind.birth_year} onChange={(e) => updateInd(idx, { birth_year: e.target.value })} /></Field>
                <Field label="رقم الجوال"><input className="field" value={ind.mobile} onChange={(e) => updateInd(idx, { mobile: e.target.value })} /></Field>
                <Field label="الوضع العائلي">
                  <select className="field" value={ind.marital_status} onChange={(e) => updateInd(idx, { marital_status: e.target.value })}>
                    {MARITAL_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="وضع الناخب">
                  <select className="field" value={ind.voter_status} onChange={(e) => updateInd(idx, { voter_status: e.target.value })}>
                    {VOTER_STATUS_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                <div className="lg:col-span-3">
                  <Field label="السكن الفعلي الحالي بالتفصيل">
                    <input className="field" value={ind.current_residence} onChange={(e) => updateInd(idx, { current_residence: e.target.value })} placeholder="بيت مري - حي الكنيسة - مشروع" />
                  </Field>
                </div>
                <Field label="الميول السياسية">
                  <select className="field" value={ind.political_leaning} onChange={(e) => updateInd(idx, { political_leaning: e.target.value })}>
                    {POLITICAL_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="لمن الصوت التفضيلي">
                  <input className="field" value={ind.preferred_candidate} onChange={(e) => updateInd(idx, { preferred_candidate: e.target.value })} placeholder="اسم المرشح" />
                </Field>
                <div className="grid grid-cols-3 gap-3 sm:col-span-2 lg:col-span-3">
                  <Toggle label="السكن مع الأهل" value={ind.lives_with_family} onChange={(v) => updateInd(idx, { lives_with_family: v })} />
                  <Toggle label="عسكري" value={ind.is_military} onChange={(v) => updateInd(idx, { is_military: v })} danger />
                  <Toggle label="اقترع يوم الانتخاب" value={ind.has_voted} onChange={(v) => updateInd(idx, { has_voted: v })} />
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2 justify-between">
            <button className="btn-ghost" onClick={() => setIndividuals((p) => [...p, emptyIndividual()])}>
              + إضافة فرد
            </button>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setStep(1)}>→ العودة</button>
              <button
                className="btn-primary"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? "جاري الحفظ..." : "حفظ الاستمارة"}
              </button>
            </div>
          </div>
          {mutation.error && (
            <div className="card-elev p-4 text-destructive text-sm">
              حدث خطأ أثناء الحفظ: {(mutation.error as Error).message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Toggle({ label, value, onChange, danger }: { label: string; value: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition text-sm font-semibold ${
        value
          ? danger
            ? "bg-destructive text-destructive-foreground border-destructive"
            : "bg-primary text-primary-foreground border-primary"
          : "bg-card border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      <span>{label}</span>
      <span className="text-xs opacity-80">{value ? "نعم" : "لا"}</span>
    </button>
  );
}
