import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getFamilyMembers, searchByName, type Individual, type FamilyForm } from "@/lib/registry";

export const Route = createFileRoute("/search")({
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<(Individual & { family: FamilyForm }) | null>(null);

  const { data: results, isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchByName(q),
    enabled: q.trim().length > 1,
  });

  const { data: family } = useQuery({
    queryKey: ["family", selected?.family_form_id],
    queryFn: () => getFamilyMembers(selected!.family_form_id),
    enabled: !!selected,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black">محرك البحث الذكي</h1>
        <p className="text-sm text-muted-foreground mt-1">ابحث بأي اسم لعرض الملف الشخصي وشجرة العائلة تلقائياً.</p>
      </div>

      <div className="card-elev p-5">
        <div className="relative">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
          <input
            className="field !pr-12 !py-4 !text-lg"
            placeholder="اكتب اسم شخص، اسم عائلة، أو اسم أب..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setSelected(null); }}
            autoFocus
          />
        </div>

        {q.trim().length > 1 && (
          <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
            {isFetching && <div className="text-sm text-muted-foreground p-3">جاري البحث...</div>}
            {!isFetching && results?.length === 0 && (
              <div className="text-sm text-muted-foreground p-3">لا توجد نتائج مطابقة.</div>
            )}
            {results?.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`w-full text-right p-3 rounded-lg border transition ${
                  selected?.id === r.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {r.first_name} {r.last_name}
                      {r.is_military && <span className="chip !bg-destructive !text-destructive-foreground mr-2">عسكري</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ابن {r.father_name || "—"} · {r.family?.registry_town || "—"}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">استمارة #{r.family_form_id}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card-elev p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-bold text-xl">الملف الشخصي</h2>
              {selected.is_military && (
                <span className="chip !bg-destructive !text-destructive-foreground">
                  ⚠️ عسكري — لا يحق له الاقتراع
                </span>
              )}
            </div>
            <div className="text-3xl font-black mb-4">
              {selected.first_name} {selected.last_name}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Info label="صلة القرابة" v={selected.relation} />
              <Info label="اسم الأب" v={selected.father_name} />
              <Info label="اسم الأم" v={selected.mother_name} />
              <Info label="التولد" v={selected.birth_year?.toString()} />
              <Info label="الجوال" v={selected.mobile} />
              <Info label="الوضع العائلي" v={selected.marital_status} />
              <Info label="وضع الناخب" v={selected.voter_status} />
              <Info label="السكن مع الأهل" v={selected.lives_with_family ? "نعم" : "لا"} />
              <Info label="الميول السياسية" v={selected.political_leaning} />
              <Info label="الصوت التفضيلي" v={selected.preferred_candidate} />
              <div className="col-span-2">
                <Info label="السكن الفعلي" v={selected.current_residence} />
              </div>
              <div className="col-span-2">
                <Info label="بلدة النفوس / القضاء" v={`${selected.family?.registry_town ?? ""} — ${selected.family?.registry_district ?? ""}`} />
              </div>
            </dl>
          </div>

          <div className="card-elev p-6">
            <h2 className="font-bold text-xl mb-4">شجرة العائلة</h2>
            {!family && <div className="text-sm text-muted-foreground">جاري التحميل...</div>}
            {family && (
              <FamilyTree members={family} focusId={selected.id} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, v }: { label: string; v?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground font-semibold">{label}</dt>
      <dd className="font-medium">{v || "—"}</dd>
    </div>
  );
}

function FamilyTree({ members, focusId }: { members: Individual[]; focusId: number }) {
  const groups: Record<string, Individual[]> = {
    "رب العائلة": members.filter((m) => m.relation === "رب العائلة"),
    "الأب / الأم": members.filter((m) => ["والد", "والدة"].includes(m.relation)),
    "الزوج / الزوجة": members.filter((m) => ["زوج", "زوجة"].includes(m.relation)),
    "الأبناء": members.filter((m) => ["ابن", "ابنة"].includes(m.relation)),
  };
  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([title, list]) =>
        list.length === 0 ? null : (
          <div key={title}>
            <div className="text-xs font-bold text-muted-foreground mb-2">{title}</div>
            <div className="space-y-2">
              {list.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                    m.id === focusId
                      ? "border-primary bg-primary/5"
                      : m.is_military
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">
                      {m.first_name} {m.last_name}
                      {m.id === focusId && <span className="chip mr-2 !bg-primary !text-primary-foreground">أنت هنا</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.relation}{m.birth_year ? ` · مواليد ${m.birth_year}` : ""}
                    </div>
                  </div>
                  {m.is_military && (
                    <span className="chip !bg-destructive !text-destructive-foreground shrink-0">عسكري</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
