import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  PERSON_DOC_TYPES,
  deletePersonFileFn,
  listPersonFilesFn,
  uploadPersonFileFn,
  type PersonDocType,
  type PersonFile,
} from "@/lib/person-files";

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("تعذّر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

function docLabel(docType: string) {
  return PERSON_DOC_TYPES.find((t) => t.id === docType)?.label ?? docType;
}

export function PersonFilesPanel({
  personId,
  personName,
  compact,
}: {
  personId: number;
  personName?: string;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<Exclude<PersonDocType, "photo">>("id_individual");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: files = [], isLoading, isError, error: loadError } = useQuery({
    queryKey: ["person-files", personId],
    queryFn: () => listPersonFilesFn({ data: personId }),
    enabled: Number.isFinite(personId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["person-files", personId] });

  const upload = useMutation({
    mutationFn: async (payload: { file: File; docType: PersonDocType }) => {
      const dataBase64 = await fileToBase64(payload.file);
      return uploadPersonFileFn({
        data: {
          personId,
          docType: payload.docType,
          fileName: payload.file.name,
          contentType: payload.file.type || "application/octet-stream",
          dataBase64,
        },
      });
    },
    onSuccess: async () => {
      setError(null);
      setMessage("تم رفع الملف.");
      await invalidate();
    },
    onError: (err) => {
      setMessage(null);
      setError((err as Error).message || "تعذّر رفع الملف");
    },
  });

  const remove = useMutation({
    mutationFn: (url: string) => deletePersonFileFn({ data: { url } }),
    onSuccess: async () => {
      setError(null);
      setMessage("تم حذف الملف.");
      await invalidate();
    },
    onError: (err) => {
      setMessage(null);
      setError((err as Error).message || "تعذّر الحذف");
    },
  });

  const photo = files.find((f) => f.docType === "photo");
  const documents = files.filter((f) => f.docType !== "photo");

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-bold text-lg">{compact ? "الصورة والملفات" : `ملفات ${personName || "الفرد"}`}</h3>
        <span className="text-xs text-muted-foreground">{files.length} ملف</span>
      </div>

      {message && <div className="text-sm text-success font-semibold">{message}</div>}
      {(error || isError) && (
        <div className="text-sm text-destructive">{error || (loadError as Error)?.message}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="shrink-0 space-y-2">
          <div className="w-28 h-28 rounded-xl border border-border bg-muted overflow-hidden flex items-center justify-center">
            {photo ? (
              <img src={photo.url} alt={personName || "صورة"} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground text-center px-2">لا صورة</span>
            )}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload.mutate({ file, docType: "photo" });
            }}
          />
          <button
            type="button"
            className="btn-primary w-full text-sm"
            disabled={upload.isPending}
            onClick={() => photoInputRef.current?.click()}
          >
            {upload.isPending ? "جاري الرفع..." : photo ? "تغيير الصورة" : "رفع صورة"}
          </button>
          {photo && (
            <button
              type="button"
              className="btn-ghost w-full text-sm !text-destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate(photo.url)}
            >
              حذف الصورة
            </button>
          )}
        </div>

        <div className="flex-1 w-full space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="min-w-[10rem] flex-1">
              <label className="label-ar">نوع المستند</label>
              <select
                className="field"
                value={docType}
                onChange={(e) => setDocType(e.target.value as Exclude<PersonDocType, "photo">)}
              >
                {PERSON_DOC_TYPES.filter((t) => t.id !== "photo").map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              ref={docInputRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload.mutate({ file, docType });
              }}
            />
            <button
              type="button"
              className="btn-primary"
              disabled={upload.isPending}
              onClick={() => docInputRef.current?.click()}
            >
              + رفع مستند
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            إخراج قيد فردي / عائلي، هوية، أو أي ملف PDF أو صورة — حتى 8 ميغابايت.
          </p>

          {isLoading && <div className="text-sm text-muted-foreground">جاري تحميل الملفات...</div>}

          {!isLoading && documents.length === 0 && (
            <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4">
              ما في مستندات مرفوعة لهالشخص بعد.
            </div>
          )}

          <div className="space-y-2">
            {documents.map((file) => (
              <div
                key={file.pathname}
                className="flex items-center justify-between gap-3 border border-border rounded-lg p-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{docLabel(file.docType)}</div>
                  <div className="text-xs text-muted-foreground truncate">{file.fileName}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a href={file.url} target="_blank" rel="noreferrer" className="btn-ghost text-sm">
                    عرض
                  </a>
                  <button
                    type="button"
                    className="btn-ghost text-sm !text-destructive"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(file.url)}
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
