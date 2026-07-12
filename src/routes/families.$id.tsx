import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  type Individual,
} from "@/lib/registry";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

export const Route = createFileRoute("/families/$id")({
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
    political_leaning: member.political_leaning || "غير مهتم",
    preferred_candidate: member.preferred_candidate || "",
    voter_status: member.voter_status || "مقيم",
    has_voted: member.has_voted ?? false,
  };
}

function toPayload(draft: IndividualDraft) {
  return {
    relation: draft.relation,
    first_name: draft.first_name.trim(),
    last_name: draft.last_name.trim(),
    father_name: draft.father_name.trim() || null,
    mother_name: draft.mother_name.trim() || null,
    birth_year: draft.birth_year ? parseInt(draft.birth_year, 10) : null,
    mobile: draft.mobile.trim() || null,
    current_residence: draft.current_residence.trim() || null,
    marital_status: draft.marital_status,
    lives_with_family: draft.lives_with_family,
    is_military: draft.is_military,
    political_leaning: draft.political_leaning,
    preferred_candidate: draft.preferred_candidate.trim() || null,
    voter_status: draft.voter_status,
    has_voted: draft.has_voted,
  };
}

function emptyDraft(relation = "ابن", defaults: Partial<IndividualDraft> = {}): IndividualDraft {
  return {
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
    ...defaults,
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
}: {
  ind: IndividualDraft;
  onChange: (patch: Partial<IndividualDraft>) => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Field label="صلة القرابة">
        <select className="field" value={ind.relation} onChange={(e) => onChange({ relation: e.target.value })}>
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
      <Field label="الشهرة / اسم العائلة">
        <input className="field" value={ind.last_name} onChange={(e) => onChange({ last_name: e.target.value })} />
      </Field>
      <Field label="اسم الأب">
        <input className="field" value={ind.father_name} onChange={(e) => onChange({ father_name: e.target.value })} />
      </Field>
      <Field label="اسم الأم والشهرة قبل الزواج">
        <input className="field" value={ind.mother_name} onChange={(e) => onChange({ mother_name: e.target.value })} />
      </Field>
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
      <Field label="الميول السياسية">
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
      <div className="grid grid-cols-3 gap-3 sm:col-span-2 lg:col-span-3">
        <Toggle label="السكن مع الأهل" value={ind.lives_with_family} onChange={(v) => onChange({ lives_with_family: v })} />
        <Toggle label="عسكري" value={ind.is_military} onChange={(v) => onChange({ is_military: v })} danger />
        <Toggle label="اقترع يوم الانتخاب" value={ind.has_voted} onChange={(v) => onChange({ has_voted: v })} />
      </div>
    </div>
  );
}

function EditFamilyPage() {
  const { id } = Route.useParams();
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

  useEffect(() => {
    if (!data) return;
    setFamily({
      registry_district: data.registry_district || "",
      registry_town: data.registry_town || "",
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
    ]);
  };

  const saveFamily = useMutation({
    mutationFn: async () =>
      updateFamilyForm(familyId, {
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
      }),
    onSuccess: async () => {
      setMessage("تم حفظ بيانات الاستمارة.");
      await invalidateAll();
      await refetch();
    },
  });

  const saveMember = useMutation({
    mutationFn: async (draft: IndividualDraft) => {
      if (!draft.id) throw new Error("فرد غير موجود");
      if (!draft.first_name.trim()) {
        throw new Error("الاسم مطلوب");
      }
      const fallbackLastName =
        draft.last_name.trim() ||
        members.find((m) => m.last_name.trim())?.last_name.trim() ||
        data?.members.find((m) => m.last_name)?.last_name ||
        "";
      if (!fallbackLastName) {
        throw new Error("الشهرة مطلوبة");
      }
      return updateIndividual(
        draft.id,
        toPayload({
          ...draft,
          last_name: fallbackLastName,
        }),
      );
    },
    onSuccess: async () => {
      setMessage("تم حفظ بيانات الفرد.");
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
      if (!draft.first_name.trim()) {
        throw new Error("الاسم مطلوب");
      }
      const fallbackLastName =
        draft.last_name.trim() ||
        members.find((m) => m.last_name.trim())?.last_name.trim() ||
        data?.members.find((m) => m.last_name)?.last_name ||
        "";
      if (!fallbackLastName) {
        throw new Error("الشهرة مطلوبة");
      }
      return addIndividualToFamily(
        familyId,
        toPayload({
          ...draft,
          last_name: fallbackLastName,
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
    setNewMember(
      emptyDraft(relation, {
        last_name: familyLastName,
        father_name:
          relation === "ابن" || relation === "ابنة"
            ? members.find((m) => ["رب العائلة", "والد", "زوج"].includes(m.relation))?.first_name || ""
            : "",
      }),
    );
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
    if (window.location.hash === "#members") {
      requestAnimationFrame(() => {
        document.getElementById("members")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [data]);

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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black">تعديل الاستمارة #{familyId}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.family_name} · {data.registry_town} — {data.registry_district} · {members.length} أفراد
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/" className="btn-ghost">
            العودة
          </Link>
          <a href="#members" className="btn-primary">
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
      {(saveFamily.error || saveMember.error || removeMember.error || createMember.error || removeFamily.error) && (
        <div className="card-elev p-4 text-destructive text-sm">
          {(
            (saveFamily.error ||
              saveMember.error ||
              removeMember.error ||
              createMember.error ||
              removeFamily.error) as Error
          ).message}
        </div>
      )}

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
            {[
              { relation: "زوجة", label: "+ زوجة" },
              { relation: "زوج", label: "+ زوج" },
              { relation: "والدة", label: "+ والدة" },
              { relation: "والد", label: "+ والد" },
              { relation: "ابن", label: "+ ابن" },
              { relation: "ابنة", label: "+ ابنة" },
            ].map((item) => (
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
            <IndividualFields ind={newMember} onChange={(patch) => setNewMember((prev) => (prev ? { ...prev, ...patch } : prev))} />
            <button className="btn-primary w-full sm:w-auto" disabled={createMember.isPending} onClick={() => createMember.mutate(newMember)}>
              {createMember.isPending ? "جاري الإضافة..." : "حفظ الفرد الجديد في الاستمارة"}
            </button>
          </div>
        )}

        {members.map((member, idx) => (
          <div key={member.id ?? idx} className="card-elev p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="chip">{member.relation || "فرد"}</span>
                <span className="font-bold text-lg">
                  {member.first_name} {member.last_name}
                </span>
                {member.id ? <span className="text-xs text-muted-foreground">#{member.id}</span> : null}
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-primary"
                  disabled={saveMember.isPending}
                  onClick={() => saveMember.mutate(member)}
                >
                  حفظ
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
            <IndividualFields
              ind={member}
              onChange={(patch) =>
                setMembers((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)))
              }
            />
          </div>
        ))}

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
          <h2 className="font-bold text-lg">بيانات السجل والسكن</h2>
          <button className="btn-primary" disabled={saveFamily.isPending} onClick={() => saveFamily.mutate()}>
            {saveFamily.isPending ? "جاري الحفظ..." : "حفظ بيانات الاستمارة"}
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
            />
          </Field>
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
