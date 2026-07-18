import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  downloadFullBackup,
  downloadImportTemplate,
  importExcelRows,
  parseExcelFile,
  type ExcelImportPreview,
} from "@/lib/excel-import";

export const Route = createFileRoute("/import")({
  component: ImportPage,
});

function ImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ExcelImportPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("اختر ملف إكسل أولاً.");
      return importExcelRows(preview.rows);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
        queryClient.invalidateQueries({ queryKey: ["family-summaries"] }),
        queryClient.invalidateQueries({ queryKey: ["individuals"] }),
        queryClient.invalidateQueries({ queryKey: ["family-members"] }),
        queryClient.invalidateQueries({ queryKey: ["search"] }),
      ]);
      navigate({ to: "/" });
    },
  });

  const onFile = async (file: File | null) => {
    if (!file) return;
    setParsing(true);
    setParseError(null);
    setPreview(null);
    setFileName(file.name);
    try {
      const result = await parseExcelFile(file);
      setPreview(result);
    } catch (error) {
      setParseError((error as Error).message || "تعذّر قراءة الملف.");
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black">استيراد من Excel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            نزّل القالب، عبّي العائلات والأفراد، ثم ارفع الملف. إذا العائلة موجودة (نفس القضاء والبلدة ورقم السجل والشهرة) بتنحدّث بدل ما تتكرّر.
          </p>
        </div>
        <Link to="/" className="btn-ghost">
          العودة للرئيسية
        </Link>
      </div>

      <section className="card-elev p-5 sm:p-7 space-y-5">
        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5">
          <h2 className="font-bold text-lg">نسخة احتياطية كاملة</h2>
          <p className="text-sm text-muted-foreground mt-2">
            بتنزّل ملفين: Excel (نفس أعمدة الاستيراد) و JSON (مع أرقام الـ ID). احفظهن عندك بأمان.
          </p>
          <button
            type="button"
            className="btn-primary mt-4"
            disabled={backupBusy}
            onClick={async () => {
              setBackupBusy(true);
              setBackupMessage(null);
              setBackupError(null);
              try {
                const result = await downloadFullBackup();
                setBackupMessage(
                  `تم التحميل: ${result.families.toLocaleString("ar-EG")} عيلة و ${result.people.toLocaleString("ar-EG")} فرد.`,
                );
              } catch (err) {
                setBackupError((err as Error).message || "تعذّر إنشاء النسخة الاحتياطية.");
              } finally {
                setBackupBusy(false);
              }
            }}
          >
            {backupBusy ? "جاري تجهيز النسخة..." : "تحميل نسخة احتياطية كاملة ↓"}
          </button>
          {backupMessage ? <div className="mt-3 text-sm font-semibold text-success">{backupMessage}</div> : null}
          {backupError ? <div className="mt-3 text-sm text-destructive">{backupError}</div> : null}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-muted/30 p-5">
            <h2 className="font-bold text-lg">١ · نزّل القالب</h2>
            <p className="text-sm text-muted-foreground mt-2">
              القالب يحتوي كل الأعمدة المطلوبة مع مثالين لعائلة واحدة.
            </p>
            <button className="btn-primary mt-4" onClick={() => downloadImportTemplate()}>
              تحميل قالب Excel ↓
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-5">
            <h2 className="font-bold text-lg">٢ · ارفع الملف</h2>
            <p className="text-sm text-muted-foreground mt-2">
              استخدم نفس أسماء الأعمدة العربية. صفوف نفس «مفتاح العائلة» تنضم كعائلة واحدة.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            <button className="btn-ghost mt-4" onClick={() => inputRef.current?.click()} disabled={parsing}>
              {parsing ? "جاري القراءة..." : "اختيار ملف Excel"}
            </button>
            {fileName && <div className="mt-3 text-sm font-semibold">{fileName}</div>}
          </div>
        </div>

        <div className="text-sm text-muted-foreground leading-relaxed">
          مهم: عمود <span className="font-semibold text-foreground">مفتاح العائلة</span> يجمع الأفراد مع بعض.
          إذا تركته فاضي، بيتم التجميع حسب القضاء + البلدة + رقم السجل + الشهرة.
        </div>
      </section>

      {parseError && <div className="card-elev p-4 text-destructive text-sm">{parseError}</div>}

      {preview && (
        <section className="card-elev overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-border flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-bold text-xl">معاينة الاستيراد</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="chip">العائلات: {preview.families.toLocaleString("ar-EG")}</span>
                <span className="chip">الأفراد: {preview.people.toLocaleString("ar-EG")}</span>
                <span className={`chip ${preview.errorCount ? "!bg-destructive !text-destructive-foreground" : ""}`}>
                  أخطاء: {preview.errorCount.toLocaleString("ar-EG")}
                </span>
              </div>
            </div>
            <button
              className="btn-primary"
              disabled={mutation.isPending || preview.people - preview.errorCount <= 0}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "جاري الاستيراد..." : "تأكيد الاستيراد"}
            </button>
          </div>

          {mutation.error && (
            <div className="p-4 text-destructive text-sm border-b border-border">
              {(mutation.error as Error).message}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr className="text-right">
                  <th className="p-3 font-semibold">صف</th>
                  <th className="p-3 font-semibold">مفتاح العائلة</th>
                  <th className="p-3 font-semibold">الاسم</th>
                  <th className="p-3 font-semibold">القرابة</th>
                  <th className="p-3 font-semibold">بلدة النفوس</th>
                  <th className="p-3 font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 100).map((row) => (
                  <tr key={row.rowNumber} className="border-t border-border">
                    <td className="p-3 text-muted-foreground">{row.rowNumber}</td>
                    <td className="p-3">{row.familyKey}</td>
                    <td className="p-3 font-semibold">
                      {row.individual.first_name} {row.individual.last_name}
                    </td>
                    <td className="p-3">{row.individual.relation}</td>
                    <td className="p-3">{row.family.registry_town || "—"}</td>
                    <td className="p-3">
                      {row.errors.length ? (
                        <span className="text-destructive">{row.errors.join(" · ")}</span>
                      ) : (
                        <span className="text-success font-semibold">جاهز</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 100 && (
            <div className="p-4 text-sm text-muted-foreground border-t border-border">
              يتم عرض أول 100 صف فقط للمعاينة. الاستيراد يشمل الملف كله.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
