import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PersonFilesPanel } from "@/components/PersonFilesPanel";
import { PassportPhoto } from "@/components/PassportPhoto";
import {
  canVote,
  deleteIndividual,
  displayMaritalStatus,
  findSpouse,
  getAge,
  getFamilyMembers,
  isDeceased,
  listIndividuals,
  normalizeRelation,
  POLITICAL_OPTIONS,
  type FamilyForm,
  type Individual,
} from "@/lib/registry";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

export const Route = createFileRoute("/individuals")({
  component: IndividualsList,
});

type ListedIndividual = Individual & {
  family: FamilyForm;
  spouse_name?: string | null;
};

function IndividualsList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [residence, setResidence] = useState("");
  const [political, setPolitical] = useState("");
  const [town, setTown] = useState("");
  const [voterFilter, setVoterFilter] = useState<"" | "voted" | "deceased" | "expat" | "military">("");
  const [viewing, setViewing] = useState<ListedIndividual | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ListedIndividual | null>(null);

  const { data: listResult, isLoading, refetch } = useQuery({
    queryKey: ["individuals", search, residence, political, town, voterFilter],
    queryFn: () => listIndividuals({ search, residence, political, town, voterFilter }),
  });
  const data = listResult?.people;
  const truncated = listResult?.truncated;

  const { data: familyMembers, isLoading: familyLoading } = useQuery({
    queryKey: ["family-members", viewing?.family_form_id],
    queryFn: () => getFamilyMembers(viewing!.family_form_id),
    enabled: !!viewing,
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteIndividual(id),
    onSuccess: async () => {
      setPendingDelete(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
        queryClient.invalidateQueries({ queryKey: ["family-summaries"] }),
        queryClient.invalidateQueries({ queryKey: ["individuals"] }),
        queryClient.invalidateQueries({ queryKey: ["family-members"] }),
        queryClient.invalidateQueries({ queryKey: ["search"] }),
      ]);
      await refetch();
    },
  });

  const exportCsv = () => {
    if (!data) return;
    const headers = [
      "رقم السجل",
      "الاسم",
      "الشهرة",
      "اسم الأب",
      "اسم الأم",
      "الزوج/الزوجة",
      "صلة القرابة",
      "بلدة النفوس",
      "السكن الحالي",
      "الميول",
      "يحق له الاقتراع",
      "اقترع",
      "متوفّى",
      "الجوال",
      "عسكري",
    ];
    const rows = data.map((r) => {
      const eligible = canVote(r.birth_year, r.is_military, r);
      return [
        r.family?.registry_number ?? "",
        r.first_name,
        r.last_name,
        r.father_name ?? "",
        r.mother_name ?? "",
        r.spouse_name ?? "",
        r.relation,
        r.family?.registry_town ?? "",
        r.current_residence ?? "",
        r.political_leaning ?? "",
        eligible === null ? "غير محدد" : eligible ? "نعم" : "لا",
        r.has_voted ? "نعم" : "لا",
        isDeceased(r) ? "نعم" : "لا",
        r.mobile ?? "",
        r.is_military ? "نعم" : "لا",
      ];
    });
    const csv =
      "\uFEFF" +
      [headers, ...rows]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "individuals.csv";
    a.click();
  };

  const spouseFromFamily =
    viewing && familyMembers ? findSpouse(viewing, familyMembers) : null;

  const eligible = viewing ? canVote(viewing.birth_year, viewing.is_military, viewing) : null;
  const age = viewing ? getAge(viewing.birth_year) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black">قائمة الأفراد</h1>
          <p className="text-sm text-muted-foreground mt-1">
            كل الأشخاص المسجّلين: رب العائلة، الزوجة، الأم، الأولاد، وجميع الأفراد.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="chip">المعروض: {(data?.length ?? 0).toLocaleString("ar-EG")}</span>
          {truncated ? (
            <span className="chip !bg-destructive/15 !text-destructive">عرض أول ٥٠٠٠ فرد فقط</span>
          ) : null}
          <button className="btn-primary" onClick={exportCsv} disabled={!data?.length}>
            تصدير CSV ↓
          </button>
        </div>
      </div>

      <div className="card-elev p-4 sm:p-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="label-ar">بحث بالاسم / الأب / الأم</label>
          <input
            className="field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="اسم أي شخص في العائلة..."
          />
        </div>
        <div>
          <label className="label-ar">السكن الفعلي الحالي</label>
          <input className="field" value={residence} onChange={(e) => setResidence(e.target.value)} placeholder="بحث جزئي..." />
        </div>
        <div>
          <label className="label-ar">الحزب / الميول</label>
          <select className="field" value={political} onChange={(e) => setPolitical(e.target.value)}>
            <option value="">— الكل —</option>
            {POLITICAL_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-ar">بلدة النفوس</label>
          <input className="field" value={town} onChange={(e) => setTown(e.target.value)} placeholder="بحث جزئي..." />
        </div>
        <div>
          <label className="label-ar">حالة الناخب</label>
          <select
            className="field"
            value={voterFilter}
            onChange={(e) => setVoterFilter(e.target.value as typeof voterFilter)}
          >
            <option value="">— الكل —</option>
            <option value="deceased">متوفّى</option>
            <option value="expat">مغترب</option>
            <option value="military">عسكري</option>
            <option value="voted">اقترع (مسجّل)</option>
          </select>
        </div>
      </div>

      <div className="card-elev overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr className="text-right">
                <th className="p-3 font-semibold">رقم السجل</th>
                <th className="p-3 font-semibold">الاسم الكامل</th>
                <th className="p-3 font-semibold">صلة القرابة</th>
                <th className="p-3 font-semibold">بلدة النفوس</th>
                <th className="p-3 font-semibold">السكن الحالي</th>
                <th className="p-3 font-semibold">الميول</th>
                <th className="p-3 font-semibold">حق الاقتراع</th>
                <th className="p-3 font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    جاري التحميل...
                  </td>
                </tr>
              )}
              {!isLoading && data?.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    لا توجد نتائج
                  </td>
                </tr>
              )}
              {data?.map((r) => {
                const rowEligible = canVote(r.birth_year, r.is_military, r);
                const rowAge = getAge(r.birth_year);
                const deceased = isDeceased(r);

                return (
                  <tr key={r.id} className={`border-t border-border ${r.is_military || deceased ? "bg-destructive/5" : ""}`}>
                    <td className="p-3 font-semibold">{r.family?.registry_number || "—"}</td>
                    <td className="p-3">
                      <div className="font-semibold">
                        {r.first_name} {r.last_name}
                        {deceased ? <span className="chip !bg-muted mr-2 text-xs">متوفّى</span> : null}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <div>
                          أب: {r.father_name || "—"} · أم: {r.mother_name || "—"}
                        </div>
                        <div>زوج/زوجة: {r.spouse_name || "—"}</div>
                      </div>
                    </td>
                    <td className="p-3">{r.relation || "—"}</td>
                    <td className="p-3">{r.family?.registry_town || "—"}</td>
                    <td className="p-3 text-muted-foreground">{r.current_residence || "—"}</td>
                    <td className="p-3">
                      <span className="chip">{r.political_leaning || "—"}</span>
                    </td>
                    <td className="p-3">
                      {r.is_military ? (
                        <span className="chip !bg-destructive !text-destructive-foreground">عسكري — لا</span>
                      ) : rowEligible === true ? (
                        <span className="chip !bg-success !text-success-foreground">
                          نعم{rowAge !== null ? ` · ${rowAge}` : ""}
                        </span>
                      ) : rowEligible === false ? (
                        <span className="chip">لا{rowAge !== null ? ` · ${rowAge}` : ""}</span>
                      ) : (
                        <span className="chip">غير محدد</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-foreground font-semibold hover:underline"
                          onClick={() => setViewing(r)}
                        >
                          عرض
                        </button>
                        <Link
                          to="/families/$id"
                          params={{ id: String(r.family_form_id) }}
                          search={{ member: r.id }}
                          className="text-primary font-semibold hover:underline"
                        >
                          تعديل
                        </Link>
                        <button
                          type="button"
                          className="text-destructive font-semibold hover:underline"
                          disabled={remove.isPending}
                          onClick={() => setPendingDelete(r)}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {remove.error && (
        <div className="card-elev p-4 text-destructive text-sm">{(remove.error as Error).message}</div>
      )}

      <ConfirmDeleteDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && !remove.isPending && setPendingDelete(null)}
        title="تأكيد حذف الفرد"
        description={
          pendingDelete
            ? `هل أنت متأكد من حذف ${pendingDelete.first_name} ${pendingDelete.last_name}؟ لا يمكن التراجع عن هذا الإجراء.`
            : ""
        }
        pending={remove.isPending}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id);
        }}
      />

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-4">
                  <PassportPhoto
                    personId={viewing.id}
                    name={`${viewing.first_name} ${viewing.last_name}`}
                    size="md"
                  />
                  <div className="min-w-0 flex-1 text-right">
                    <DialogTitle className="text-2xl font-black text-right">
                      {viewing.first_name} {viewing.last_name}
                    </DialogTitle>
                    <DialogDescription className="text-right">
                      استمارة #{viewing.family_form_id} · {viewing.family?.registry_town || "—"} —{" "}
                      {viewing.family?.registry_district || "—"}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex flex-wrap gap-2 justify-end">
                {viewing.is_military && (
                  <span className="chip !bg-destructive !text-destructive-foreground">عسكري — لا يحق له الاقتراع</span>
                )}
                <span className="chip">{normalizeRelation(viewing.relation) || viewing.relation || "فرد"}</span>
                {eligible === true && (
                  <span className="chip !bg-success !text-success-foreground">
                    يحق له الاقتراع{age !== null ? ` · ${age}` : ""}
                  </span>
                )}
                {eligible === false && !viewing.is_military && (
                  <span className="chip">لا يحق له الاقتراع{age !== null ? ` · ${age}` : ""}</span>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <Info
                  label="الزوج / الزوجة"
                  v={
                    spouseFromFamily
                      ? [spouseFromFamily.first_name, spouseFromFamily.father_name, spouseFromFamily.last_name]
                          .filter(Boolean)
                          .join(" ")
                      : viewing.spouse_name || "غير مسجّل"
                  }
                />
                <Info label="رقم السجل" v={viewing.family?.registry_number} />
                <Info label="اسم الأب" v={viewing.father_name} />
                <Info label="اسم الأم" v={viewing.mother_name} />
                <Info label="تاريخ الولادة" v={viewing.birth_year?.toString()} />
                <Info label="الجوال" v={viewing.mobile} />
                <Info label="الوضع العائلي" v={displayMaritalStatus(viewing, spouseFromFamily)} />
                <Info label="وضع الناخب" v={viewing.voter_status} />
                <Info label="متوفّى" v={isDeceased(viewing) ? "نعم" : "لا"} />
                <Info label="السكن مع الأهل" v={viewing.lives_with_family ? "نعم" : "لا"} />
                <Info label="الميول السياسية" v={viewing.political_leaning} />
                <Info label="الصوت التفضيلي" v={viewing.preferred_candidate} />
                <Info label="اقترع يوم الانتخاب" v={viewing.has_voted ? "نعم" : "لا"} />
                <div className="sm:col-span-2">
                  <Info label="السكن الفعلي" v={viewing.current_residence} />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <PersonFilesPanel
                  personId={viewing.id}
                  personName={`${viewing.first_name} ${viewing.last_name}`}
                  compact
                />
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="font-bold text-lg">أفراد الاستمارة</h3>
                {familyLoading && <div className="text-sm text-muted-foreground">جاري التحميل...</div>}
                {!familyLoading && familyMembers && (
                  <FamilyMembersList members={familyMembers} focusId={viewing.id} />
                )}
              </div>

              <div className="flex flex-wrap gap-2 justify-end pt-2">
                <button type="button" className="btn-ghost" onClick={() => setViewing(null)}>
                  إغلاق
                </button>
                <Link
                  to="/families/$id"
                  params={{ id: String(viewing.family_form_id) }}
                  search={{ member: viewing.id }}
                  hash="members"
                  className="btn-primary"
                  onClick={() => setViewing(null)}
                >
                  تعديل الاستمارة
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
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

function FamilyMembersList({ members, focusId }: { members: Individual[]; focusId: number }) {
  if (members.length === 0) {
    return <div className="text-sm text-muted-foreground">لا يوجد أفراد مسجّلون في هذه الاستمارة.</div>;
  }

  return (
    <div className="space-y-2">
      {members.map((m) => (
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
          <div className="flex items-center gap-3 min-w-0">
            <PassportPhoto personId={m.id} name={`${m.first_name} ${m.last_name}`} size="sm" />
            <div className="min-w-0">
              <div className="font-semibold text-sm">
                {m.first_name} {m.last_name}
                {m.id === focusId && (
                  <span className="chip mr-2 !bg-primary !text-primary-foreground">المعرض</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {normalizeRelation(m.relation) || m.relation || "غير محدد"}
                {m.birth_year ? ` · مواليد ${m.birth_year}` : ""}
              </div>
            </div>
          </div>
          {m.is_military && (
            <span className="chip !bg-destructive !text-destructive-foreground shrink-0">عسكري</span>
          )}
        </div>
      ))}
    </div>
  );
}
