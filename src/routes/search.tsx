import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PersonFilesPanel } from "@/components/PersonFilesPanel";
import { PassportPhoto } from "@/components/PassportPhoto";
import {
  canVote,
  displayMaritalStatus,
  findSpouse,
  getFamilyMembers,
  inferGender,
  isDeceased,
  listFamilySummaries,
  normalizeArabic,
  normalizeRelation,
  searchByName,
  type Individual,
  type FamilyForm,
} from "@/lib/registry";

export const Route = createFileRoute("/search")({
  component: SearchPage,
});

function personLabel(person: Pick<Individual, "first_name" | "last_name" | "father_name">) {
  return [person.first_name, person.father_name, person.last_name].filter(Boolean).join(" ").trim();
}

function looksLikeRegistryNumber(value: string) {
  const t = value.trim();
  if (!t) return false;
  return /^[\d٠-٩]+([\/\-]?[\d٠-٩]+)?$/.test(t);
}

function SearchPage() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<(Individual & { family: FamilyForm }) | null>(null);
  const registryQuery = q.trim();
  const registryMode = looksLikeRegistryNumber(registryQuery);

  const { data: searchResult, isFetching, error: searchError } = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchByName(q),
    enabled: q.trim().length >= 1,
  });
  const results = searchResult?.results;
  const searchTruncated = searchResult?.truncated;

  const { data: registryFamilyResult, isFetching: registryFamiliesLoading } = useQuery({
    queryKey: ["family-summaries", "registry-search", registryQuery],
    queryFn: () => listFamilySummaries({ registryNumber: registryQuery }),
    enabled: registryMode,
  });
  const registryFamilies = registryFamilyResult?.families;

  const registryTotals = useMemo(() => {
    const rows = registryFamilies ?? [];
    return {
      families: rows.length,
      eligibleMale: rows.reduce((sum, f) => sum + f.eligible_male_voters, 0),
      eligibleFemale: rows.reduce((sum, f) => sum + f.eligible_female_voters, 0),
      eligible: rows.reduce((sum, f) => sum + f.eligible_voters, 0),
    };
  }, [registryFamilies]);

  const { data: family } = useQuery({
    queryKey: ["family-members", selected?.family_form_id],
    queryFn: () => getFamilyMembers(selected!.family_form_id),
    enabled: !!selected,
  });

  const spouse = selected && family ? findSpouse(selected, family) : null;
  const selectedIsWife =
    normalizeRelation(selected?.relation) === "زوجة" || normalizeRelation(selected?.relation) === "كنة";

  const familyVoteCounts = useMemo(() => {
    if (!family?.length) return null;
    let eligibleMale = 0;
    let eligibleFemale = 0;
    let eligible = 0;
    for (const m of family) {
      if (canVote(m.birth_year, m.is_military, m) !== true) continue;
      eligible += 1;
      const g = inferGender(m.relation);
      if (g === "male") eligibleMale += 1;
      if (g === "female") eligibleFemale += 1;
    }
    return { eligible, eligibleMale, eligibleFemale };
  }, [family]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black">محرك البحث الذكي</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ابحث بالاسم، الشهرة، الاسم الثلاثي، أو رقم السجل — بالعربي أو بالإنكليزي.
        </p>
      </div>

      <div className="card-elev p-5">
        <div className="relative">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
          <input
            className="field !pr-12 !py-4 !text-lg"
            placeholder="اسم، شهرة، رقم سجل..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSelected(null);
            }}
            autoFocus
          />
        </div>

        {registryMode && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="chip !bg-primary/15 !text-primary">سجل {registryQuery}</span>
              {registryFamiliesLoading ? (
                <span className="chip">جاري تحميل العائلات...</span>
              ) : (
                <>
                  <span className="chip">عائلات: {registryTotals.families.toLocaleString("ar-EG")}</span>
                  <span className="chip">ينتخب: {registryTotals.eligible.toLocaleString("ar-EG")}</span>
                  <span className="chip">ذكور ناخبون: {registryTotals.eligibleMale.toLocaleString("ar-EG")}</span>
                  <span className="chip">إناث ناخبات: {registryTotals.eligibleFemale.toLocaleString("ar-EG")}</span>
                </>
              )}
            </div>
            {!registryFamiliesLoading && registryFamilies && registryFamilies.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {registryFamilies.map((fam) => (
                  <div
                    key={fam.id}
                    className="rounded-lg border border-border p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold">{fam.family_name}</div>
                      <div className="text-xs text-muted-foreground">
                        استمارة #{fam.id} · {fam.registry_town} — {fam.registry_district} · {fam.member_count} أفراد
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm items-center">
                      <span className="chip">ذكور ناخبون: {fam.eligible_male_voters}</span>
                      <span className="chip">إناث ناخبات: {fam.eligible_female_voters}</span>
                      <Link to="/families/$id" params={{ id: String(fam.id) }} search={{}} className="btn-ghost">
                        تعديل
                      </Link>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          const first = fam.members[0];
                          if (!first) return;
                          setSelected({ ...first, family: fam });
                        }}
                      >
                        عرض الأفراد
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!registryFamiliesLoading && registryFamilies?.length === 0 && (
              <div className="text-sm text-muted-foreground p-2">ما في عائلات بهالرقم.</div>
            )}
          </div>
        )}

        {q.trim().length >= 1 && (
          <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
            {isFetching && <div className="text-sm text-muted-foreground p-3">جاري البحث...</div>}
            {searchError && (
              <div className="text-sm text-destructive p-3">تعذّر البحث: {(searchError as Error).message}</div>
            )}
            {!isFetching && !searchError && results?.length === 0 && !registryMode && (
              <div className="text-sm text-muted-foreground p-3">لا توجد نتائج مطابقة.</div>
            )}
            {searchTruncated ? (
              <div className="text-xs text-destructive p-2">البحث على أول ٥٠٠٠ فرد فقط — النتائج قد تكون ناقصة.</div>
            ) : null}
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
                      {r.first_name} {r.father_name || "—"} {r.last_name} · سجل {r.family?.registry_number || "—"} ·{" "}
                      {r.family?.registry_town || "—"}
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
                  <span className="chip !bg-destructive !text-destructive-foreground">عسكري — لا يحق له الاقتراع</span>
                )}
              </div>
            </div>
            <div className="flex items-start gap-4 mb-4">
              <PassportPhoto
                personId={selected.id}
                name={`${selected.first_name} ${selected.last_name}`}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <div className="text-3xl font-black mb-1 leading-tight">
                  {selected.first_name} {selected.last_name}
                </div>
                <div className="text-sm text-muted-foreground mb-1">
                  {selected.first_name} {selected.father_name || "—"} {selected.last_name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {normalizeRelation(selected.relation) || selected.relation}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              <Link
                to="/families/$id"
                params={{ id: String(selected.family_form_id) }}
                search={{ member: selected.id }}
                className="btn-primary"
              >
                تعديل هذا الفرد
              </Link>
              <Link
                to="/families/$id"
                params={{ id: String(selected.family_form_id) }}
                search={{ add: true }}
                className="btn-primary"
              >
                + إضافة فرد
              </Link>
              <Link
                to="/families/$id"
                params={{ id: String(selected.family_form_id) }}
                search={{}}
                hash="members"
                className="btn-ghost"
              >
                الاستمارة كاملة
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Info label="رقم السجل" v={selected.family?.registry_number} />
              <Info label="صلة القرابة" v={normalizeRelation(selected.relation) || selected.relation} />
              <Info label="الشهرة / العائلة" v={selected.last_name} />
              <Info
                label="الزوج / الزوجة"
                v={
                  !family
                    ? "جاري التحميل..."
                    : spouse
                      ? personLabel(spouse)
                      : "غير مسجّل في الاستمارة"
                }
              />
              {spouse &&
                (normalizeRelation(spouse.relation) === "زوجة" ||
                  normalizeRelation(spouse.relation) === "كنة") && (
                <Info label="عائلة الزوجة" v={spouse.last_name} />
              )}
              {selectedIsWife && <Info label="عائلتها (قبل الزواج)" v={selected.last_name} />}
              <Info label="اسم الأب" v={selected.father_name} />
              <Info label="اسم الأم" v={selected.mother_name} />
              <Info label="تاريخ الولادة" v={selected.birth_year?.toString()} />
              <Info label="الجوال" v={selected.mobile} />
              <Info label="الوضع العائلي" v={displayMaritalStatus(selected, spouse)} />
              <Info label="وضع الناخب" v={selected.voter_status} />
              <Info label="متوفّى" v={isDeceased(selected) ? "نعم" : "لا"} />
              <Info label="السكن مع الأهل" v={selected.lives_with_family == null ? null : selected.lives_with_family ? "نعم" : "لا"} />
              <Info label="عسكري" v={selected.is_military ? "نعم" : "لا"} />
              <Info label="اقترع" v={selected.has_voted ? "نعم" : "لا"} />
              <Info label="الميول السياسية" v={selected.political_leaning} />
              <Info label="الصوت التفضيلي" v={selected.preferred_candidate} />
              <Info label="المذهب" v={selected.family?.sect} />
              <div className="col-span-2">
                <Info label="السكن الفعلي" v={selected.current_residence} />
              </div>
              <div className="col-span-2">
                <Info
                  label="بلدة النفوس / القضاء"
                  v={`${selected.family?.registry_town ?? "—"} — ${selected.family?.registry_district ?? "—"}`}
                />
              </div>
              <div className="col-span-2">
                <Info
                  label="سكن الشتاء"
                  v={[
                    selected.family?.winter_town,
                    selected.family?.winter_district,
                    selected.family?.winter_governorate,
                    selected.family?.winter_country,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              </div>
              <div className="col-span-2">
                <Info
                  label="سكن الصيف"
                  v={[
                    selected.family?.summer_town,
                    selected.family?.summer_district,
                    selected.family?.summer_governorate,
                    selected.family?.summer_country,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              </div>
            </dl>

            <div className="mt-6 pt-5 border-t border-border">
              <PersonFilesPanel
                personId={selected.id}
                personName={`${selected.first_name} ${selected.last_name}`}
              />
            </div>
          </div>

          <div className="card-elev p-6">
            <h2 className="font-bold text-xl mb-2">شجرة العائلة</h2>
            {familyVoteCounts && (
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="chip">ينتخب: {familyVoteCounts.eligible}</span>
                <span className="chip">ذكور ناخبون: {familyVoteCounts.eligibleMale}</span>
                <span className="chip">إناث ناخبات: {familyVoteCounts.eligibleFemale}</span>
              </div>
            )}
            {!family && <div className="text-sm text-muted-foreground">جاري التحميل...</div>}
            {family && (
              <FamilyTree
                members={family}
                focus={selected}
                onSelect={(member) => {
                  if (member.id === selected.id) return;
                  setSelected({ ...member, family: selected.family });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
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

function FamilyTree({
  members,
  focus,
  onSelect,
}: {
  members: Individual[];
  focus: Individual;
  onSelect: (member: Individual) => void;
}) {
  const used = new Set<number>([focus.id]);

  const take = (list: Individual[]) => {
    const unique = list.filter((m) => !used.has(m.id));
    unique.forEach((m) => used.add(m.id));
    return unique;
  };

  // True children of focus: they list focus as أب or أم
  const children = take(
    members.filter(
      (m) =>
        m.id !== focus.id &&
        (normalizeArabic(m.father_name) === normalizeArabic(focus.first_name) ||
          normalizeArabic(m.mother_name) === normalizeArabic(focus.first_name)),
    ),
  );
  const childNames = new Set(children.map((c) => c.first_name));

  const spouses = take(
    [findSpouse(focus, members)].filter((m): m is Individual => !!m),
  );

  // In-laws: married to children of focus (كنة / صهر) — NOT children themselves
  const inLaws = take(
    members.filter((m) => {
      if (m.id === focus.id) return false;
      const rel = normalizeRelation(m.relation);
      if (rel === "كنة" || rel === "صهر") return true;
      // Parent of a grandchild whose other parent is focus's child
      return members.some(
        (kid) =>
          kid.id !== m.id &&
          ((kid.mother_name === m.first_name && kid.father_name && childNames.has(kid.father_name)) ||
            (kid.father_name === m.first_name && kid.mother_name && childNames.has(kid.mother_name))),
      );
    }),
  );

  const parents = take(
    members.filter((m) => {
      const rel = normalizeRelation(m.relation);
      return (
        rel === "والد" ||
        rel === "والدة" ||
        normalizeArabic(m.first_name) === normalizeArabic(focus.father_name) ||
        normalizeArabic(m.first_name) === normalizeArabic(focus.mother_name)
      );
    }),
  );

  const head = take(members.filter((m) => normalizeRelation(m.relation) === "رب العائلة" && m.id !== focus.id));
  const others = take(members.filter((m) => m.id !== focus.id));

  const groups: Array<[string, Individual[]]> = [
    ["رب العائلة", head],
    ["الزوج / الزوجة", spouses],
    ["الأب / الأم", parents],
    ["الأبناء", children],
    ["أزواج الأولاد", inLaws],
    ["أفراد آخرون", others],
  ];

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
              {list.map((m) => {
                const isFocus = m.id === focus.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={isFocus}
                    onClick={() => onSelect(m)}
                    className={`w-full text-right p-3 rounded-lg border flex items-center justify-between gap-2 transition ${
                      isFocus
                        ? "border-primary bg-primary/5 cursor-default"
                        : m.is_military
                          ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10 cursor-pointer"
                          : "border-border hover:bg-muted cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PassportPhoto personId={m.id} name={personLabel(m)} size="sm" />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm">
                          {personLabel(m)}
                          {isFocus && (
                            <span className="chip mr-2 !bg-primary !text-primary-foreground">أنت هنا</span>
                          )}
                          {!isFocus && (
                            <span className="text-xs text-primary font-medium mr-2">عرض الملف ←</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {normalizeRelation(m.relation) || m.relation || "غير محدد"}
                          {title === "الزوج / الزوجة" && normalizeRelation(m.relation) === "زوجة"
                            ? ` · عائلتها: ${m.last_name}`
                            : ""}
                          {m.birth_year ? ` · مواليد ${m.birth_year}` : ""}
                        </div>
                      </div>
                    </div>
                    {m.is_military && (
                      <span className="chip !bg-destructive !text-destructive-foreground shrink-0">عسكري</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ),
      )}
    </div>
  );
}
