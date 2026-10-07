"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Upload, X } from "lucide-react";
import { bookInput, uploadProblem, type UploadKind } from "@/lib/admin-validation";
import { categories } from "@/lib/demo";
import { blankBook, bookValues, draftKey, type BookFormValues } from "@/lib/book-draft";
import type { Book } from "@/lib/types";
import { useLanguage } from "./store";
import { PreviewDialog } from "./preview-dialog";

const uploadKinds: UploadKind[] = ["cover", "pdf", "epub"];
type UploadState = { progress: number; filename: string; phase: "uploading" | "processing" | "done" | "error"; error?: string; replaced?: boolean };

const bnErrors: Record<string, string> = {
  "Enter the Bengali title.": "বাংলা বইয়ের নাম লিখুন।",
  "Keep the Bengali title under 160 characters.": "বাংলা বইয়ের নাম ১৬০ অক্ষরের মধ্যে রাখুন।",
  "Enter the English title.": "ইংরেজি বইয়ের নাম লিখুন।",
  "Keep the English title under 160 characters.": "ইংরেজি বইয়ের নাম ১৬০ অক্ষরের মধ্যে রাখুন।",
  "Enter the Bengali author.": "বাংলা লেখকের নাম লিখুন।",
  "Keep the Bengali author under 100 characters.": "বাংলা লেখকের নাম ১০০ অক্ষরের মধ্যে রাখুন।",
  "Enter the English author.": "ইংরেজি লেখকের নাম লিখুন।",
  "Keep the English author under 100 characters.": "ইংরেজি লেখকের নাম ১০০ অক্ষরের মধ্যে রাখুন।",
  "Write at least 10 characters in the Bengali description.": "বাংলা বিবরণে অন্তত ১০টি অক্ষর লিখুন।",
  "Keep the Bengali description under 5,000 characters.": "বাংলা বিবরণ ৫,০০০ অক্ষরের মধ্যে রাখুন।",
  "Write at least 10 characters in the English description.": "ইংরেজি বিবরণে অন্তত ১০টি অক্ষর লিখুন।",
  "Keep the English description under 5,000 characters.": "ইংরেজি বিবরণ ৫,০০০ অক্ষরের মধ্যে রাখুন।",
  "Use 3–90 lowercase letters, numbers, and hyphens for the URL slug.": "URL slug-এ ৩–৯০টি ছোট হাতের ইংরেজি অক্ষর, সংখ্যা বা হাইফেন ব্যবহার করুন।",
  "Use lowercase letters, numbers, and single hyphens; start and end with a letter or number.": "URL slug-এ শুধু ছোট হাতের ইংরেজি অক্ষর, সংখ্যা ও মাঝখানে একটি হাইফেন ব্যবহার করুন।",
  "Price must be at least 10 BDT.": "মূল্য কমপক্ষে ১০ টাকা হতে হবে।",
  "Price must be no more than 100,000 BDT.": "মূল্য সর্বোচ্চ ১,০০,০০০ টাকা হতে পারে।",
  "Enter a price with no more than two decimal places.": "মূল্যে দশমিকের পরে সর্বোচ্চ দুইটি সংখ্যা লিখুন।",
  "Pages must be between 1 and 20,000.": "পৃষ্ঠা সংখ্যা ১ থেকে ২০,০০০-এর মধ্যে হতে হবে।",
  "Enter a whole number of pages.": "পৃষ্ঠা সংখ্যা পূর্ণসংখ্যায় লিখুন।",
  "Save a draft and upload files before publishing.": "প্রকাশের আগে খসড়া সংরক্ষণ করে ফাইল আপলোড করুন।",
  "Upload a PDF or EPUB before publishing.": "প্রকাশের আগে PDF বা EPUB ফাইল আপলোড করুন।",
  "Upload a cover before publishing a real book.": "আসল বই প্রকাশের আগে প্রচ্ছদ আপলোড করুন।",
  "This book URL is already in use.": "এই বইয়ের URL আগে থেকেই ব্যবহৃত হচ্ছে।",
  "Choose a PNG, JPG, or WebP image.": "PNG, JPG বা WebP ছবি বেছে নিন।",
  "Choose a PNG, JPG, or WebP cover.": "PNG, JPG বা WebP প্রচ্ছদ বেছে নিন।",
  "The cover filename does not match its image format. Rename or convert the file and try again.": "প্রচ্ছদের নাম ও ছবির ধরন মিলছে না। নাম ঠিক করুন বা ছবি রূপান্তর করুন।",
  "Choose a cover between 1 byte and 5 MB.": "১ বাইট থেকে ৫ MB-এর মধ্যে প্রচ্ছদ বেছে নিন।",
  "Choose a PDF between 1 byte and 30 MB.": "১ বাইট থেকে ৩০ MB-এর মধ্যে PDF বেছে নিন।",
  "Choose an EPUB between 1 byte and 30 MB.": "১ বাইট থেকে ৩০ MB-এর মধ্যে EPUB বেছে নিন।",
  "Choose a .pdf file.": ".pdf ফাইল বেছে নিন।",
  "Choose a .epub file.": ".epub ফাইল বেছে নিন।",
  "Choose a file between 1 byte and 5 MB.": "১ বাইট থেকে ৫ MB-এর মধ্যে ফাইল বেছে নিন।",
  "Choose a file between 1 byte and 30 MB.": "১ বাইট থেকে ৩০ MB-এর মধ্যে ফাইল বেছে নিন।",
  "This file is not a valid PNG, JPG, or WebP image. Check the file and try again.": "ফাইলটি বৈধ PNG, JPG বা WebP ছবি নয়। অন্য ফাইল দিয়ে চেষ্টা করুন।",
  "This file is not a valid PDF. Check the file and try again.": "ফাইলটি বৈধ PDF নয়। অন্য ফাইল দিয়ে চেষ্টা করুন।",
  "This file is not a valid EPUB. Check the file and try again.": "ফাইলটি বৈধ EPUB নয়। অন্য ফাইল দিয়ে চেষ্টা করুন।",
  "Network error. Check your connection and try again.": "ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",
  "Upload failed. Please retry.": "আপলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।",
  "Save the book before uploading files.": "ফাইল আপলোডের আগে বইটি সংরক্ষণ করুন।",
  "Choose a file to upload.": "আপলোডের জন্য ফাইল বেছে নিন।",
  "Save this book as a sample before adding a test PDF.": "পরীক্ষার PDF যোগ করার আগে বইটি নমুনা হিসেবে সংরক্ষণ করুন।",
  "A PDF is already uploaded. Use the PDF upload control to replace it.": "PDF ইতিমধ্যে আছে। বদলাতে PDF আপলোড ব্যবহার করুন।",
  "Unpublish this book before changing its test file.": "পরীক্ষার ফাইল বদলানোর আগে বইটি অপ্রকাশিত করুন।",
  "Choose a sample PDF.": "একটি নমুনা PDF বেছে নিন।",
  "This PDF is corrupt, encrypted, or unsupported. Upload an unprotected sample PDF instead.": "PDF-টি নষ্ট, পাসওয়ার্ড-সুরক্ষিত বা সমর্থিত নয়। পাসওয়ার্ড ছাড়া একটি নমুনা PDF আপলোড করুন।",
  "Upload a PDF ebook or a separate sample PDF before enabling previews.": "প্রিভিউ চালু করার আগে ইবুক PDF অথবা আলাদা নমুনা PDF আপলোড করুন।",
  "The PDF page count is not supported.": "এই PDF-এর পৃষ্ঠা সংখ্যা সমর্থিত নয়।",
  "The preview is too large. Choose fewer pages or upload a smaller sample PDF.": "প্রিভিউ ফাইলটি বড়। কম পৃষ্ঠা নিন অথবা ছোট নমুনা PDF আপলোড করুন।",
  "Could not read the preview source PDF.": "প্রিভিউর উৎস PDF পড়া যায়নি। আবার চেষ্টা করুন।",
  "This book already has a PDF ebook. Set its preview page count instead.": "এই বইয়ে PDF আছে। আলাদা নমুনা আপলোড না করে প্রিভিউ পৃষ্ঠা সংখ্যা ঠিক করুন।",
  "Upload the EPUB ebook before adding a sample PDF.": "নমুনা PDF যোগ করার আগে EPUB আপলোড করুন।",
};

function uploadFile(bookId: string, kind: UploadKind, file: File, onProgress: (progress: number) => void): Promise<{ name: string; path?: string; previewPages?: number; sourcePages?: number }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.set("bookId", bookId);
    form.set("kind", kind);
    form.set("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("Network error. Check your connection and try again."));
    xhr.onload = () => {
      let result: { error?: string; requestId?: string; name?: string; path?: string; previewPages?: number; sourcePages?: number } = {};
      try { result = JSON.parse(xhr.responseText); } catch { /* The server may have returned an HTML error page. */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve({ name: result.name || file.name, path: result.path,
        previewPages: result.previewPages, sourcePages: result.sourcePages });
      else reject(new Error(`${result.error || "Upload failed. Please retry."}${result.requestId ? ` (request ${result.requestId})` : ""}`));
    };
    xhr.send(form);
  });
}

export function BookEditor({
  book, ownerId, sandbox, restored, onSaved, onUploaded, onPreviewSaved, onSuccess, onClose, onDraftChange,
}: {
  book?: Book;
  ownerId: string;
  sandbox: boolean;
  restored?: BookFormValues | null;
  onSaved: (id: string, values: BookFormValues) => void;
  onUploaded: (id: string, kind: UploadKind, name: string, path?: string) => void;
  onPreviewSaved: (id: string, pages: number, sourcePages: number, sourceKind: "book_pdf" | "sample_pdf" | null) => void;
  onSuccess: (message: string) => void;
  onClose: () => void;
  onDraftChange: (values: BookFormValues | null) => void;
}) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [values, setValues] = useState<BookFormValues>(book ? bookValues(book) : { ...(restored || blankBook), published: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [uploads, setUploads] = useState<Partial<Record<UploadKind, UploadState>>>({});
  const [previewCount, setPreviewCount] = useState(String(book?.preview_pages || 0));
  const [previewError, setPreviewError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasEbook = !!book?.formats.some((format) => format === "PDF" || format === "EPUB") || uploads.pdf?.phase === "done" || uploads.epub?.phase === "done";
  const hasCover = !!book?.cover_path || uploads.cover?.phase === "done";
  const missingPublicationFile = !hasEbook
    ? "Upload a PDF or EPUB before publishing."
    : !values.is_demo && !hasCover
      ? "Upload a cover before publishing a real book."
      : null;

  function localize(message: string) {
    if (locale !== "bn") return message;
    const suffix = / \(request [a-f0-9-]{36}\)$/.exec(message)?.[0] || "";
    const base = suffix ? message.slice(0, -suffix.length) : message;
    const maximum = /^Choose at most (\d+) preview pages so at least one page stays private\.$/.exec(base);
    if (maximum) return `শেষ পৃষ্ঠাটি ক্রেতাদের জন্য রাখতে সর্বোচ্চ ${maximum[1]} পৃষ্ঠা প্রিভিউ দিন।${suffix}`;
    const sample = /^This sample PDF has only (\d+) pages\.$/.exec(base);
    if (sample) return `নমুনা PDF-এ মাত্র ${sample[1]} পৃষ্ঠা আছে।${suffix}`;
    return `${bnErrors[base] || base}${suffix}`;
  }
  function change(field: keyof BookFormValues, value: string | boolean) {
    const next = { ...values, [field]: value } as BookFormValues;
    setValues(next);
    setErrors((current) => { const copy = { ...current }; delete copy[field]; if (field === "price") delete copy.price_paisa; return copy; });
    setFormError("");
    if (!book) {
      try {
        window.localStorage.setItem(draftKey(ownerId), JSON.stringify({ version: 1, values: next }));
        onDraftChange(next);
      } catch {
        setNotice(t("এই ব্রাউজারে খসড়া সংরক্ষণ করা যাচ্ছে না।", "This browser cannot save a local draft."));
      }
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    setFormError(""); setNotice(""); setErrors({});
    const body = {
      ...values, id: book?.id,
      price_paisa: /^\d+(?:\.\d{1,2})?$/.test(values.price) ? Math.round(Number(values.price) * 100) : NaN,
      pages: /^\d+$/.test(values.pages.trim()) ? Number(values.pages) : NaN,
    };
    const validation = bookInput.safeParse(body);
    if (!validation.success) {
      const fields = validation.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      for (const [field, messages] of Object.entries(fields)) if (messages?.[0]) mapped[field === "price_paisa" ? "price" : field] = messages[0];
      if (Number.isNaN(body.price_paisa)) mapped.price = "Enter a price with no more than two decimal places.";
      if (Number.isNaN(body.pages)) mapped.pages = "Enter a whole number of pages.";
      setErrors(mapped);
      setFormError(t("চিহ্নিত ঘরগুলো ঠিক করুন। লেখা সংরক্ষিত আছে।", "Fix the highlighted fields. Your entries are still here."));
      return;
    }
    if (values.published && missingPublicationFile) {
      setErrors({ published: missingPublicationFile });
      setFormError(localize(missingPublicationFile));
      document.getElementById("published-help")?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    busyRef.current = true; setBusy(true);
    try {
      const response = await fetch("/api/admin/books", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validation.data),
      });
      const result = await response.json();
      if (!response.ok) {
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(result.fields || {})) {
          if (Array.isArray(messages) && typeof messages[0] === "string") mapped[field === "price_paisa" ? "price" : field] = messages[0];
        }
        setErrors(mapped);
        setFormError(`${localize(result.error || t("সংরক্ষণ ব্যর্থ হয়েছে। আবার চেষ্টা করুন।", "Save failed. Please retry."))}${result.requestId ? ` (${t("অনুরোধ", "request")} ${result.requestId})` : ""}`);
        return;
      }
      if (!book) {
        try { window.localStorage.removeItem(draftKey(ownerId)); } catch { /* Storage may be unavailable. */ }
        onDraftChange(null);
      }
      onSaved(result.id, values);
      onSuccess(!book ? t("খসড়া সংরক্ষিত হয়েছে। নিচে ফাইল আপলোড করুন।", "Draft saved. Upload files below.")
        : values.published && !book.published ? t("বই প্রকাশিত হয়েছে।", "Book published.")
        : !values.published && book.published ? t("বইটি অপ্রকাশিত হয়েছে।", "Book unpublished.")
        : t("পরিবর্তন সংরক্ষিত হয়েছে।", "Changes saved."));
      router.refresh();
    } catch {
      setFormError(t("সংযোগে সমস্যা হয়েছে। লেখা সংরক্ষিত আছে; আবার চেষ্টা করুন।", "Connection failed. Your entries are still here; please retry."));
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function upload(kind: UploadKind, file?: File) {
    if (!book?.id || !file) return;
    if (busyRef.current) return;
    const existing = kind === "cover" ? !!book.cover_path : book.formats.includes(kind.toUpperCase());
    const problem = uploadProblem(kind, file.name, file.size);
    if (problem) {
      setUploads((current) => ({ ...current, [kind]: { phase: "error", progress: 0, filename: file.name, error: problem } }));
      return;
    }
    busyRef.current = true; setBusy(true); setFormError(""); setNotice("");
    setUploads((current) => ({ ...current, [kind]: { phase: "uploading", progress: 0, filename: file.name } }));
    try {
      const result = await uploadFile(book.id, kind, file, (progress) => {
        setUploads((current) => ({ ...current, [kind]: { phase: progress === 100 ? "processing" : "uploading", progress, filename: file.name } }));
      });
      setUploads((current) => ({ ...current, [kind]: { phase: "done", progress: 100, filename: result.name, replaced: existing } }));
      onUploaded(book.id, kind, result.name, result.path);
      if (kind === "pdf" && result.previewPages !== undefined)
        onPreviewSaved(book.id, result.previewPages, result.sourcePages || 0,
          result.previewPages > 0 ? "book_pdf" : null);
      onSuccess(t(`${kind.toUpperCase()} ফাইল সংরক্ষিত হয়েছে।`, `${kind.toUpperCase()} uploaded successfully.`));
      router.refresh();
    } catch (error) {
      setUploads((current) => ({ ...current, [kind]: { phase: "error", progress: 0, filename: file.name, error: (error as Error).message } }));
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function addSamplePdf() {
    if (!book?.id || busyRef.current) return;
    busyRef.current = true; setBusy(true); setFormError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/sample-pdf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(`${result.error || "Could not create test PDF."}${result.requestId ? ` (request ${result.requestId})` : ""}`);
      setUploads((current) => ({ ...current, pdf: { phase: "done", progress: 100, filename: result.name } }));
      onUploaded(book.id, "pdf", result.name);
      onSuccess(t("পরীক্ষার PDF তৈরি হয়েছে। এখন বইটি প্রকাশ করতে পারেন।", "Test PDF created. You can now publish the book."));
      router.refresh();
    } catch (error) {
      setFormError(localize((error as Error).message));
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function savePreview() {
    if (!book?.id || busyRef.current) return;
    if (!/^\d+$/.test(previewCount.trim())) {
      setPreviewError(t("০ বা তার বেশি পূর্ণসংখ্যা লিখুন।", "Enter zero or a whole number of pages."));
      return;
    }
    const pages = Number(previewCount);
    if (pages > 20000) { setPreviewError(t("পৃষ্ঠা সংখ্যা ২০,০০০-এর বেশি হতে পারে না।", "Preview page count cannot exceed 20,000.")); return; }
    busyRef.current = true; setBusy(true); setPreviewError("");
    try {
      const response = await fetch(`/api/admin/books/${book.id}/preview`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pages }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(`${result.error || "Preview could not be saved."}${result.requestId ? ` (request ${result.requestId})` : ""}`);
      onPreviewSaved(book.id, result.previewPages, result.sourcePages || 0, result.sourceKind || null);
      onSuccess(pages === 0 ? t("প্রিভিউ বন্ধ হয়েছে।", "Preview disabled.") : t("প্রিভিউ তৈরি ও সংরক্ষিত হয়েছে।", "Preview generated and saved."));
      router.refresh();
    } catch (error) { setPreviewError(localize((error as Error).message)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function uploadPreviewSource(file?: File) {
    if (!book?.id || !file || busyRef.current) return;
    const problem = uploadProblem("pdf", file.name, file.size);
    if (problem) { setPreviewError(localize(problem)); return; }
    if (!/^\d+$/.test(previewCount.trim()) || Number(previewCount) > 20000) { setPreviewError(t("০ থেকে ২০,০০০-এর মধ্যে পূর্ণসংখ্যা লিখুন।", "Enter a whole number from 0 to 20,000.")); return; }
    busyRef.current = true; setBusy(true); setPreviewError("");
    try {
      const form = new FormData();
      form.set("file", file); form.set("pages", previewCount.trim());
      const response = await fetch(`/api/admin/books/${book.id}/preview-source`, { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(`${result.error || "Sample PDF could not be saved."}${result.requestId ? ` (request ${result.requestId})` : ""}`);
      onPreviewSaved(book.id, result.previewPages, result.sourcePages, "sample_pdf");
      onSuccess(t("নমুনা PDF সংরক্ষিত হয়েছে।", "Sample PDF uploaded and preview saved."));
      router.refresh();
    } catch (error) { setPreviewError(localize((error as Error).message)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function fieldError(field: string) {
    return errors[field] ? <span id={`${field}-error`} className="field-error" role="alert">{localize(errors[field])}</span> : null;
  }
  function input(name: keyof BookFormValues, label: string, helper?: string) {
    return <label key={name} htmlFor={`book-${name}`}>
      {label}
      <input id={`book-${name}`} name={name} value={String(values[name])} onChange={(e) => change(name, e.target.value)} inputMode={name === "price" ? "decimal" : name === "pages" ? "numeric" : undefined} autoCapitalize={name === "slug" ? "none" : undefined} spellCheck={name === "slug" ? false : undefined} aria-required="true" aria-invalid={!!errors[name]} aria-describedby={[helper && `${name}-help`, errors[name] && `${name}-error`].filter(Boolean).join(" ") || undefined} />
      {helper && <span id={`${name}-help`} className="field-help">{helper}</span>}
      {fieldError(name)}
    </label>;
  }
  function select(name: "category" | "language" | "cover_style", label: string, options: { value: string; label: string }[]) {
    return <label key={name} htmlFor={`book-${name}`}>
      {label}<select id={`book-${name}`} name={name} value={values[name]} onChange={(e) => change(name, e.target.value)} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>{fieldError(name)}
    </label>;
  }
  return <div className="panel admin-form" aria-label={t("বই সম্পাদক", "Book editor")}>
    <div className="admin-heading"><h2>{book ? t("বই সম্পাদনা", "Edit book") : t("নতুন বই", "New book")}</h2>
      <button type="button" className="icon-button" aria-label={t("সম্পাদক বন্ধ করুন", "Close editor")} onClick={onClose}><X /></button>
    </div>
    <ol className="editor-steps" aria-label={t("প্রকাশের ধাপ", "Publishing steps")}>
      <li className="active">1. {t("বইয়ের তথ্য", "Book information")}</li>
      <li className={book ? "complete" : ""}>2. {t("খসড়া সংরক্ষণ", "Save as draft")}</li>
      <li className={book ? "active" : ""}>3. {t("প্রচ্ছদ ও ইবুক ফাইল আপলোড", "Upload cover and ebook files")}</li>
    </ol>
    {!book && <p className="draft-note">{restored ? t("পুনরুদ্ধার করা, এখনো সংরক্ষণ করা হয়নি এমন খসড়া।", "Restored unsaved browser draft.") : t("আপনার লেখা এই ব্রাউজারে সাময়িকভাবে সংরক্ষিত হবে।", "Your unfinished details are saved in this browser.")}</p>}
    {book && <p className="draft-note" role="status">{t("সার্ভারে সংরক্ষিত অবস্থা:", "Saved on server:")} <strong>{book.published ? t("প্রকাশিত", "Published") : t("খসড়া", "Draft")}</strong>{values.published !== book.published && ` · ${t("নতুন অবস্থা সংরক্ষণ করা হয়নি", "status change not saved yet")}`}</p>}
    {formError && <p className="notice error" role="alert">{formError}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <form onSubmit={save} noValidate>
      <div className="form-grid">
        {input("title_bn", "বইয়ের নাম (বাংলা)")}
        {input("title_en", "Title (English)")}
        {input("author_bn", "লেখক (বাংলা)")}
        {input("author_en", "Author (English)")}
        {input("slug", "URL slug", t("যেমন: amar-boi। শুধু ছোট হাতের ইংরেজি অক্ষর, সংখ্যা ও হাইফেন।", "Example: my-book. Use lowercase letters, numbers, and hyphens."))}
        {input("price", t("মূল্য (টাকা)", "Price (BDT)"), t("১০ থেকে ১,০০,০০০ টাকা; দশমিকের পরে সর্বোচ্চ ২ সংখ্যা।", "10–100,000 BDT; up to two decimal places."))}
        {select("category", t("বিভাগ", "Category"), categories.filter((x) => x.id !== "all").map((x) => ({ value: x.id, label: x[locale] })))}
        {select("language", t("ভাষা", "Language"), [{ value: "bn", label: "বাংলা" }, { value: "en", label: "English" }])}
        {input("pages", t("পৃষ্ঠা", "Pages"), t("১ থেকে ২০,০০০-এর মধ্যে পূর্ণসংখ্যা।", "A whole number between 1 and 20,000."))}
        {select("cover_style", t("প্রচ্ছদের রং", "Fallback cover colour"), ["forest", "blue", "orange", "pink", "olive", "violet", "yellow", "red"].map((x) => ({ value: x, label: x })))}
      </div>
      {(["description_bn", "description_en"] as const).map((name) => <label key={name} htmlFor={`book-${name}`}>
        {name === "description_bn" ? "বিবরণ (বাংলা)" : "Description (English)"}
        <textarea id={`book-${name}`} name={name} value={values[name]} onChange={(e) => change(name, e.target.value)} aria-required="true" aria-invalid={!!errors[name]} aria-describedby={`${name}-help${errors[name] ? ` ${name}-error` : ""}`} />
        <span id={`${name}-help`} className="field-help">{t("কমপক্ষে ১০টি অক্ষর লিখুন।", "Write at least 10 characters.")}</span>{fieldError(name)}
      </label>)}
      <div className="form-grid">
        <label className="checkbox"><input type="checkbox" name="published" checked={values.published} disabled={!book} onChange={(e) => change("published", e.target.checked)} aria-describedby={`published-help${errors.published ? " published-error" : ""}`} />{t("প্রকাশিত", "Published")}</label>
        <label className="checkbox"><input type="checkbox" name="is_demo" checked={values.is_demo} onChange={(e) => change("is_demo", e.target.checked)} />{t("নমুনা বই", "Sample book")}</label>
        <label className="checkbox"><input type="checkbox" name="featured" checked={values.featured} onChange={(e) => change("featured", e.target.checked)} />{t("বিশেষ বাছাই", "Featured")}</label>
      </div>
      <p id="published-help" className="field-help">{book ? t("প্রকাশ করতে PDF অথবা EPUB লাগবে। নমুনা নয় এমন বইয়ে প্রচ্ছদও লাগবে।", "Publishing needs a PDF or EPUB. Non-sample books also need a cover.") : t("প্রথমে খসড়া সংরক্ষণ করুন, তারপর ফাইল আপলোড করে প্রকাশ করুন।", "Save a draft first, then upload files and publish.")}</p>
      {book && <ul className="publish-checklist" aria-label={t("প্রকাশের প্রস্তুতি", "Publishing requirements")}>
        <li>{hasEbook ? "✓" : "○"} {t("PDF অথবা EPUB আপলোড", "PDF or EPUB uploaded")}</li>
        <li>{values.is_demo || hasCover ? "✓" : "○"} {values.is_demo ? t("নমুনা বইয়ের জন্য প্রচ্ছদ ঐচ্ছিক", "Cover optional for sample book") : t("প্রচ্ছদ আপলোড", "Cover uploaded")}</li>
      </ul>}
      {fieldError("published")}
      <button className="button" type="submit" disabled={busy}>{busy && <LoaderCircle className="spin" size={16} />} {!book ? t("খসড়া সংরক্ষণ করুন", "Save as draft") : values.published && !book.published ? t("বই প্রকাশ করুন", "Publish book") : t("পরিবর্তন সংরক্ষণ করুন", "Save changes")}</button>
    </form>
    {book ? <section className="file-step" aria-label={t("ফাইল আপলোড", "Upload files")}>
      <h3>{t("ধাপ ৩: প্রচ্ছদ ও ইবুক ফাইল", "Step 3: cover and ebook files")}</h3>
      <p>{t("একটি PDF অথবা EPUB আপলোড করলেই প্রকাশ করা যাবে। একই ধরনের নতুন ফাইল পুরোনোটি বদলে দেবে।", "Upload either a PDF or an EPUB to publish. A new file of the same type replaces the current one.")}</p>
      {values.is_demo && <div className="sample-file-help">
        <p>{t("নমুনা চিহ্ন দিলেই ফাইল তৈরি হয় না। নিজের PDF/EPUB আপলোড করুন, অথবা পরীক্ষার জন্য একটি এক-পৃষ্ঠার PDF তৈরি করুন।", "Marking a book as a sample does not add an ebook. Upload your own PDF/EPUB, or create a one-page test PDF.")}</p>
        {sandbox && !book.formats.includes("PDF") && uploads.pdf?.phase !== "done" && !book.published && <button type="button" className="button secondary" disabled={busy || !book.is_demo} onClick={() => void addSamplePdf()}>{t("পরীক্ষার PDF তৈরি করুন", "Create test PDF")}</button>}
        {!book.is_demo && <p className="field-help">{t("প্রথমে নমুনা বই হিসেবে পরিবর্তন সংরক্ষণ করুন।", "Save the book as a sample first.")}</p>}
      </div>}
      <div className="upload-grid">{uploadKinds.map((kind) => {
        const state = uploads[kind];
        const existing = kind === "cover" ? !!book.cover_path : book.formats.includes(kind.toUpperCase());
        const existingName = kind !== "cover" ? book.format_names?.[kind] : undefined;
        const label = kind === "cover" ? t("প্রচ্ছদের ছবি · PNG/JPG/WebP · সর্বোচ্চ ৫ MB", "Cover image · PNG/JPG/WebP · up to 5 MB") : kind === "pdf" ? t("PDF ইবুক · সর্বোচ্চ ৩০ MB", "PDF ebook · up to 30 MB") : t("EPUB ইবুক · সর্বোচ্চ ৩০ MB", "EPUB ebook · up to 30 MB");
        return <div className="upload-card" key={kind}>
          <label htmlFor={`upload-${kind}`}><span><Upload size={16} /> {label}</span>
            <input id={`upload-${kind}`} type="file" disabled={busy} accept={kind === "cover" ? ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" : `.${kind}`} onChange={(e) => { void upload(kind, e.target.files?.[0]); e.target.value = ""; }} aria-describedby={`${kind}-status`} />
          </label>
          <p id={`${kind}-status`} className={state?.phase === "error" ? "field-error" : "field-help"} role={state?.phase === "error" ? "alert" : "status"}>
            {state?.phase === "error" ? `${state.filename}: ${localize(state.error || "Upload failed. Please retry.")}` : state?.phase === "uploading" ? `${t("আপলোড হচ্ছে", "Uploading")} ${state.progress}% — ${state.filename}` : state?.phase === "processing" ? `${t("সংরক্ষণ হচ্ছে", "Finishing")} — ${state.filename}` : state?.phase === "done" ? `${state.filename} — ${state.replaced ? t("আগের ফাইল বদলানো হয়েছে", "previous file replaced") : t("আপলোড হয়েছে", "uploaded")}` : existing ? `${existingName || t("ফাইল আপলোড করা আছে", "File uploaded")} · ${t("বদলাতে নতুন ফাইল বেছে নিন", "Choose a new file to replace it")}` : t("কোনো ফাইল আপলোড করা হয়নি", "No file uploaded yet")}
          </p>
          {state?.phase === "uploading" && <progress value={state.progress} max="100" aria-label={`${kind.toUpperCase()} upload progress`} />}
        </div>;
      })}</div>
      <div className="preview-admin">
        <h3>{t("বিনামূল্যে পড়ার প্রিভিউ", "Free reading preview")}</h3>
        <p>{t("কত পৃষ্ঠা বিনামূল্যে দেখা যাবে তা ঠিক করুন। ০ লিখলে প্রিভিউ বন্ধ থাকবে। আসল PDF-এর অন্তত শেষ পৃষ্ঠাটি কেবল ক্রেতাদের জন্য থাকবে।", "Choose how many pages visitors can read. Enter 0 to disable. At least the last page of the paid PDF stays private.")}</p>
        <label htmlFor="preview-pages">{t("প্রিভিউ পৃষ্ঠা সংখ্যা", "Preview pages")}
          <input id="preview-pages" inputMode="numeric" value={previewCount} onChange={(event) => { setPreviewCount(event.target.value); setPreviewError(""); }} aria-invalid={!!previewError} aria-describedby={previewError ? "preview-error" : "preview-help"} />
        </label>
        <p id="preview-help" className="field-help">{t("বর্তমানে সংরক্ষিত:", "Currently saved:")} {book.preview_pages || 0} · {book.preview_source_pages ? `${book.preview_source_pages} ${t("পৃষ্ঠা উৎস PDF-এ", "pages in source PDF")}` : t("এখনো উৎস PDF যাচাই হয়নি", "source PDF not inspected yet")}</p>
        {previewError && <p id="preview-error" className="field-error" role="alert">{previewError}</p>}
        {book.formats.includes("PDF") ? <button type="button" className="button secondary" disabled={busy} onClick={() => void savePreview()}>{t("প্রিভিউ সংরক্ষণ করুন", "Save preview")}</button> : book.formats.includes("EPUB") ? <>
          <p className="field-help">{t("শুধু EPUB থাকলে আলাদা নমুনা PDF আপলোড করুন। সেই ফাইলের প্রথম নির্বাচিত পৃষ্ঠাগুলো দেখানো হবে।", "For an EPUB-only book, upload a separate sample PDF. Visitors see its first selected pages.")}</p>
          <label htmlFor="preview-source">{t("নমুনা PDF · সর্বোচ্চ ৩০ MB", "Sample PDF · up to 30 MB")}
            <input id="preview-source" type="file" accept=".pdf,application/pdf" disabled={busy} onChange={(event) => { void uploadPreviewSource(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          {book.preview_source_kind === "sample_pdf" && <button type="button" className="button secondary" disabled={busy} onClick={() => void savePreview()}>{t("পৃষ্ঠা সংখ্যা পরিবর্তন করুন", "Update page count")}</button>}
        </> : <p className="field-help">{t("প্রথমে PDF অথবা EPUB আপলোড করুন।", "Upload a PDF or EPUB first.")}</p>}
        {!!book.preview_pages && <button type="button" className="button secondary" onClick={() => setPreviewOpen(true)}>{t("দর্শকের মতো প্রিভিউ দেখুন", "View preview as visitor")}</button>}
      </div>
      <PreviewDialog bookId={book.id} admin open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </section> : <p className="field-help file-step">{t("প্রথমে তথ্য সংরক্ষণ করুন। তারপর এখানে প্রচ্ছদ, PDF ও EPUB আপলোডের ঘর দেখা যাবে।", "Save the book information first. The cover, PDF, and EPUB upload controls will appear here.")}</p>}
  </div>;
}
