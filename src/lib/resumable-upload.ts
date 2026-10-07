import { Upload } from "tus-js-client";
import type { UploadKind } from "./admin-validation";

type EbookKind = Extract<UploadKind, "pdf" | "epub">;
type UploadResult = { name: string; path: string; previewPages?: number; sourcePages?: number };

async function jsonResponse(response: Response) {
  try { return await response.json(); }
  catch { return { error: "The server returned an unreadable response." }; }
}

export async function uploadEbook(
  bookId: string, kind: EbookKind, file: File, onProgress: (progress: number) => void,
): Promise<UploadResult> {
  const start = await fetch("/api/admin/upload/start", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookId, kind, name: file.name, size: file.size }),
  });
  const session = await jsonResponse(start);
  if (!start.ok) throw new Error(`${session.error || "Could not start upload."}${session.requestId ? ` (request ${session.requestId})` : ""}`);
  if (!session.endpoint || !session.token || !session.path || !session.ticket)
    throw new Error("Upload setup is incomplete. Reload the page and retry.");
  await new Promise<void>((resolve, reject) => {
    const transfer = new Upload(file, {
      endpoint: session.endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { "x-signature": session.token },
      metadata: {
        bucketName: "ebooks", objectName: session.path,
        contentType: kind === "pdf" ? "application/pdf" : "application/epub+zip",
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      removeFingerprintOnSuccess: true,
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
      onError: (error) => {
        const status = "originalResponse" in error ? error.originalResponse?.getStatus() : null;
        reject(new Error(status === 413
          ? "Supabase Storage rejected the file size. Check that the ebook bucket allows up to 30 MB."
          : status === 400 || status === 415
            ? "Supabase Storage rejected this upload. Check the private ebook bucket's size and PDF/EPUB type settings."
            : status === 403
              ? "Supabase Storage refused this upload. Reload and retry; if it persists, check the Storage configuration."
              : `Direct upload was interrupted${status ? ` (HTTP ${status})` : ""}. Check your connection and retry.`));
      },
    });
    transfer.start();
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    let finish: Response;
    try {
      finish = await fetch("/api/admin/upload/finish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: session.ticket }),
      });
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
      continue;
    }
    const result = await jsonResponse(finish);
    if (finish.ok) return result as UploadResult;
    if (finish.status < 500 || attempt === 2)
      throw new Error(`${result.error || "The file arrived, but the book could not be saved."}${result.requestId ? ` (request ${result.requestId})` : ""}`);
    await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
  }
  throw new Error("The uploaded file could not be saved to the book. Please retry.");
}
