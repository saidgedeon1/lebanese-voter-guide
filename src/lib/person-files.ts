import { createServerFn } from "@tanstack/react-start";
import { del, list, put } from "@vercel/blob";

export const PERSON_DOC_TYPES = [
  { id: "photo", label: "صورة شخصية" },
  { id: "id_individual", label: "إخراج قيد فردي" },
  { id: "id_family", label: "إخراج قيد عائلي" },
  { id: "national_id", label: "هوية / بطاقة" },
  { id: "other", label: "مستند آخر" },
] as const;

export type PersonDocType = (typeof PERSON_DOC_TYPES)[number]["id"];

export type PersonFile = {
  url: string;
  pathname: string;
  docType: PersonDocType | string;
  fileName: string;
  contentType: string | null;
  uploadedAt: string | null;
  size: number | null;
};

function requireToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("تخزين الملفات غير مفعّل (BLOB_READ_WRITE_TOKEN).");
  }
  return token;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\u0600-\u06FF-]+/g, "_").slice(0, 120) || "file";
}

function parsePathname(pathname: string): Pick<PersonFile, "docType" | "fileName"> {
  // people/{id}/{docType}/{timestamp}-{fileName}
  const parts = pathname.split("/");
  const docType = parts[2] || "other";
  const leaf = parts[parts.length - 1] || "file";
  const fileName = leaf.replace(/^\d+-/, "") || leaf;
  return { docType, fileName };
}

export const listPersonFilesFn = createServerFn({ method: "GET" })
  .inputValidator((personId: number) => personId)
  .handler(async ({ data: personId }) => {
    const token = requireToken();
    const prefix = `people/${personId}/`;
    const result = await list({ prefix, token });
    const files: PersonFile[] = result.blobs.map((blob) => {
      const parsed = parsePathname(blob.pathname);
      return {
        url: blob.url,
        pathname: blob.pathname,
        docType: parsed.docType,
        fileName: parsed.fileName,
        contentType: blob.contentType ?? null,
        uploadedAt: blob.uploadedAt ? new Date(blob.uploadedAt).toISOString() : null,
        size: blob.size ?? null,
      };
    });
    files.sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
    return files;
  });

export const uploadPersonFileFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      personId: number;
      docType: string;
      fileName: string;
      contentType: string;
      dataBase64: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const token = requireToken();
    const allowed = PERSON_DOC_TYPES.some((t) => t.id === data.docType);
    if (!allowed) throw new Error("نوع المستند غير صالح");
    if (!data.dataBase64) throw new Error("الملف فارغ");

    // ~8MB decoded ceiling for serverless body safety
    const approxBytes = Math.ceil((data.dataBase64.length * 3) / 4);
    if (approxBytes > 8 * 1024 * 1024) {
      throw new Error("حجم الملف كبير (الحد 8 ميغابايت)");
    }

    const buffer = Buffer.from(data.dataBase64, "base64");
    const safeName = sanitizeFileName(data.fileName);
    const pathname = `people/${data.personId}/${data.docType}/${Date.now()}-${safeName}`;

    // Replace previous photo when uploading a new one
    if (data.docType === "photo") {
      const existing = await list({ prefix: `people/${data.personId}/photo/`, token });
      if (existing.blobs.length) {
        await del(
          existing.blobs.map((b) => b.url),
          { token },
        );
      }
    }

    const blob = await put(pathname, buffer, {
      access: "public",
      token,
      contentType: data.contentType || "application/octet-stream",
      addRandomSuffix: false,
    });

    return {
      url: blob.url,
      pathname: blob.pathname,
      docType: data.docType,
      fileName: safeName,
      contentType: data.contentType || null,
      uploadedAt: new Date().toISOString(),
      size: buffer.length,
    } satisfies PersonFile;
  });

export const deletePersonFileFn = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => input)
  .handler(async ({ data }) => {
    const token = requireToken();
    if (!data.url.includes("blob.vercel-storage.com") && !data.url.includes("vercel-storage.com")) {
      throw new Error("رابط غير صالح");
    }
    await del(data.url, { token });
    return { ok: true };
  });

/** Best-effort cleanup of all blobs for one or more people (ignores missing token). */
export const deleteAllFilesForPeopleFn = createServerFn({ method: "POST" })
  .inputValidator((personIds: number[]) => personIds)
  .handler(async ({ data: personIds }) => {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token || !personIds?.length) return { ok: true, deleted: 0 };
    let deleted = 0;
    for (const personId of personIds) {
      const result = await list({ prefix: `people/${personId}/`, token });
      if (!result.blobs.length) continue;
      await del(
        result.blobs.map((b) => b.url),
        { token },
      );
      deleted += result.blobs.length;
    }
    return { ok: true, deleted };
  });
