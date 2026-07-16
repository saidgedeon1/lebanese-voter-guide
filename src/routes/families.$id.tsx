import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  RELATION_OPTIONS,
  MARITAL_OPTIONS,
  POLITICAL_OPTIONS,
  VOTER_STATUS_OPTIONS,
  getFamilyById,
  updateFamilyForm,
  deleteFamilyForm,
  updateIndividual,
  deleteIndividual,
  addIndividualToFamily,
  normalizeRelation,
  findSpouse,
  resolveMaritalStatus,
  parseBirthYear,
  applyDeceasedFields,
  isDeceased,
  resolveDeceasedForSave,
  type Individual,
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
} from "@/lib/family-form-defaults";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { PersonFilesPanel } from "@/components/PersonFilesPanel";
import { PassportPhoto } from "@/components/PassportPhoto";

type FamilyEditSearch = {
  member?: number;
  add?: boolean;
};

export const Route = createFileRoute("/families/$id")({
  validateSearch: (search: Record<string, unknown>): FamilyEditSearch => {
    const next: FamilyEditSearch = {};
    if (search.member != null && search.member !== "") {
      const member = Number(search.member);
      if (Number.isFinite(member)) next.member = member;
    }
    if (search.add === true || search.add === "1" || search.add === "true") {
      next.add = true;
    }
    return next;
  },
  component: EditFamilyPage,
});

type IndividualDraft = {
  id?: number;
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

function fromIndividual(member: Individual): IndividualDraft {
  return {
    id: member.id,
    relation: member.relation || "ابن",
    first_name: member.first_name || "",
    last_name: member.last_name || "",
    father_name: member.father_name || "",
    mother_name: member.mother_name || "",
    birth_year: member.birth_year?.toString() || "",
    mobile: member.mobile || "",
    current_residence: member.current_residence || "",
    marital_status: member.marital_status || "أعزب",
    lives_with_family: member.lives_with_family ?? true,
    is_military: member.is_military ?? false,
    political_leaning: member.political_leaning || "مستقل",
    preferred_candidate: member.preferred_candidate || "",
    voter_status: isDeceased(member) ? "متوفّى" : member.voter_status || "مقيم",
    has_voted: member.has_voted ?? false,
  };
}

function toPayload(draft: IndividualDraft) {
  const relation = normalizeRelation(draft.relation) || draft.relation;
  const deceased = resolveDeceasedForSave({
    voter_status: draft.voter_status,
    preferred_candidate: draft.preferred_candidate,
    promoteLegacyMarker: false,
  });
  return {
    relation,
    first_name: draft.first_name.trim(),
    last_name: draft.last_name.trim(),
    father_name: draft.father_name.trim() || null,
    mother_name: draft.mother_name.trim() || null,
    birth_year: parseBirthYear(draft.birth_year),
    mobile: draft.mobile.trim() || null,
    current_residence: draft.current_residence.trim() || null,
    marital_status: resolveMaritalStatus(relation, draft.marital_status),
    lives_with_family: draft.lives_with_family,
    is_military: draft.is_military,
    political_leaning: draft.political_leaning,
    preferred_candidate: deceased.preferred_candidate,
    voter_status: deceased.voter_status,
    has_voted: draft.has_voted,
  };
}

function emptyDraft(
  relation = "ابن",
  household: IndividualDraft[] = [],
  familyLastName = "",
  extras: Partial<IndividualDraft> = {},
): IndividualDraft {
  const relDefaults = defaultsForRelation(relation, household, familyLastName);
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
    political_leaning: "مستقل",
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

function IndividualFields({
  ind,
  onChange,
  household = [],
  familyLastName = "",
  spouseLabel,
}: {
  ind: IndividualDraft;
  onChange: (patch: Partial<IndividualDraft>) => void;
  household?: IndividualDraft[];
  familyLastName?: string;
  spouseLabel?: string | null;
}) {
  const hint = relationFieldHint(ind.relation);
  const rel = normalizeRelation(ind.relation);
  const lastNameLabel =
    rel === "زوجة" || rel === "كنة"
      ? "الشهرة (عائلتها قبل الزواج)"
      : rel === "صهر"
        ? "الشهرة (عائلته)"
        : "الشهرة / اسم العائلة";

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Field label="صلة القرابة">
        <select
          className="field"
          value={ind.relation}
          onChange={(e) => onChange(patchOnRelationChange(ind, e.target.value, household, familyLastName))}
        >
          {RELATION_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      <Field label="الاسم الأول">
        <input className="field" value={ind.first_name} onChange={(e) => onChange({ first_name: e.target.value })} />
      </Field>
      <Field label={lastNameLabel}>
        <input
          className="field"
          value={ind.last_name}
          onChange={(e) => onChange({ last_name: e.target.value })}
          placeholder={rel === "زوجة" || rel === "كنة" ? "شهرة أهلها" : undefined}
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
          {spouseLabel && (
            <div>
              الزوج / الزوجة المرتبط: <span className="font-semibold text-foreground">{spouseLabel}</span>
            </div>
          )}
        </div>
      )}
      <Field label="تاريخ الولادة (سنة الولادة)">
        <input className="field" inputMode="numeric" value={ind.birth_year} onChange={(e) => onChange({ birth_year: e.target.value })} />
      </Field>
      <Field label="رقم الجوال">
        <input className="field" value={ind.mobile} onChange={(e) => onChange({ mobile: e.target.value })} />
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
          />
        </Field>
      </div>
      <Field label="الحزب / الميول السياسية">
        <select className="field" value={ind.political_leaning} onChange={(e) => onChange({ political_leaning: e.target.value })}>
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

function EditFamilyPage() {
  const { id } = Route.useParams();
  const { member: focusMemberId, add: openAdd } = Route.useSearch();
  const familyId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["family", familyId],
    queryFn: () => getFamilyById(familyId),
    enabled: Number.isFinite(familyId),
  });

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
  const [members, setMembers] = useState<IndividualDraft[]>([]);
  const [newMember, setNewMember] = useState<IndividualDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDeleteMember, setPendingDeleteMember] = useState<IndividualDraft | null>(null);
  const [pendingDeleteFamily, setPendingDeleteFamily] = useState(false);
  const deepLinkHandled = useRef(false);

  useEffect(() => {
    if (!data) return;
    setFamily({
      registry_district: data.registry_district || DEFAULT_REGISTRY_DISTRICT,
      registry_town: data.registry_town || DEFAULT_REGISTRY_TOWN,
      sect: data.sect || "",
      registry_number: data.registry_number || "",
      winter_country: data.winter_country || "لبنان",
      winter_governorate: data.winter_governorate || "",
      winter_district: data.winter_district || "",
      winter_town: data.winter_town || "",
      winter_street: data.winter_street || "",
      winter_phone: data.winter_phone || "",
      summer_country: data.summer_country || "لبنان",
      summer_governorate: data.summer_governorate || "",
      summer_district: data.summer_district || "",
      summer_town: data.summer_town || "",
      summer_street: data.summer_street || "",
      summer_phone: data.summer_phone || "",
    });
    setMembers(data.members.map(fromIndividual));
  }, [data]);

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stats"] }),
      queryClient.invalidateQueries({ queryKey: ["family-summaries"] }),
      queryClient.invalidateQueries({ queryKey: ["individuals"] }),
      queryClient.invalidateQueries({ queryKey: ["family", familyId] }),
      queryClient.invalidateQueries({ queryKey: ["family-members"] }),
      queryClient.invalidateQueries({ queryKey: ["search"] }),
    ]);
  };

  const resolveLastName = (draft: IndividualDraft) => {
    const relation = normalizeRelation(draft.relation) || draft.relation;
    const keepOwn = relation === "زوجة" || relation === "كنة" || relation === "صهر";
    return (
      draft.last_name.trim() ||
      (keepOwn
        ? "غير محدد"
        : members.find((m) => m.last_name.trim())?.last_name.trim() ||
          data?.members.find((m) => m.last_name)?.last_name ||
          "غير محدد")
    );
  };

  const familyPayload = () => ({
    registry_district: family.registry_district.trim(),
    registry_town: family.registry_town.trim(),
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
  });

  const saveFamily = useMutation({
    mutationFn: async () => updateFamilyForm(familyId, familyPayload()),
    onSuccess: async () => {
      setMessage("تم حفظ بيانات الاستمارة.");
      await invalidateAll();
      await refetch();
    },
  });

  const [savingAll, setSavingAll] = useState(false);
  const [saveAllError, setSaveAllError] = useState<string | null>(null);

  const saveAllChanges = async () => {
    setSavingAll(true);
    setSaveAllError(null);
    setMessage(null);
    try {
      await updateFamilyForm(familyId, familyPayload());
      for (const draft of members) {
        if (!draft.id) continue;
        await updateIndividual(
          draft.id,
          toPayload({
            ...draft,
            first_name: draft.first_name.trim() || "بدون اسم",
            last_name: resolveLastName(draft),
          }),
        );
      }
      if (newMember) {
        await addIndividualToFamily(
          familyId,
          toPayload({
            ...newMember,
            first_name: newMember.first_name.trim() || "بدون اسم",
            last_name: resolveLastName(newMember),
          }),
        );
        setNewMember(null);
      }
      setMessage("تم حفظ كل التعديلات (الأفراد + الاستمارة).");
      await invalidateAll();
      await refetch();
    } catch (err) {
      setSaveAllError((err as Error).message || "تعذّر الحفظ");
    } finally {
      setSavingAll(false);
    }
  };

  const saveMember = useMutation({
    mutationFn: async (draft: IndividualDraft) => {
      if (!draft.id) throw new Error("فرد غير موجود");
      await updateFamilyForm(familyId, familyPayload());
      return updateIndividual(
        draft.id,
        toPayload({
          ...draft,
          first_name: draft.first_name.trim() || "بدون اسم",
          last_name: resolveLastName(draft),
        }),
      );
    },
    onSuccess: async () => {
      setMessage("تم حفظ الفرد ورقم السجل.");
      await invalidateAll();
      await refetch();
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: number) => deleteIndividual(memberId),
    onSuccess: async () => {
      setPendingDeleteMember(null);
      setMessage("تم حذف الفرد من الاستمارة.");
      await invalidateAll();
      await refetch();
    },
  });

  const createMember = useMutation({
    mutationFn: async (draft: IndividualDraft) => {
      await updateFamilyForm(familyId, familyPayload());
      return addIndividualToFamily(
        familyId,
        toPayload({
          ...draft,
          first_name: draft.first_name.trim() || "بدون اسم",
          last_name: resolveLastName(draft),
        }),
      );
    },
    onSuccess: async () => {
      setNewMember(null);
      setMessage("تمت إضافة الفرد إلى الاستمارة.");
      await invalidateAll();
      await refetch();
    },
  });

  const familyLastName = members.find((m) => m.last_name.trim())?.last_name.trim() || data?.members.find((m) => m.last_name)?.last_name || "";

  const startAddMember = (relation: string) => {
    setMessage(null);
    setNewMember(emptyDraft(relation, members, familyLastName));
    requestAnimationFrame(() => {
      document.getElementById("new-member-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const removeFamily = useMutation({
    mutationFn: async () => deleteFamilyForm(familyId),
    onSuccess: async () => {
      setPendingDeleteFamily(false);
      await invalidateAll();
      navigate({ to: "/" });
    },
  });

  useEffect(() => {
    if (!data) return;
    if (typeof window === "undefined") return;
    if (deepLinkHandled.current) return;

    if (openAdd) {
      deepLinkHandled.current = true;
      const drafts = data.members.map(fromIndividual);
      const last = data.members.find((m) => m.last_name)?.last_name || "";
      setNewMember(emptyDraft("ابن", drafts, last));
      requestAnimationFrame(() => {
        document.getElementById("new-member-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    if (focusMemberId) {
      deepLinkHandled.current = true;
      requestAnimationFrame(() => {
        document.getElementById(`member-${focusMemberId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    if (window.location.hash === "#members") {
      deepLinkHandled.current = true;
      requestAnimationFrame(() => {
        document.getElementById("members")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [data, focusMemberId, openAdd]);

  if (isLoading) {
    return <div className="card-elev p-6 text-muted-foreground">جاري تحميل الاستمارة...</div>;
  }

  if (error || !data) {
    return (
      <div className="card-elev p-6 space-y-3">
        <div className="text-destructive">تعذّر تحميل الاستمارة.</div>
        <Link to="/" className="btn-ghost inline-flex">
          العودة للرئيسية
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black">تعديل الاستمارة #{familyId}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.family_name} · {family.registry_town || "—"} — {family.registry_district || "—"}
            {family.registry_number ? ` · سجل ${family.registry_number}` : ""} · {members.length} أفراد
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={savingAll}
            onClick={() => void saveAllChanges()}
          >
            {savingAll ? "جاري الحفظ..." : "حفظ الكل"}
          </button>
          <Link to="/" className="btn-ghost">
            العودة
          </Link>
          <a href="#members" className="btn-ghost">
            إدارة الأفراد
          </a>
          <button
            className="btn-ghost !text-destructive !border-destructive/40"
            disabled={removeFamily.isPending}
            onClick={() => setPendingDeleteFamily(true)}
          >
            {removeFamily.isPending ? "جاري الحذف..." : "حذف الاستمارة"}
          </button>
        </div>
      </div>

      {message && <div className="card-elev p-4 text-success text-sm font-semibold">{message}</div>}
      {(saveAllError || saveFamily.error || saveMember.error || removeMember.error || createMember.error || removeFamily.error) && (
        <div className="card-elev p-4 text-destructive text-sm">
          {saveAllError ||
            (
              (saveFamily.error ||
                saveMember.error ||
                removeMember.error ||
                createMember.error ||
                removeFamily.error) as Error
            ).message}
        </div>
      )}

      <section id="registry" className="card-elev p-5 sm:p-6 space-y-4 scroll-mt-24">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-bold text-lg">بيانات السجل</h2>
            <p className="text-sm text-muted-foreground mt-1">مشتركة لكل أفراد الاستمارة — عدّل رقم السجل من هون</p>
          </div>
          <button className="btn-primary" disabled={saveFamily.isPending} onClick={() => saveFamily.mutate()}>
            {saveFamily.isPending ? "جاري الحفظ..." : "حفظ السجل"}
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="قضاء النفوس">
            <input
              className="field"
              value={family.registry_district}
              onChange={(e) => setFamily({ ...family, registry_district: e.target.value })}
            />
          </Field>
          <Field label="بلدة النفوس">
            <input
              className="field"
              value={family.registry_town}
              onChange={(e) => setFamily({ ...family, registry_town: e.target.value })}
            />
          </Field>
          <Field label="المذهب">
            <input className="field" value={family.sect} onChange={(e) => setFamily({ ...family, sect: e.target.value })} />
          </Field>
          <Field label="رقم السجل">
            <input
              className="field"
              value={family.registry_number}
              onChange={(e) => setFamily({ ...family, registry_number: e.target.value })}
              placeholder="مثال: 123"
            />
          </Field>
        </div>
      </section>

      <section id="members" className="space-y-4 scroll-mt-24">
        <div className="card-elev p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-bold text-xl">أفراد العائلة</h2>
              <p className="text-sm text-muted-foreground mt-1">
                زيد أو امسح فرد من نفس الاستمارة من هون
              </p>
            </div>
            <button className="btn-primary" onClick={() => startAddMember("ابن")} disabled={!!newMember}>
              + إضافة فرد
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_ADD_RELATIONS.map((item) => (
              <button
                key={item.relation}
                type="button"
                className="chip hover:bg-primary hover:text-primary-foreground transition cursor-pointer border border-border"
                disabled={!!newMember}
                onClick={() => startAddMember(item.relation)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {newMember && (
          <div id="new-member-form" className="card-elev p-5 sm:p-6 space-y-4 border-2 border-primary/40 scroll-mt-24">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-bold text-lg">فرد جديد — {newMember.relation}</h3>
              <button className="btn-ghost" onClick={() => setNewMember(null)}>
                إلغاء
              </button>
            </div>
            <Field label="رقم السجل (للاستمارة كلها)">
              <input
                className="field"
                value={family.registry_number}
                onChange={(e) => setFamily({ ...family, registry_number: e.target.value })}
                placeholder="مثال: 123"
              />
            </Field>
            <IndividualFields
              ind={newMember}
              household={members}
              familyLastName={familyLastName}
              onChange={(patch) => setNewMember((prev) => (prev ? { ...prev, ...patch } : prev))}
            />
            <button className="btn-primary w-full sm:w-auto" disabled={createMember.isPending} onClick={() => createMember.mutate(newMember)}>
              {createMember.isPending ? "جاري الإضافة..." : "حفظ الفرد الجديد في الاستمارة"}
            </button>
          </div>
        )}

        {members.map((member, idx) => {
          const original = member.id && data ? data.members.find((m) => m.id === member.id) : null;
          const spouse =
            original && data
              ? findSpouse({ ...original, ...member, id: member.id! } as Individual, data.members)
              : null;
          return (
          <div
            key={member.id ?? idx}
            id={member.id ? `member-${member.id}` : undefined}
            className={`card-elev p-5 sm:p-6 space-y-4 scroll-mt-24 ${
              member.id && focusMemberId === member.id ? "border-2 border-primary ring-2 ring-primary/20" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                {member.id ? (
                  <PassportPhoto
                    personId={member.id}
                    name={`${member.first_name} ${member.last_name}`}
                    size="md"
                  />
                ) : null}
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="chip">{member.relation || "فرد"}</span>
                    {member.id ? <span className="text-xs text-muted-foreground">#{member.id}</span> : null}
                  </div>
                  <div className="font-bold text-lg leading-tight">
                    {member.first_name} {member.last_name}
                  </div>
                  {spouse && (
                    <div className="text-xs text-muted-foreground">
                      الزوج / الزوجة: {tripleName(spouse)}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-primary"
                  disabled={saveMember.isPending}
                  onClick={() => saveMember.mutate(member)}
                >
                  حفظ هذا الفرد
                </button>
                <button
                  className="btn-ghost !text-destructive !border-destructive/40"
                  disabled={removeMember.isPending || members.length <= 1}
                  title={members.length <= 1 ? "ما فيك تمسح آخر فرد بالاستمارة" : "حذف الفرد من الاستمارة"}
                  onClick={() => {
                    if (member.id) setPendingDeleteMember(member);
                  }}
                >
                  حذف من الاستمارة
                </button>
              </div>
            </div>
            <Field label="رقم السجل (للاستمارة كلها)">
              <input
                className="field"
                value={family.registry_number}
                onChange={(e) => setFamily({ ...family, registry_number: e.target.value })}
                placeholder="مثال: 123"
              />
            </Field>
            <IndividualFields
              ind={member}
              household={members}
              familyLastName={familyLastName}
              spouseLabel={spouse ? tripleName(spouse) : null}
              onChange={(patch) =>
                setMembers((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)))
              }
            />
            {member.id ? (
              <div className="pt-4 border-t border-border">
                <PersonFilesPanel
                  personId={member.id}
                  personName={`${member.first_name} ${member.last_name}`}
                  compact
                />
              </div>
            ) : null}
          </div>
          );
        })}

        {members.length === 0 && !newMember && (
          <div className="card-elev p-6 text-center space-y-3">
            <p className="text-muted-foreground">ما في أفراد بهالاستمارة بعد.</p>
            <button className="btn-primary" onClick={() => startAddMember("رب العائلة")}>
              + إضافة أول فرد
            </button>
          </div>
        )}
      </section>

      <section className="card-elev p-5 sm:p-7 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-bold text-lg">مكان السكن</h2>
          <button className="btn-primary" disabled={saveFamily.isPending} onClick={() => saveFamily.mutate()}>
            {saveFamily.isPending ? "جاري الحفظ..." : "حفظ السكن"}
          </button>
        </div>

        <div>
          <h3 className="font-semibold mb-3">مكان السكن شتاءً</h3>
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
              />
            </Field>
            <Field label="القضاء">
              <input
                className="field"
                value={family.winter_district}
                onChange={(e) => setFamily({ ...family, winter_district: e.target.value })}
              />
            </Field>
            <Field label="البلدة/المدينة">
              <input
                className="field"
                value={family.winter_town}
                onChange={(e) => setFamily({ ...family, winter_town: e.target.value })}
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
        </div>

        <div>
          <h3 className="font-semibold mb-3">مكان السكن صيفاً</h3>
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
        </div>
      </section>

      <div className="sticky bottom-3 z-50 pt-2">
        <div className="card-elev border-2 border-primary bg-card p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="text-sm">
            <div className="font-bold">حفظ</div>
            <div className="text-muted-foreground text-xs mt-0.5">
              يحفظ كل الأفراد + الفرد الجديد + السجل والسكن — بأي وقت
            </div>
          </div>
          <button
            type="button"
            className="btn-primary min-w-[10rem]"
            disabled={savingAll}
            onClick={() => void saveAllChanges()}
          >
            {savingAll ? "جاري الحفظ..." : "حفظ الكل"}
          </button>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={!!pendingDeleteMember}
        onOpenChange={(open) => !open && !removeMember.isPending && setPendingDeleteMember(null)}
        title="تأكيد حذف الفرد"
        description={
          pendingDeleteMember
            ? `هل أنت متأكد من حذف ${pendingDeleteMember.first_name} ${pendingDeleteMember.last_name} من الاستمارة؟ لا يمكن التراجع عن هذا الإجراء.`
            : ""
        }
        pending={removeMember.isPending}
        onConfirm={() => {
          if (pendingDeleteMember?.id) removeMember.mutate(pendingDeleteMember.id);
        }}
      />

      <ConfirmDeleteDialog
        open={pendingDeleteFamily}
        onOpenChange={(open) => !open && !removeFamily.isPending && setPendingDeleteFamily(false)}
        title="تأكيد حذف الاستمارة"
        description="هل أنت متأكد من حذف الاستمارة كاملة مع كل أفرادها؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="تأكيد حذف الاستمارة"
        pending={removeFamily.isPending}
        onConfirm={() => removeFamily.mutate()}
      />
    </div>
  );
}
