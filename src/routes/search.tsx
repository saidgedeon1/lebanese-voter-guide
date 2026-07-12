import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  getFamilyMembers,
  normalizeRelation,
  searchByName,
  type Individual,
  type FamilyForm,
} from "@/lib/registry";

export const Route = createFileRoute("/search")({
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<(Individual & { family: FamilyForm }) | null>(null);

  const { data: results, isFetching, error: searchError } = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchByName(q),
    enabled: q.trim().length >= 1,
  });

  const { data: family } = useQuery({
    queryKey: ["family-members", selected?.family_form_id],
    queryFn: () => getFamilyMembers(selected!.family_form_id),
    enabled: !!selected,
  });

  const spouse = family?.find((member) => {
    if (!selected) return false;
    if (member.id === selected.id) return false;
    const relation = normalizeRelation(member.relation);
    const selectedRelation = normalizeRelation(selected.relation);
    if (selectedRelation === "زوج" || selectedRelation === "رب العائلة" || selectedRelation === "والد") {
      return relation === "زوجة";
    }
    if (selectedRelation === "زوجة" || selectedRelation === "والدة") {
      return relation === "زوج" || relation === "رب العائلة";
    }
    return relation === "زوج" || relation === "زوجة";
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black">محرك البحث الذكي</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ابحث بالاسم، الشهرة، أو الاسم الثلاثي (الاسم + اسم الأب + العائلة).
        </p>
      </div>

      <div className="card-elev p-5">
        <div className="relative">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
          <input
            className="field !pr-12 !py-4 !text-lg"
            placeholder="اسم، اسم ثلاثي (الاسم الأب العائلة)، أو شهرة..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSelected(null);
            }}
            autoFocus
          />
        </div>

        {q.trim().length >= 1 && (
          <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
            {isFetching && <div className="text-sm text-muted-foreground p-3">جاري البحث...</div>}
            {searchError && (
              <div className="text-sm text-destructive p-3">تعذّر البحث: {(searchError as Error).message}</div>
            )}
            {!isFetching && !searchError && results?.length === 0 && (
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
                      <span className="chip mr-2">{normalizeRelation(r.relation) || r.relation}</span>
                      {r.is_military && (
                        <span className="chip !bg-destructive !text-destructive-foreground mr-2">عسكري</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      أب: {r.father_name || "—"} · أم: {r.mother_name || "—"} · {r.family?.registry_town || "—"}
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
              <div className="flex flex-wrap gap-2">
                {selected.is_military && (
                  <span className="chip !bg-destructive !text-destructive-foreground">
                    ⚠️ عسكري — لا يحق له الاقتراع
                  </span>
                )}
                <Link to="/families/$id" params={{ id: String(selected.family_form_id) }} className="btn-ghost">
                  تعديل الاستمارة
                </Link>
              </div>
            </div>
            <div className="text-3xl font-black mb-4">
              {selected.first_name} {selected.last_name}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Info label="صلة القرابة" v={normalizeRelation(selected.relation) || selected.relation} />
              <Info
                label="الزوج / الزوجة"
                v={spouse ? `${spouse.first_name} ${spouse.last_name}` : "غير مسجّل في الاستمارة"}
              />
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
                <Info
                  label="بلدة النفوس / القضاء"
                  v={`${selected.family?.registry_town ?? ""} — ${selected.family?.registry_district ?? ""}`}
                />
              </div>
            </dl>
          </div>

          <div className="card-elev p-6">
            <h2 className="font-bold text-xl mb-4">شجرة العائلة</h2>
            {!family && <div className="text-sm text-muted-foreground">جاري التحميل...</div>}
            {family && <FamilyTree members={family} focusId={selected.id} />}
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
  const groupedIds = new Set<number>();

  const makeGroup = (title: string, relations: string[]) => {
    const list = members.filter((m) => relations.includes(normalizeRelation(m.relation)));
    list.forEach((m) => groupedIds.add(m.id));
    return [title, list] as const;
  };

  const groups = [
    makeGroup("رب العائلة", ["رب العائلة"]),
    makeGroup("الزوج / الزوجة", ["زوج", "زوجة"]),
    makeGroup("الأب / الأم", ["والد", "والدة"]),
    makeGroup("الأبناء", ["ابن", "ابنة"]),
  ];

  const others = members.filter((m) => !groupedIds.has(m.id));
  if (others.length) {
    groups.push(["أفراد آخرون", others]);
  }

  if (members.length === 0) {
    return <div className="text-sm text-muted-foreground">لا يوجد أفراد مسجّلون في هذه الاستمارة.</div>;
  }

  return (
    <div className="space-y-5">
      {groups.map(([title, list]) =>
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
                      {m.id === focusId && (
                        <span className="chip mr-2 !bg-primary !text-primary-foreground">أنت هنا</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {normalizeRelation(m.relation) || m.relation || "غير محدد"}
                      {m.birth_year ? ` · مواليد ${m.birth_year}` : ""}
                    </div>
                  </div>
                  {m.is_military && (
                    <span className="chip !bg-destructive !text-destructive-foreground shrink-0">عسكري</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}
