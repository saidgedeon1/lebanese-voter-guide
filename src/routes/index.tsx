import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { fetchStats, listFamilySummaries, POLITICAL_OPTIONS, type FamilySummary } from "@/lib/registry";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

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

function FamilyMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-black">{value}</div>
    </div>
  );
}

function formatAgeSummary(family: FamilySummary) {
  if (family.age_average === null) return "—";
  return `${family.age_average} / ${family.age_min ?? family.age_average}-${family.age_max ?? family.age_average}`;
}

function FamilyDetails({ family }: { family: FamilySummary }) {
  return (
    <div className="border-t border-border bg-muted/20 p-4 sm:p-5">
      <div className="grid gap-3 md:grid-cols-4">
        <FamilyMetric label="أعمار العائلة" value={formatAgeSummary(family)} />
        <FamilyMetric label="0-20 سنة" value={family.age_0_20} />
        <FamilyMetric label="21-39 سنة" value={family.age_21_39} />
        <FamilyMetric label="40-59 سنة" value={family.age_40_59} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="chip">+60: {family.age_60_plus}</span>
        <span className="chip">المؤيدون: {family.supporter_count}</span>
        <span className="chip">العسكريون: {family.military_count}</span>
        <span className="chip">قيد العائلة: {family.registry_town}</span>
        <span className="chip">القضاء: {family.registry_district}</span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-muted-foreground">
            <tr className="text-right">
              <th className="p-3 font-semibold">الاسم</th>
              <th className="p-3 font-semibold">القرابة</th>
              <th className="p-3 font-semibold">العمر</th>
              <th className="p-3 font-semibold">الميول</th>
              <th className="p-3 font-semibold">السكن</th>
            </tr>
          </thead>
          <tbody>
            {family.members.map((member) => {
              const age = member.birth_year ? new Date().getFullYear() - member.birth_year : null;

              return (
                <tr key={member.id} className="border-t border-border">
                  <td className="p-3 font-semibold">
                    {member.first_name} {member.last_name}
                  </td>
                  <td className="p-3">{member.relation}</td>
                  <td className="p-3">{age ?? "—"}</td>
                  <td className="p-3">{member.political_leaning || "—"}</td>
                  <td className="p-3 text-muted-foreground">{member.current_residence || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Dashboard() {
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("");
  const [town, setTown] = useState("");
  const [political, setPolitical] = useState("");
  const [expandedFamilyId, setExpandedFamilyId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });
  const {
    data: families,
    isLoading: isLoadingFamilies,
    error: familiesError,
  } = useQuery({
    queryKey: ["family-summaries", search, district, town, political],
    queryFn: () => listFamilySummaries({ search, district, town, political }),
  });

  const totals = useMemo(() => {
    const rows = families ?? [];
    return {
      members: rows.reduce((sum, family) => sum + family.member_count, 0),
      voters: rows.reduce((sum, family) => sum + family.eligible_voters, 0),
      male: rows.reduce((sum, family) => sum + family.male_count, 0),
      female: rows.reduce((sum, family) => sum + family.female_count, 0),
    };
  }, [families]);

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
            <Link to="/families/new" className="btn-primary">+ إضافة استمارة جديدة</Link>
            <Link to="/search" className="btn-ghost">البحث عن شخص</Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className="card-elev p-6 text-destructive">تعذّر تحميل الإحصائيات.</div>
      ) : (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="إجمالي الناخبين" value={isLoading ? 0 : data!.individuals} icon="🗳️" tone="oklch(0.55 0.14 155)" />
          <StatCard label="إجمالي المؤيدين" value={isLoading ? 0 : data!.supporters} icon="✅" tone="oklch(0.72 0.14 65)" />
          <StatCard label="العسكريون المستثنون" value={isLoading ? 0 : data!.military} icon="⚠️" tone="oklch(0.55 0.22 25)" />
          <StatCard label="إجمالي العائلات" value={isLoading ? 0 : data!.families} icon="🏠" tone="oklch(0.5 0.09 158)" />
        </section>
      )}

      <section className="grid md:grid-cols-3 gap-4">
        <Link to="/families/new" className="card-elev p-6 hover:shadow-lg transition">
          <div className="text-3xl mb-2">📝</div>
          <h3 className="font-bold text-lg">إدخال استمارة</h3>
          <p className="text-sm text-muted-foreground mt-1">أضف عائلة جديدة مع كامل أفرادها في خطوتين.</p>
        </Link>
        <Link to="/individuals" className="card-elev p-6 hover:shadow-lg transition">
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
                اعرض كل عائلة مع عدد الناخبين، الذكور، الإناث، والأعمار مع إمكانية التصفية والفتح التفصيلي.
              </p>
            </div>
            <Link to="/families/new" className="btn-ghost">
              إضافة عائلة جديدة
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="label-ar">بحث شامل</label>
              <input
                className="field"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="اسم عائلة، شخص، هاتف، بلدة..."
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
              <label className="label-ar">وجود ميول سياسية</label>
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
            <span className="chip">العائلات: {(families?.length ?? 0).toLocaleString("ar-EG")}</span>
            <span className="chip">الأفراد: {totals.members.toLocaleString("ar-EG")}</span>
            <span className="chip">الناخبون: {totals.voters.toLocaleString("ar-EG")}</span>
            <span className="chip">الذكور: {totals.male.toLocaleString("ar-EG")}</span>
            <span className="chip">الإناث: {totals.female.toLocaleString("ar-EG")}</span>
          </div>
        </div>

        {familiesError ? (
          <div className="p-6 text-destructive">تعذّر تحميل شبكة العائلات.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr className="text-right">
                  <th className="p-3 font-semibold">العائلة</th>
                  <th className="p-3 font-semibold">بلدة النفوس</th>
                  <th className="p-3 font-semibold">الأفراد</th>
                  <th className="p-3 font-semibold">الناخبون</th>
                  <th className="p-3 font-semibold">الذكور</th>
                  <th className="p-3 font-semibold">الإناث</th>
                  <th className="p-3 font-semibold">الأعمار</th>
                  <th className="p-3 font-semibold">التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingFamilies && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      جاري تحميل العائلات...
                    </td>
                  </tr>
                )}

                {!isLoadingFamilies && families?.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      لا توجد عائلات مطابقة للفلاتر الحالية.
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
                          <div className="text-xs text-muted-foreground">
                            استمارة #{family.id}
                            {family.registry_number ? ` · قيد ${family.registry_number}` : ""}
                          </div>
                        </td>
                        <td className="p-3">{family.registry_town}</td>
                        <td className="p-3 font-semibold">{family.member_count.toLocaleString("ar-EG")}</td>
                        <td className="p-3 font-semibold text-success">{family.eligible_voters.toLocaleString("ar-EG")}</td>
                        <td className="p-3">{family.male_count.toLocaleString("ar-EG")}</td>
                        <td className="p-3">{family.female_count.toLocaleString("ar-EG")}</td>
                        <td className="p-3">{formatAgeSummary(family)}</td>
                        <td className="p-3">
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
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t border-border">
                          <td colSpan={8} className="p-0">
                            <FamilyDetails family={family} />
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
