import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "@/lib/registry";

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

function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });

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
    </div>
  );
}
