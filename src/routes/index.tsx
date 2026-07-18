import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import {
  canVote,
  deleteFamilyForm,
  fetchStats,
  getAge,
  inferGender,
  listFamilySummaries,
  normalizeRelation,
  POLITICAL_OPTIONS,
  type FamilySummary,
  type Individual,
} from "@/lib/registry";
import { downloadFullBackup } from "@/lib/excel-import";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

type DashListMode =
  | "families"
  | "members"
  | "eligible"
  | "eligible_male"
  | "eligible_female"
  | "ineligible"
  | "unknown"
  | "male"
  | "female";

type ListedPerson = Individual & {
  family_name: string;
  registry_number: string | null;
  registry_town: string;
};

function personLabel(person: Pick<Individual, "first_name" | "last_name" | "father_name">) {
  return [person.first_name, person.father_name, person.last_name].filter(Boolean).join(" ").trim();
}

function dashListTitle(mode: DashListMode) {
  switch (mode) {
    case "families":
      return "قائمة العائلات";
    case "members":
      return "كل الأفراد";
    case "eligible":
      return "اللي بيقدروا ينتخبوا";
    case "eligible_male":
      return "ذكور ناخبون";
    case "eligible_female":
      return "إناث ناخبات";
    case "ineligible":
      return "اللي ما بيقدروا ينتخبوا";
    case "unknown":
      return "عمر / انتخاب غير محدد";
    case "male":
      return "كل الذكور";
    case "female":
      return "كل الإناث";
  }
}

function collectDashboardPeople(families: FamilySummary[], mode: DashListMode): ListedPerson[] {
  const people: ListedPerson[] = [];
  for (const family of families) {
    for (const member of family.members) {
      const vote = canVote(member.birth_year, member.is_military, member);
      const gender = inferGender(member.relation);
      let keep = false;
      if (mode === "members") keep = true;
      else if (mode === "eligible") keep = vote === true;
      else if (mode === "eligible_male") keep = vote === true && gender === "male";
      else if (mode === "eligible_female") keep = vote === true && gender === "female";
      else if (mode === "ineligible") keep = vote === false;
      else if (mode === "unknown") keep = vote === null;
      else if (mode === "male") keep = gender === "male";
      else if (mode === "female") keep = gender === "female";
      if (!keep) continue;
      people.push({
        ...member,
        family_name: family.family_name,
        registry_number: family.registry_number,
        registry_town: family.registry_town,
      });
    }
  }
  return people.sort((a, b) => a.first_name.localeCompare(b.first_name, "ar"));
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: string; tone: string }) {
  return (
    <div className="card-elev p-5 sm:p-6 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{ background: `radial-gradient(circle at 100% 0%, ${tone}, transparent 60%)` }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground font-medium">{label}</div>
          <div className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">
            {value.toLocaleString("ar-EG")}
          </div>
        </div>
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl"
          style={{ background: `color-mix(in oklab, ${tone} 18%, transparent)` }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function FamilyMetric({
  label,
  value,
  onClick,
  active,
}: {
  label: string;
  value: string | number;
  onClick?: () => void;
  active?: boolean;
}) {
  const className = `rounded-xl bg-muted/60 p-3 text-right w-full ${
    onClick ? "cursor-pointer hover:bg-primary/10 border border-transparent hover:border-primary/30 transition" : ""
  } ${active ? "!bg-primary/15 border-primary/40 border" : ""}`;
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
        <div className="mt-1 text-lg font-black">{value}</div>
      </button>
    );
  }
  return (
    <div className={className}>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-black">{value}</div>
    </div>
  );
}

function formatAgeSummary(family: FamilySummary) {
  if (family.age_average === null) return "—";
  return `${family.age_average} / ${family.age_min ?? family.age_average}-${family.age_max ?? family.age_average}`;
}

function FamilyDetails({
  family,
  onDeleted,
  onOpenList,
  activeList,
}: {
  family: FamilySummary;
  onDeleted?: () => void;
  onOpenList?: (mode: DashListMode) => void;
  activeList?: DashListMode | null;
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: () => deleteFamilyForm(family.id),
    onSuccess: async () => {
      setConfirmOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
        queryClient.invalidateQueries({ queryKey: ["family-summaries"] }),
        queryClient.invalidateQueries({ queryKey: ["individuals"] }),
        queryClient.invalidateQueries({ queryKey: ["family-members"] }),
        queryClient.invalidateQueries({ queryKey: ["search"] }),
      ]);
      onDeleted?.();
    },
  });

  return (
    <div className="border-t border-border bg-muted/20 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link to="/families/$id" params={{ id: String(family.id) }} search={{}} className="btn-primary">
          تعديل الاستمارة
        </Link>
        <button
          type="button"
          className="btn-ghost !text-destructive"
          disabled={deleteMutation.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          {deleteMutation.isPending ? "جاري الحذف..." : "حذف الاستمارة"}
        </button>
      </div>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={(open) => !open && !deleteMutation.isPending && setConfirmOpen(false)}
        title="تأكيد حذف الاستمارة"
        description={`هل أنت متأكد من حذف استمارة ${family.family_name} مع كل أفرادها؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="تأكيد حذف الاستمارة"
        pending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <FamilyMetric
          label="بيقدر ينتخب"
          value={family.eligible_voters}
          active={activeList === "eligible"}
          onClick={onOpenList ? () => onOpenList("eligible") : undefined}
        />
        <FamilyMetric
          label="ذكور ناخبون"
          value={family.eligible_male_voters}
          active={activeList === "eligible_male"}
          onClick={onOpenList ? () => onOpenList("eligible_male") : undefined}
        />
        <FamilyMetric
          label="إناث ناخبات"
          value={family.eligible_female_voters}
          active={activeList === "eligible_female"}
          onClick={onOpenList ? () => onOpenList("eligible_female") : undefined}
        />
        <FamilyMetric
          label="ما بيقدر ينتخب"
          value={family.ineligible_voters}
          active={activeList === "ineligible"}
          onClick={onOpenList ? () => onOpenList("ineligible") : undefined}
        />
        <FamilyMetric
          label="غير محدد"
          value={family.unknown_voters}
          active={activeList === "unknown"}
          onClick={onOpenList ? () => onOpenList("unknown") : undefined}
        />
        <FamilyMetric label="أعمار العائلة" value={formatAgeSummary(family)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="chip">رقم السجل: {family.registry_number || "—"}</span>
        <span className="chip">قيد العائلة: {family.registry_town}</span>
        <span className="chip">القضاء: {family.registry_district}</span>
        <span className="chip">0-20: {family.age_0_20}</span>
        <span className="chip">21-39: {family.age_21_39}</span>
        <span className="chip">40-59: {family.age_40_59}</span>
        <span className="chip">+60: {family.age_60_plus}</span>
        <span className="chip">منتمون لحزب: {family.supporter_count}</span>
        <span className="chip">العسكريون: {family.military_count}</span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-muted-foreground">
            <tr className="text-right">
              <th className="p-3 font-semibold">الاسم</th>
              <th className="p-3 font-semibold">القرابة</th>
              <th className="p-3 font-semibold">العمر</th>
              <th className="p-3 font-semibold">الانتخاب</th>
              <th className="p-3 font-semibold">الميول</th>
              <th className="p-3 font-semibold">السكن</th>
              <th className="p-3 font-semibold">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {family.members.map((member) => {
              const age = getAge(member.birth_year);
              const vote = canVote(member.birth_year, member.is_military, member);
              const voteLabel = vote === true ? "نعم" : vote === false ? "لا" : "غير محدد";
              const voteClass =
                vote === true ? "text-success font-semibold" : vote === false ? "text-destructive font-semibold" : "text-muted-foreground";

              return (
                <tr key={member.id} className="border-t border-border">
                  <td className="p-3 font-semibold">
                    {member.first_name} {member.last_name}
                  </td>
                  <td className="p-3">{member.relation}</td>
                  <td className="p-3">{age ?? "—"}</td>
                  <td className={`p-3 ${voteClass}`}>{voteLabel}</td>
                  <td className="p-3">{member.political_leaning || "—"}</td>
                  <td className="p-3 text-muted-foreground">{member.current_residence || "—"}</td>
                  <td className="p-3">
                    <Link
                      to="/families/$id"
                      params={{ id: String(family.id) }}
                      search={{ member: member.id }}
                      className="text-primary font-semibold hover:underline"
                    >
                      تعديل
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {deleteMutation.error && (
        <div className="mt-3 text-sm text-destructive">{(deleteMutation.error as Error).message}</div>
      )}
    </div>
  );
}

function Dashboard() {
  const [search, setSearch] = useState("");
  const [registryNumber, setRegistryNumber] = useState("");
  const [district, setDistrict] = useState("");
  const [town, setTown] = useState("");
  const [political, setPolitical] = useState("");
  const [expandedFamilyId, setExpandedFamilyId] = useState<number | null>(null);
  const [listMode, setListMode] = useState<DashListMode | null>(null);
  const [listFamilyId, setListFamilyId] = useState<number | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });
  const {
    data: familyResult,
    isLoading: isLoadingFamilies,
    error: familiesError,
  } = useQuery({
    queryKey: ["family-summaries", search, registryNumber, district, town, political],
    queryFn: () =>
      listFamilySummaries({ search, registryNumber, district, town, political }),
  });
  const families = familyResult?.families;
  const familiesTruncated = familyResult?.truncated;

  const totals = useMemo(() => {
    const rows = families ?? [];
    return {
      members: rows.reduce((sum, family) => sum + family.member_count, 0),
      voters: rows.reduce((sum, family) => sum + family.eligible_voters, 0),
      eligibleMale: rows.reduce((sum, family) => sum + family.eligible_male_voters, 0),
      eligibleFemale: rows.reduce((sum, family) => sum + family.eligible_female_voters, 0),
      ineligible: rows.reduce((sum, family) => sum + family.ineligible_voters, 0),
      unknown: rows.reduce((sum, family) => sum + family.unknown_voters, 0),
      male: rows.reduce((sum, family) => sum + family.male_count, 0),
      female: rows.reduce((sum, family) => sum + family.female_count, 0),
    };
  }, [families]);

  const openList = (mode: DashListMode, familyId: number | null = null) => {
    if (listMode === mode && listFamilyId === familyId) {
      setListMode(null);
      setListFamilyId(null);
      return;
    }
    setListMode(mode);
    setListFamilyId(familyId);
  };

  const listFamilies = useMemo(() => {
    if (!families) return [];
    if (listFamilyId == null) return families;
    return families.filter((f) => f.id === listFamilyId);
  }, [families, listFamilyId]);

  const listPeople = useMemo(() => {
    if (!listMode || listMode === "families") return [];
    return collectDashboardPeople(listFamilies, listMode);
  }, [listMode, listFamilies]);

  const ChipBtn = ({
    mode,
    label,
    count,
    familyId = null,
  }: {
    mode: DashListMode;
    label: string;
    count: number;
    familyId?: number | null;
  }) => (
    <button
      type="button"
      className={`chip cursor-pointer border border-border hover:bg-primary hover:text-primary-foreground transition disabled:opacity-40 disabled:cursor-not-allowed ${
        listMode === mode && listFamilyId === familyId ? "!bg-primary !text-primary-foreground" : ""
      }`}
      onClick={() => openList(mode, familyId)}
      disabled={count === 0}
    >
      {label}: {count.toLocaleString("ar-EG")}
    </button>
  );

  return (
    <div className="space-y-8">
      <section className="card-elev p-6 sm:p-10 relative overflow-hidden">
        <div
          className="absolute -top-24 -left-24 h-64 w-64 rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--accent)" }}
        />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="chip mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              متصل بقاعدة البيانات
            </div>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight">
              أهلاً بك في الماكينة الانتخابية
            </h1>
            <p className="mt-2 text-muted-foreground max-w-xl">
              أدر الاستمارات العائلية، تابع الناخبين، وحلّل الميول السياسية بواجهة عربية كاملة.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={backupBusy}
              onClick={async () => {
                setBackupBusy(true);
                setBackupMessage(null);
                setBackupError(null);
                try {
                  const result = await downloadFullBackup();
                  setBackupMessage(
                    `تم التحميل: ${result.families.toLocaleString("ar-EG")} عيلة و ${result.people.toLocaleString("ar-EG")} فرد (Excel + JSON).`,
                  );
                } catch (err) {
                  setBackupError((err as Error).message || "تعذّر إنشاء النسخة الاحتياطية.");
                } finally {
                  setBackupBusy(false);
                }
              }}
            >
              {backupBusy ? "جاري تجهيز النسخة..." : "تحميل نسخة احتياطية ↓"}
            </button>
            <Link to="/families/new" className="btn-primary">+ إضافة استمارة جديدة</Link>
            <Link to="/import" className="btn-ghost">استيراد Excel</Link>
            <Link to="/search" className="btn-ghost">البحث عن شخص</Link>
          </div>
        </div>
        {backupMessage ? (
          <div className="relative mt-4 text-sm font-semibold text-success">{backupMessage}</div>
        ) : null}
        {backupError ? (
          <div className="relative mt-4 text-sm text-destructive">{backupError}</div>
        ) : null}
      </section>

      {error ? (
        <div className="card-elev p-6 text-destructive">تعذّر تحميل الإحصائيات.</div>
      ) : (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="إجمالي الأفراد" value={isLoading ? 0 : data!.individuals} icon="🗳️" tone="oklch(0.55 0.14 155)" />
          <StatCard label="العايشون" value={isLoading ? 0 : data!.living} icon="💚" tone="oklch(0.58 0.12 145)" />
          <StatCard label="المتوفون" value={isLoading ? 0 : data!.deceased} icon="🕯️" tone="oklch(0.45 0.02 260)" />
          <StatCard label="منتمون لحزب" value={isLoading ? 0 : data!.supporters} icon="🤝" tone="oklch(0.72 0.14 65)" />
          <StatCard label="العسكريون المستثنون" value={isLoading ? 0 : data!.military} icon="⚠️" tone="oklch(0.55 0.22 25)" />
          <StatCard label="إجمالي العائلات" value={isLoading ? 0 : data!.families} icon="🏠" tone="oklch(0.5 0.09 158)" />
          <Link
            to="/individuals"
            search={{ filter: "unknown_age" }}
            className="card-elev p-5 sm:p-6 relative overflow-hidden col-span-2 hover:shadow-lg transition"
          >
            <div
              className="absolute inset-0 opacity-[0.08] pointer-events-none"
              style={{ background: "radial-gradient(circle at 100% 0%, oklch(0.65 0.16 55), transparent 60%)" }}
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-muted-foreground font-medium">عمر غير محدد — أحياء فقط</div>
                <div className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">
                  {(isLoading ? 0 : data!.unknown_age).toLocaleString("ar-EG")}
                </div>
                <div className="mt-2 text-sm text-primary font-semibold">افتح القائمة ←</div>
              </div>
              <div
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl"
                style={{ background: "color-mix(in oklab, oklch(0.65 0.16 55) 18%, transparent)" }}
              >
                🔎
              </div>
            </div>
          </Link>
        </section>
      )}

      <section className="grid md:grid-cols-4 gap-4">
        <Link to="/families/new" className="card-elev p-6 hover:shadow-lg transition">
          <div className="text-3xl mb-2">📝</div>
          <h3 className="font-bold text-lg">إدخال استمارة</h3>
          <p className="text-sm text-muted-foreground mt-1">أضف عائلة جديدة مع كامل أفرادها في خطوتين.</p>
        </Link>
        <Link to="/import" className="card-elev p-6 hover:shadow-lg transition">
          <div className="text-3xl mb-2">📥</div>
          <h3 className="font-bold text-lg">استيراد Excel</h3>
          <p className="text-sm text-muted-foreground mt-1">ارفع ملف إكسل لاستيراد عائلات وأفراد دفعة واحدة.</p>
        </Link>
        <Link to="/individuals" search={{}} className="card-elev p-6 hover:shadow-lg transition">
          <div className="text-3xl mb-2">📋</div>
          <h3 className="font-bold text-lg">قائمة الأفراد</h3>
          <p className="text-sm text-muted-foreground mt-1">فرز حسب السكن، الميول السياسية، وبلدة النفوس.</p>
        </Link>
        <Link to="/search" className="card-elev p-6 hover:shadow-lg transition">
          <div className="text-3xl mb-2">🔍</div>
          <h3 className="font-bold text-lg">محرك البحث الذكي</h3>
          <p className="text-sm text-muted-foreground mt-1">ابحث بالاسم واستعرض شجرة العائلة تلقائياً.</p>
        </Link>
      </section>

      <section className="card-elev overflow-hidden">
        <div className="p-6 sm:p-7 border-b border-border">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-black">شبكة العائلات</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ابحث باسم شخص أو رقم سجل — البحث بيلاقي العيلة حتى لو مش من آخر ٥٠٠ استمارة.
              </p>
            </div>
            <Link to="/families/new" className="btn-ghost">
              إضافة عائلة جديدة
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="label-ar">رقم السجل</label>
              <input
                className="field"
                value={registryNumber}
                onChange={(e) => setRegistryNumber(e.target.value)}
                placeholder="مثال: 123"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="label-ar">بحث شامل</label>
              <input
                className="field"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="اسم، هاتف، بلدة، رقم سجل..."
              />
            </div>
            <div>
              <label className="label-ar">القضاء</label>
              <input
                className="field"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="بحث جزئي..."
              />
            </div>
            <div>
              <label className="label-ar">بلدة النفوس</label>
              <input
                className="field"
                value={town}
                onChange={(e) => setTown(e.target.value)}
                placeholder="بحث جزئي..."
              />
            </div>
            <div>
              <label className="label-ar">الحزب / الميول</label>
              <select className="field" value={political} onChange={(e) => setPolitical(e.target.value)}>
                <option value="">— الكل —</option>
                {POLITICAL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <ChipBtn mode="families" label="العائلات" count={families?.length ?? 0} />
            {registryNumber.trim() ? (
              <span className="chip !bg-primary/15 !text-primary">سجل {registryNumber.trim()}</span>
            ) : null}
            {familiesTruncated ? (
              <span className="chip !bg-destructive/15 !text-destructive">عرض أول ٥٠٠ عائلة فقط</span>
            ) : null}
            <ChipBtn mode="members" label="الأفراد" count={totals.members} />
            <ChipBtn mode="eligible" label="بيقدر ينتخب" count={totals.voters} />
            <ChipBtn mode="eligible_male" label="ذكور ناخبون" count={totals.eligibleMale} />
            <ChipBtn mode="eligible_female" label="إناث ناخبات" count={totals.eligibleFemale} />
            <ChipBtn mode="ineligible" label="ما بيقدر" count={totals.ineligible} />
            {totals.unknown > 0 ? <ChipBtn mode="unknown" label="غير محدد" count={totals.unknown} /> : null}
            <ChipBtn mode="male" label="الذكور" count={totals.male} />
            <ChipBtn mode="female" label="الإناث" count={totals.female} />
          </div>

          {listMode && (
            <div className="mt-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-bold text-lg">{dashListTitle(listMode)}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {listMode === "families"
                      ? `${listFamilies.length.toLocaleString("ar-EG")} عائلة`
                      : `${listPeople.length.toLocaleString("ar-EG")} شخص`}
                    {listFamilyId != null ? " · من العيلة المفتوحة" : " · حسب الفلاتر الحالية"}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setListMode(null);
                    setListFamilyId(null);
                  }}
                >
                  إغلاق القائمة
                </button>
              </div>

              {listMode === "families" ? (
                listFamilies.length === 0 ? (
                  <div className="text-sm text-muted-foreground">ما في عائلات.</div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {listFamilies.map((family) => (
                      <div
                        key={family.id}
                        className="rounded-lg border border-border bg-card p-3 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold">{family.family_name}</div>
                          <div className="text-xs text-muted-foreground">
                            استمارة #{family.id} · سجل {family.registry_number || "—"} · {family.registry_town} ·{" "}
                            {family.member_count} أفراد · ينتخب {family.eligible_voters}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => setExpandedFamilyId(family.id)}
                          >
                            عرض
                          </button>
                          <Link
                            to="/families/$id"
                            params={{ id: String(family.id) }}
                            search={{}}
                            className="btn-primary"
                          >
                            تعديل
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : listPeople.length === 0 ? (
                <div className="text-sm text-muted-foreground">ما في أشخاص بهالتصنيف.</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {listPeople.map((person) => {
                    const age = getAge(person.birth_year);
                    const vote = canVote(person.birth_year, person.is_military, person);
                    return (
                      <div
                        key={`${person.family_form_id}-${person.id}`}
                        className="rounded-lg border border-border bg-card p-3 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold">
                            {personLabel(person)}
                            <span className="chip mr-2">
                              {normalizeRelation(person.relation) || person.relation}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {person.family_name} · سجل {person.registry_number || "—"} · {person.registry_town}
                            {age != null ? ` · عمر ${age}` : ""}
                            {" · "}
                            {vote === true ? "ينتخب" : vote === false ? "لا ينتخب" : "غير محدد"}
                          </div>
                        </div>
                        <Link
                          to="/families/$id"
                          params={{ id: String(person.family_form_id) }}
                          search={{ member: person.id }}
                          className="btn-primary"
                        >
                          تعديل
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {familiesError ? (
          <div className="p-6 text-destructive">تعذّر تحميل شبكة العائلات.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr className="text-right">
                  <th className="p-3 font-semibold">العائلة</th>
                  <th className="p-3 font-semibold">رقم السجل</th>
                  <th className="p-3 font-semibold">بلدة النفوس</th>
                  <th className="p-3 font-semibold">الأفراد</th>
                  <th className="p-3 font-semibold">ينتخب</th>
                  <th className="p-3 font-semibold">ذكور ناخبون</th>
                  <th className="p-3 font-semibold">إناث ناخبات</th>
                  <th className="p-3 font-semibold">لا ينتخب</th>
                  <th className="p-3 font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingFamilies && (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-muted-foreground">
                      جاري تحميل العائلات...
                    </td>
                  </tr>
                )}

                {!isLoadingFamilies && families?.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-muted-foreground">
                      {registryNumber.trim()
                        ? `ما في عائلات برقم السجل ${registryNumber.trim()}.`
                        : "لا توجد عائلات مطابقة للفلاتر الحالية."}
                    </td>
                  </tr>
                )}

                {families?.map((family) => {
                  const isExpanded = expandedFamilyId === family.id;

                  return (
                    <Fragment key={family.id}>
                      <tr
                        className="border-t border-border hover:bg-muted/30 cursor-pointer"
                        onClick={() => setExpandedFamilyId(isExpanded ? null : family.id)}
                      >
                        <td className="p-3">
                          <div className="font-bold">{family.family_name}</div>
                          <div className="text-xs text-muted-foreground">استمارة #{family.id}</div>
                        </td>
                        <td className="p-3 font-semibold">{family.registry_number || "—"}</td>
                        <td className="p-3">{family.registry_town}</td>
                        <td className="p-3 font-semibold">{family.member_count.toLocaleString("ar-EG")}</td>
                        <td className="p-3 font-semibold text-success">
                          {family.eligible_voters.toLocaleString("ar-EG")}
                        </td>
                        <td className="p-3 font-semibold text-success">
                          {family.eligible_male_voters.toLocaleString("ar-EG")}
                        </td>
                        <td className="p-3 font-semibold text-success">
                          {family.eligible_female_voters.toLocaleString("ar-EG")}
                        </td>
                        <td className="p-3 font-semibold text-destructive">
                          {family.ineligible_voters.toLocaleString("ar-EG")}
                          {family.unknown_voters > 0 ? (
                            <span className="text-muted-foreground font-normal text-xs">
                              {" "}
                              (+{family.unknown_voters} غير محدد)
                            </span>
                          ) : null}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn-ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedFamilyId(isExpanded ? null : family.id);
                              }}
                            >
                              {isExpanded ? "إخفاء" : "عرض"}
                            </button>
                            <Link
                              to="/families/$id"
                              params={{ id: String(family.id) }}
                              search={{}}
                              className="btn-primary"
                              onClick={(event) => event.stopPropagation()}
                            >
                              تعديل
                            </Link>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t border-border">
                          <td colSpan={9} className="p-0">
                            <FamilyDetails
                              family={family}
                              onDeleted={() => setExpandedFamilyId(null)}
                              activeList={listFamilyId === family.id ? listMode : null}
                              onOpenList={(mode) => openList(mode, family.id)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
