import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteIndividual, listIndividuals, POLITICAL_OPTIONS } from "@/lib/registry";

export const Route = createFileRoute("/individuals")({
  component: IndividualsList,
});

function IndividualsList() {
  const queryClient = useQueryClient();
  const [residence, setResidence] = useState("");
  const [political, setPolitical] = useState("");
  const [town, setTown] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["individuals", residence, political, town],
    queryFn: () => listIndividuals({ residence, political, town }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteIndividual(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
        queryClient.invalidateQueries({ queryKey: ["family-summaries"] }),
        queryClient.invalidateQueries({ queryKey: ["individuals"] }),
      ]);
      await refetch();
    },
  });

  const exportCsv = () => {
    if (!data) return;
    const headers = ["#", "الاسم", "الشهرة", "اسم الأب", "الميول", "السكن الحالي", "بلدة النفوس", "الجوال", "عسكري", "اقترع"];
    const rows = data.map((r) => [
      r.id,
      r.first_name,
      r.last_name,
      r.father_name ?? "",
      r.political_leaning ?? "",
      r.current_residence ?? "",
      r.family?.registry_town ?? "",
      r.mobile ?? "",
      r.is_military ? "نعم" : "لا",
      r.has_voted ? "نعم" : "لا",
    ]);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black">قائمة الأفراد</h1>
          <p className="text-sm text-muted-foreground mt-1">فرز شامل، تعديل، حذف، وتصدير إلى CSV.</p>
        </div>
        <button className="btn-primary" onClick={exportCsv} disabled={!data?.length}>
          تصدير CSV ↓
        </button>
      </div>

      <div className="card-elev p-4 sm:p-5 grid sm:grid-cols-3 gap-3">
        <div>
          <label className="label-ar">السكن الفعلي الحالي</label>
          <input className="field" value={residence} onChange={(e) => setResidence(e.target.value)} placeholder="بحث جزئي..." />
        </div>
        <div>
          <label className="label-ar">الميول السياسية</label>
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
      </div>

      <div className="card-elev overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr className="text-right">
                <th className="p-3 font-semibold">#</th>
                <th className="p-3 font-semibold">الاسم الكامل</th>
                <th className="p-3 font-semibold">صلة القرابة</th>
                <th className="p-3 font-semibold">بلدة النفوس</th>
                <th className="p-3 font-semibold">السكن الحالي</th>
                <th className="p-3 font-semibold">الميول</th>
                <th className="p-3 font-semibold">الحالة</th>
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
              {data?.map((r) => (
                <tr key={r.id} className={`border-t border-border ${r.is_military ? "bg-destructive/5" : ""}`}>
                  <td className="p-3 text-muted-foreground">{r.id}</td>
                  <td className="p-3">
                    <div className="font-semibold">
                      {r.first_name} {r.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">ابن {r.father_name || "—"}</div>
                  </td>
                  <td className="p-3">{r.relation}</td>
                  <td className="p-3">{r.family?.registry_town || "—"}</td>
                  <td className="p-3 text-muted-foreground">{r.current_residence || "—"}</td>
                  <td className="p-3">
                    <span
                      className={`chip ${
                        r.political_leaning === "مؤيد"
                          ? "!bg-success !text-success-foreground"
                          : r.political_leaning === "معارض"
                            ? "!bg-destructive !text-destructive-foreground"
                            : ""
                      }`}
                    >
                      {r.political_leaning || "—"}
                    </span>
                  </td>
                  <td className="p-3">
                    {r.is_military ? (
                      <span className="chip !bg-destructive !text-destructive-foreground">عسكري</span>
                    ) : r.has_voted ? (
                      <span className="chip !bg-success !text-success-foreground">اقترع</span>
                    ) : (
                      <span className="chip">لم يقترع</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to="/families/$id"
                        params={{ id: String(r.family_form_id) }}
                        className="text-primary font-semibold hover:underline"
                      >
                        تعديل
                      </Link>
                      <button
                        type="button"
                        className="text-destructive font-semibold hover:underline"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (window.confirm(`متأكد بدك تمسح ${r.first_name} ${r.last_name}؟`)) {
                            remove.mutate(r.id);
                          }
                        }}
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {remove.error && (
        <div className="card-elev p-4 text-destructive text-sm">{(remove.error as Error).message}</div>
      )}
    </div>
  );
}
