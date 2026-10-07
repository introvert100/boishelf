"use client";

import { useEffect, useRef, useState } from "react";
import { inspectEpub, type EpubChapter } from "@/lib/epub-inspect";
import { useLanguage } from "./store";

type SourceKind = "pdf" | "epub" | "sample";

export function SourceViewer({ bookId, kind, open, onClose, onSavePages, onInspected }: {
  bookId: string;
  kind: SourceKind;
  open: boolean;
  onClose: () => void;
  onSavePages: (pages: number) => Promise<string | null>;
  onInspected: (pages: number) => void;
}) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState("");
  const [pages, setPages] = useState(0);
  const [maxPreviewPages, setMaxPreviewPages] = useState(0);
  const [page, setPage] = useState(1);
  const [chapters, setChapters] = useState<EpubChapter[]>([]);
  const [chapter, setChapter] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!open) { if (element.open) element.close(); return; }
    element.showModal();
    const controller = new AbortController();
    const endpoint = `/api/admin/books/${bookId}/source-view?kind=${kind}`;
    const load = async () => {
      setLoading(true); setError(""); setUrl(""); setChapters([]); setPage(1);
      try {
        const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) {
          const body = await response.json();
          throw new Error(`${body.error || "The book file could not be opened."}${body.requestId ? ` (request ${body.requestId})` : ""}`);
        }
        if (kind === "epub") {
          const book = inspectEpub(new Uint8Array(await response.arrayBuffer()));
          if (!controller.signal.aborted) { setChapters(book); setChapter(0); }
        } else {
          const body = await response.json();
          if (!body.url || !Number.isInteger(body.pages)) throw new Error("The PDF could not be inspected.");
          if (!controller.signal.aborted) {
            setUrl(body.url); setPages(body.pages); setMaxPreviewPages(body.maxPreviewPages);
            onInspected(body.pages);
          }
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          const raw = (failure as Error).message || "The book file could not be opened.";
          const request = / \(request [0-9a-f-]{36}\)$/.exec(raw)?.[0] || "";
          const message = raw.slice(0, raw.length - request.length);
          const translated = message === "This PDF could not be safely inspected. Export a fresh PDF and try again."
            ? t("এই PDF নিরাপদে পরীক্ষা করা যায়নি। নতুন করে PDF রপ্তানি করে আবার চেষ্টা করুন।", message)
            : message;
          setError(`${translated}${request}`);
        }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    return () => {
      controller.abort(); setUrl(""); setChapters([]);
      if (element.open) element.close();
    };
  }, [bookId, kind, open, onInspected]);

  async function saveSelection() {
    if (saving || page < 1 || page > maxPreviewPages) return;
    setSaving(true); setError("");
    try {
      const problem = await onSavePages(page);
      if (problem) setError(problem);
      else dialog.current?.close();
    } finally { setSaving(false); }
  }

  const pdf = kind !== "epub";
  return <dialog ref={dialog} className="preview-dialog source-dialog" onClose={onClose}
    aria-label={pdf ? t("PDF দেখে প্রিভিউ বাছুন", "Inspect PDF and choose preview") : t("EPUB পড়ুন", "Read EPUB")}>
    <div className="preview-heading">
      <div>
        <h2>{pdf ? t("PDF দেখে প্রিভিউ বাছুন", "Inspect PDF and choose preview") : t("EPUB-এর অধ্যায় দেখুন", "Inspect EPUB chapters")}</h2>
        <p>{pdf ? t("যে পৃষ্ঠায় শেষ করবেন, তার আগের সব পৃষ্ঠা বিনামূল্যের প্রিভিউ হবে।", "Choose the last free page; visitors will see every page from 1 through that page.")
          : t("এটি শুধু আপনার জন্য পাঠ্য-ভিত্তিক দর্শন। EPUB-এর ছবি ও বিন্যাস এখানে দেখানো হয় না।", "This private text view shows chapters; EPUB images and layout are not shown here.")}</p>
      </div>
      <button type="button" className="button secondary" onClick={() => dialog.current?.close()}>{t("বন্ধ করুন", "Close")}</button>
    </div>
    {loading && <p role="status">{t("ফাইল খোলা হচ্ছে…", "Opening file…")}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {pdf && url && <>
      <p className="source-count" role="status">{t("এই PDF-এ মোট", "This PDF has")} <strong>{pages}</strong> {t("পৃষ্ঠা। সর্বোচ্চ বিনামূল্যে দেখানো যাবে", "pages. Maximum free preview:")} <strong>{maxPreviewPages}</strong> {t("পৃষ্ঠা।", "pages.")}</p>
      {maxPreviewPages === 0 && <p className="notice error">{t("এক পৃষ্ঠার মূল PDF থেকে প্রিভিউ করা যায় না: পুরো বইটিই প্রকাশ হয়ে যাবে। একাধিক পৃষ্ঠার PDF আপলোড করুন।", "A one-page paid PDF cannot have a free preview because that would reveal the whole file. Upload a multi-page PDF.")}</p>}
      <div className="source-controls">
        <label htmlFor="source-page">{t("যে পৃষ্ঠা দেখছেন", "Page to inspect")}
          <input id="source-page" type="number" min="1" max={pages} value={page}
            onChange={(event) => setPage(Math.max(1, Math.min(pages, Number(event.target.value) || 1)))} />
        </label>
        <input type="range" min="1" max={pages} value={page} onChange={(event) => setPage(Number(event.target.value))}
          aria-label={t("PDF পৃষ্ঠা বাছুন", "Choose PDF page")} />
        <span>{page} / {pages}</span>
      </div>
      <iframe key={page} title={t(`PDF-এর পৃষ্ঠা ${page}`, `PDF page ${page}`)} src={`${url}#page=${page}`}
        className="preview-frame" />
      <div className="form-actions">
        <a href={`${url}#page=${page}`} target="_blank" rel="noopener noreferrer" className="button secondary">{t("পুরো PDF আলাদা ট্যাবে খুলুন", "Open full PDF in a new tab")}</a>
        <button type="button" className="button" disabled={saving || page > maxPreviewPages} onClick={() => void saveSelection()}>
          {saving ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t(`১–${page} পৃষ্ঠা প্রিভিউ করুন`, `Save pages 1–${page} as preview`)}
        </button>
      </div>
      {page > maxPreviewPages && maxPreviewPages > 0 && <p className="field-help">{t("শেষ পৃষ্ঠাটি ক্রেতাদের জন্য রাখতে আগের পৃষ্ঠা বাছুন।", "Choose an earlier page so the last page stays for buyers.")}</p>}
    </>}
    {!pdf && chapters.length > 0 && <>
      <div className="source-controls">
        <label htmlFor="epub-chapter">{t("অধ্যায়", "Chapter")}
          <select id="epub-chapter" value={chapter} onChange={(event) => setChapter(Number(event.target.value))}>
            {chapters.map((item, index) => <option key={index} value={index}>{index + 1}. {item.title}</option>)}
          </select>
        </label>
        <span>{chapter + 1} / {chapters.length}</span>
      </div>
      <article className="epub-chapter"><h3>{chapters[chapter].title}</h3><p>{chapters[chapter].text}</p></article>
      <p className="field-help">{t("EPUB থেকে সরাসরি PDF পৃষ্ঠা বানানো হয় না। বিনামূল্যে দেখাতে চান এমন অংশ দিয়ে আলাদা নমুনা PDF তৈরি করে নিচে আপলোড করুন।", "EPUB chapters do not have fixed PDF pages. Make a separate sample PDF with the content you want to share, then upload it below.")}</p>
    </>}
    {!pdf && !loading && <a className="button secondary" href={`/api/admin/books/${bookId}/source-view?kind=epub`}>{t("EPUB অন্য রিডারে খুলতে ডাউনলোড করুন", "Download EPUB for another reader")}</a>}
  </dialog>;
}
