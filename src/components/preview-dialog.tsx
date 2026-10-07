"use client";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./store";

export function PreviewDialog({ bookId, admin = false, open, onClose }: {
  bookId: string; admin?: boolean; open: boolean; onClose: () => void;
}) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!open) { if (element.open) element.close(); return; }
    element.showModal();
    const controller = new AbortController();
    const endpoint = admin ? `/api/admin/books/${bookId}/preview-view` : `/api/previews/${bookId}`;
    fetch(endpoint, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.url) throw new Error(body.error || "Preview could not be opened.");
        setUrl(body.url);
      })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message || "Preview could not be opened."); });
    return () => { controller.abort(); setUrl(""); setError(""); if (element.open) element.close(); };
  }, [open, bookId, admin]);
  return <dialog ref={dialog} className="preview-dialog" onClose={onClose} aria-label={t("বইয়ের প্রিভিউ", "Book preview")}>
    <div className="preview-heading">
      <div><h2>{t("বইয়ের প্রিভিউ", "Book preview")}</h2><p>{t("এটি বিনামূল্যের নমুনা; সম্পূর্ণ বই কিনলে পাওয়া যাবে।", "This free sample can be saved. Buy the book for the complete ebook.")}</p></div>
      <button type="button" className="button secondary" onClick={() => dialog.current?.close()}>{t("বন্ধ করুন", "Close")}</button>
    </div>
    {error && <p className="notice error" role="alert">{error === "Preview is not available."
      ? t("এই বইয়ের প্রিভিউ এখন পাওয়া যাচ্ছে না।", "Preview is not available.")
      : error === "Preview could not be opened."
        ? t("প্রিভিউ খোলা যায়নি। পরে আবার চেষ্টা করুন।", "Preview could not be opened. Please retry.")
        : error}</p>}
    {!error && !url && <p role="status">{t("প্রিভিউ খোলা হচ্ছে…", "Opening preview…")}</p>}
    {url && <><iframe title={t("বইয়ের নমুনা PDF", "Sample PDF")} src={url} className="preview-frame" />
      <a href={url} target="_blank" rel="noopener noreferrer" className="button secondary">{t("PDF আলাদা ট্যাবে খুলুন", "Open PDF in a new tab")}</a></>}
  </dialog>;
}
