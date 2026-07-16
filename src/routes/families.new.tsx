import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  RELATION_OPTIONS,
  MARITAL_OPTIONS,
  POLITICAL_OPTIONS,
  VOTER_STATUS_OPTIONS,
  createFamilyWithIndividuals,
  normalizeRelation,
  resolveMaritalStatus,
  parseBirthYear,
  applyDeceasedFields,
  resolveDeceasedForSave,
  isDeceased,
} from "@/lib/registry";
import {
  QUICK_ADD_RELATIONS,
  DEFAULT_REGISTRY_DISTRICT,
  DEFAULT_REGISTRY_TOWN,
  defaultsForRelation,
  defaultMaritalForRelation,
  patchOnRelationChange,
  relationFieldHint,
  tripleName,
  findHeadPerson,
  findWifePerson,
} from "@/lib/family-form-defaults";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useQueryClient } from "@tanstack/react-query";

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

function createIndividual(
  relation = "ابن",
  household: IndividualDraft[] = [],
  extras: Partial<IndividualDraft> = {},
): IndividualDraft {
  const relDefaults = defaultsForRelation(relation, household);
  return {
    relation: relDefaults.relation || relation,
    first_name: "",
    last_name: relDefaults.last_name || "",
    father_name: relDefaults.father_name || "",
    mother_name: relDefaults.mother_name || "",
    birth_year: "",
    mobile: "",
    current_residence: "",
    marital_status: relDefaults.marital_status || defaultMaritalForRelation(relation),
    lives_with_family: true,
    is_military: false,
    political_leaning: "غير مهتم",
    preferred_candidate: "",
    voter_status: "مقيم",
    has_voted: false,
    ...extras,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-ar">{label}</label>
      {children}
    </div>
  );
}

function IndividualFields({
  ind,
  onChange,
  household = [],
  spouseLabel,
}: {
  ind: IndividualDraft;
  onChange: (patch: Partial<IndividualDraft>) => void;
  household?: IndividualDraft[];
  spouseLabel?: string | null;
}) {
  const hint = relationFieldHint(ind.relation);
  const lastNameLabel =
    normalizeRelation(ind.relation) === "زوجة" || normalizeRelation(ind.relation) === "كنة"
      ? "الشهرة (عائلتها قبل الزواج)"
      : normalizeRelation(ind.relation) === "صهر"
        ? "الشهرة (عائلته)"
        : "الشهرة / اسم العائلة";

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Field label="صلة القرابة">
        <select
          className="field"
          value={ind.relation}
          onChange={(e) =>
            onChange(patchOnRelationChange(ind, e.target.value, household, household[0]?.last_name || ""))
          }
        >
          {RELATION_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      <Field label="الاسم الأول">
        <input
          className="field"
          value={ind.first_name}
          onChange={(e) => onChange({ first_name: e.target.value })}
          placeholder="مثال: جورج"
        />
      </Field>
      <Field label={lastNameLabel}>
        <input
          className="field"
          value={ind.last_name}
          onChange={(e) => onChange({ last_name: e.target.value })}
          placeholder={
            normalizeRelation(ind.relation) === "زوجة" || normalizeRelation(ind.relation) === "كنة"
              ? "شهرة أهلها"
              : "مثال: حداد"
          }
        />
      </Field>
      <Field label="اسم الأب">
        <input className="field" value={ind.father_name} onChange={(e) => onChange({ father_name: e.target.value })} />
      </Field>
      <Field label="اسم الأم والشهرة قبل الزواج">
        <input className="field" value={ind.mother_name} onChange={(e) => onChange({ mother_name: e.target.value })} />
      </Field>
      {(hint || spouseLabel) && (
        <div className="sm:col-span-2 lg:col-span-3 text-xs text-muted-foreground space-y-1">
          {hint && <div>{hint}</div>}
          {spouseLabel && <div>الزوج / الزوجة المرتبط: <span className="font-semibold text-foreground">{spouseLabel}</span></div>}
        </div>
      )}
      <Field label="تاريخ الولادة (سنة الولادة)">
        <input
          className="field"
          inputMode="numeric"
          value={ind.birth_year}
          onChange={(e) => onChange({ birth_year: e.target.value })}
          placeholder="مثال: 1975"
        />
      </Field>
      <Field label="رقم الجوال">
        <input
          className="field"
          value={ind.mobile}
          onChange={(e) => onChange({ mobile: e.target.value })}
          placeholder="03xxxxxx"
        />
      </Field>
      <Field label="الوضع العائلي">
        <select className="field" value={ind.marital_status} onChange={(e) => onChange({ marital_status: e.target.value })}>
          {MARITAL_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      <Field label="وضع الناخب">
        <select className="field" value={ind.voter_status} onChange={(e) => onChange({ voter_status: e.target.value })}>
          {VOTER_STATUS_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      <div className="lg:col-span-3">
        <Field label="السكن الفعلي الحالي بالتفصيل">
          <input
            className="field"
            value={ind.current_residence}
            onChange={(e) => onChange({ current_residence: e.target.value })}
            placeholder="بيت مري - حي الكنيسة - مشروع"
          />
        </Field>
      </div>
      <Field label="الميول السياسية">
        <select
          className="field"
          value={ind.political_leaning}
          onChange={(e) => onChange({ political_leaning: e.target.value })}
        >
          {POLITICAL_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      <Field label="لمن الصوت التفضيلي">
        <input
          className="field"
          value={ind.preferred_candidate}
          onChange={(e) => onChange({ preferred_candidate: e.target.value })}
          placeholder="اسم المرشح"
        />
      </Field>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:col-span-2 lg:col-span-3">
        <Toggle label="السكن مع الأهل" value={ind.lives_with_family} onChange={(v) => onChange({ lives_with_family: v })} />
        <Toggle label="عسكري" value={ind.is_military} onChange={(v) => onChange({ is_military: v })} danger />
        <Toggle label="اقترع يوم الانتخاب" value={ind.has_voted} onChange={(v) => onChange({ has_voted: v })} />
        <Toggle
          label="متوفّى"
          value={ind.voter_status === "متوفّى" || isDeceased({ voter_status: ind.voter_status, preferred_candidate: ind.preferred_candidate })}
          onChange={(v) => onChange(applyDeceasedFields(ind, v))}
          danger
        />
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
  danger,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
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

function NewFamily() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [family, setFamily] = useState({
    registry_district: DEFAULT_REGISTRY_DISTRICT,
    registry_town: DEFAULT_REGISTRY_TOWN,
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
  const [head, setHead] = useState<IndividualDraft>(createIndividual("رب العائلة"));
  const [members, setMembers] = useState<IndividualDraft[]>([]);
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const familyLastName = head.last_name.trim() || "غير محدد";
      const all = [head, ...members].map((i) => {
        const relation = normalizeRelation(i.relation) || i.relation;
        const keepOwn = relation === "زوجة" || relation === "كنة" || relation === "صهر";
        const deceased = resolveDeceasedForSave({
          voter_status: i.voter_status,
          preferred_candidate: i.preferred_candidate,
          promoteLegacyMarker: true,
        });
        return {
          ...i,
          relation,
          first_name: i.first_name.trim() || "بدون اسم",
          last_name: i.last_name.trim() || (keepOwn ? "غير محدد" : familyLastName),
          father_name: i.father_name.trim() || null,
          mother_name: i.mother_name.trim() || null,
          birth_year: parseBirthYear(i.birth_year),
          mobile: i.mobile.trim() || null,
          current_residence: i.current_residence.trim() || null,
          preferred_candidate: deceased.preferred_candidate,
          marital_status: resolveMaritalStatus(relation, i.marital_status),
          voter_status: deceased.voter_status,
        };
      });
      const payload = {
        ...family,
        registry_district: family.registry_district.trim() || DEFAULT_REGISTRY_DISTRICT,
        registry_town: family.registry_town.trim() || DEFAULT_REGISTRY_TOWN,
        sect: family.sect.trim() || null,
        registry_number: family.registry_number.trim() || null,
        winter_country: family.winter_country.trim() || null,
        winter_governorate: family.winter_governorate.trim() || null,
        winter_district: family.winter_district.trim() || null,
        winter_town: family.winter_town.trim() || null,
        winter_street: family.winter_street.trim() || null,
        winter_phone: family.winter_phone.trim() || null,
        summer_country: family.summer_country.trim() || null,
        summer_governorate: family.summer_governorate.trim() || null,
        summer_district: family.summer_district.trim() || null,
        summer_town: family.summer_town.trim() || null,
        summer_street: family.summer_street.trim() || null,
        summer_phone: family.summer_phone.trim() || null,
      };
      return createFamilyWithIndividuals(payload as any, all as any);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
        queryClient.invalidateQueries({ queryKey: ["family-summaries"] }),
        queryClient.invalidateQueries({ queryKey: ["individuals"] }),
        queryClient.invalidateQueries({ queryKey: ["search"] }),
        queryClient.invalidateQueries({ queryKey: ["family-members"] }),
      ]);
      navigate({ to: "/individuals" });
    },
  });

  const requestSave = () => mutation.mutate();

  const household = [head, ...members];
  const wife = findWifePerson(members);

  const addMember = (relation: string) => {
    setMembers((prev) => [...prev, createIndividual(relation, [head, ...prev])]);
  };

  const updateMember = (idx: number, patch: Partial<IndividualDraft>) => {
    setMembers((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const spouseFor = (person: IndividualDraft, others: IndividualDraft[]) => {
    const rel = normalizeRelation(person.relation);
    if (rel === "زوجة" || rel === "والدة") return findHeadPerson([head, ...others]);
    if (rel === "رب العائلة" || rel === "زوج" || rel === "والد") {
      return findWifePerson(others) || (person === head ? wife : undefined);
    }
    if (rel === "كنة") {
      const sons = others.filter((m) => normalizeRelation(m.relation) === "ابن");
      const marriedSons = sons.filter((m) => m.marital_status === "متزوج");
      if (marriedSons.length === 1) return marriedSons[0];
      if (sons.length === 1) return sons[0];
      return undefined;
    }
    return undefined;
  };

  const saveButton = (
    <button type="button" className="btn-primary min-w-[9rem]" disabled={mutation.isPending} onClick={requestSave}>
      {mutation.isPending ? "جاري الحفظ..." : "حفظ"}
    </button>
  );

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black">استمارة عائلية جديدة</h1>
          <p className="text-sm text-muted-foreground mt-1">
            كبسة <span className="font-semibold text-foreground">حفظ</span> موجودة بكل خطوة — فيك تترك حقول فاضية وتكمّل لاحقاً.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {saveButton}
          <div className="flex items-center gap-2 text-sm">
            <span className={`chip ${step === 1 ? "!bg-primary !text-primary-foreground" : ""}`}>١ · الشخص والسجل</span>
            <span className="text-muted-foreground">←</span>
            <span className={`chip ${step === 2 ? "!bg-primary !text-primary-foreground" : ""}`}>٢ · أفراد العائلة</span>
          </div>
        </div>
      </div>

      {step === 1 && (
        <div className="card-elev p-5 sm:p-8 space-y-8">
          <section>
            <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-bold text-lg">الشخص الرئيسي / رب العائلة</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  هنا تحط اسم الشخص وتفاصيله. بعدين بترجع تضيف أفراد عيلته.
                </p>
              </div>
              {head.is_military && (
                <span className="chip !bg-destructive !text-destructive-foreground">عسكري — لا يحق له الاقتراع</span>
              )}
            </div>
            <IndividualFields
              ind={head}
              household={household}
              spouseLabel={wife ? tripleName(wife) : null}
              onChange={(patch) => setHead((prev) => ({ ...prev, ...patch }))}
            />
          </section>

          <section>
            <h2 className="font-bold text-lg mb-4">بيانات السجل</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="قضاء النفوس">
                <input
                  className="field"
                  value={family.registry_district}
                  onChange={(e) => setFamily({ ...family, registry_district: e.target.value })}
                  placeholder="مثال: الشوف"
                />
              </Field>
              <Field label="بلدة النفوس">
                <input
                  className="field"
                  value={family.registry_town}
                  onChange={(e) => setFamily({ ...family, registry_town: e.target.value })}
                  placeholder="مثال: بريح"
                />
              </Field>
              <Field label="المذهب">
                <input
                  className="field"
                  value={family.sect}
                  onChange={(e) => setFamily({ ...family, sect: e.target.value })}
                  placeholder="مثال: ماروني"
                />
              </Field>
              <Field label="رقم السجل">
                <input
                  className="field"
                  value={family.registry_number}
                  onChange={(e) => setFamily({ ...family, registry_number: e.target.value })}
                  placeholder="مثال: 12"
                />
              </Field>
            </div>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-4">مكان السكن شتاءً</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="البلد">
                <input
                  className="field"
                  value={family.winter_country}
                  onChange={(e) => setFamily({ ...family, winter_country: e.target.value })}
                />
              </Field>
              <Field label="المحافظة">
                <input
                  className="field"
                  value={family.winter_governorate}
                  onChange={(e) => setFamily({ ...family, winter_governorate: e.target.value })}
                  placeholder="جبل لبنان"
                />
              </Field>
              <Field label="القضاء">
                <input
                  className="field"
                  value={family.winter_district}
                  onChange={(e) => setFamily({ ...family, winter_district: e.target.value })}
                  placeholder="كسروان"
                />
              </Field>
              <Field label="البلدة/المدينة">
                <input
                  className="field"
                  value={family.winter_town}
                  onChange={(e) => setFamily({ ...family, winter_town: e.target.value })}
                  placeholder="الصفرا"
                />
              </Field>
              <Field label="الشارع">
                <input
                  className="field"
                  value={family.winter_street}
                  onChange={(e) => setFamily({ ...family, winter_street: e.target.value })}
                />
              </Field>
              <Field label="الهاتف الثابت">
                <input
                  className="field"
                  value={family.winter_phone}
                  onChange={(e) => setFamily({ ...family, winter_phone: e.target.value })}
                />
              </Field>
            </div>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-4">مكان السكن صيفاً</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="البلد">
                <input
                  className="field"
                  value={family.summer_country}
                  onChange={(e) => setFamily({ ...family, summer_country: e.target.value })}
                />
              </Field>
              <Field label="المحافظة">
                <input
                  className="field"
                  value={family.summer_governorate}
                  onChange={(e) => setFamily({ ...family, summer_governorate: e.target.value })}
                />
              </Field>
              <Field label="القضاء">
                <input
                  className="field"
                  value={family.summer_district}
                  onChange={(e) => setFamily({ ...family, summer_district: e.target.value })}
                />
              </Field>
              <Field label="البلدة/المدينة">
                <input
                  className="field"
                  value={family.summer_town}
                  onChange={(e) => setFamily({ ...family, summer_town: e.target.value })}
                />
              </Field>
              <Field label="الشارع">
                <input
                  className="field"
                  value={family.summer_street}
                  onChange={(e) => setFamily({ ...family, summer_street: e.target.value })}
                />
              </Field>
              <Field label="الهاتف الثابت">
                <input
                  className="field"
                  value={family.summer_phone}
                  onChange={(e) => setFamily({ ...family, summer_phone: e.target.value })}
                />
              </Field>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {saveButton}
            <button className="btn-primary" onClick={() => setStep(2)}>
              التالي — إضافة أفراد العائلة ←
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="card-elev p-5 sm:p-6 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="chip mb-2 !bg-primary !text-primary-foreground">رب العائلة</div>
                <div className="text-xl font-black">
                  {head.first_name || "بدون اسم"} {head.last_name}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {[head.father_name ? `ابن ${head.father_name}` : null, family.registry_town, family.registry_district]
                    .filter(Boolean)
                    .join(" · ") || "بيانات السجل اختيارية — فيك تكمّلها لاحقاً"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {saveButton}
                <button className="btn-ghost" onClick={() => setStep(1)}>
                  تعديل بيانات الشخص
                </button>
              </div>
            </div>
          </div>

          {members.length === 0 && (
            <div className="card-elev p-6 text-center text-muted-foreground">
              ما في أفراد مضافين بعد. اختار نوع القرابة تحت لتسجيل زوجة / زوج / أولاد / كنة…
            </div>
          )}

          <div className="card-elev p-4 flex flex-wrap gap-2">
            {QUICK_ADD_RELATIONS.map((item) => (
              <button
                key={item.relation}
                type="button"
                className="chip hover:bg-primary hover:text-primary-foreground transition cursor-pointer border border-border"
                onClick={() => addMember(item.relation)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {members.map((ind, idx) => {
            const spouse = spouseFor(ind, [head, ...members.filter((_, i) => i !== idx)]);
            return (
            <div key={idx} className="card-elev p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4 gap-2">
                <div className="flex items-center gap-2">
                  <span className="chip">{ind.relation || `فرد #${idx + 1}`}</span>
                  {ind.is_military && (
                    <span className="chip !bg-destructive !text-destructive-foreground">
                      عسكري — لا يحق له الاقتراع
                    </span>
                  )}
                </div>
                <button
                  className="text-destructive text-sm font-semibold hover:underline"
                  onClick={() => setPendingDeleteIdx(idx)}
                >
                  حذف
                </button>
              </div>
              <IndividualFields
                ind={ind}
                household={household}
                spouseLabel={spouse ? tripleName(spouse) : null}
                onChange={(patch) => updateMember(idx, patch)}
              />
            </div>
            );
          })}

          <div className="flex flex-wrap gap-2 justify-between">
            <button className="btn-ghost" onClick={() => addMember("ابن")}>
              + إضافة فرد
            </button>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setStep(1)}>
                → العودة
              </button>
              <button type="button" className="btn-primary min-w-[9rem]" disabled={mutation.isPending} onClick={requestSave}>
                {mutation.isPending ? "جاري الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky bottom-3 z-50">
        <div className="card-elev border-2 border-primary bg-card p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="text-sm">
            <div className="font-bold">{step === 1 ? "الخطوة ١ — الشخص والسجل" : "الخطوة ٢ — أفراد العائلة"}</div>
            <div className="text-muted-foreground text-xs mt-0.5">
              احفظ بأي وقت من هالخطوة — الحقول الفاضية مسموحة
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {step === 1 ? (
              <>
                {saveButton}
                <button type="button" className="btn-ghost" onClick={() => setStep(2)}>
                  التالي ←
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
                  → العودة
                </button>
                {saveButton}
              </>
            )}
          </div>
        </div>
      </div>

      {mutation.error && (
        <div className="card-elev p-4 text-destructive text-sm">
          حدث خطأ أثناء الحفظ: {(mutation.error as Error).message}
        </div>
      )}

      <ConfirmDeleteDialog
        open={pendingDeleteIdx !== null}
        onOpenChange={(open) => !open && setPendingDeleteIdx(null)}
        title="تأكيد حذف الفرد"
        description={
          pendingDeleteIdx !== null
            ? `هل أنت متأكد من حذف ${members[pendingDeleteIdx]?.first_name || "هذا الفرد"} من الاستمارة؟`
            : ""
        }
        onConfirm={() => {
          if (pendingDeleteIdx === null) return;
          setMembers((p) => p.filter((_, i) => i !== pendingDeleteIdx));
          setPendingDeleteIdx(null);
        }}
      />
    </div>
  );
}
