"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  CheckCircle2,
  Circle,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useLanguage, Price, statusLabel } from "./store";
import { BookEditor } from "./book-editor";
import { SuccessToast, type ToastMessage } from "./success-toast";
import { draftKey, parseBookDraft, type BookFormValues } from "@/lib/book-draft";
import type { Book, Order, Policy } from "@/lib/types";
type Gate = { key: string; label: string; passed: boolean };
export function Admin({
  books,
  orders,
  policies,
  gates,
  mode,
  ownerId,
  cleanupPending,
}: {
  books: Book[];
  orders: Order[];
  policies: Policy[];
  gates: Gate[];
  mode: string;
  ownerId: string;
  cleanupPending: number;
}) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [tab, setTab] = useState("books");
  const [editing, setEditing] = useState<string | null>(null);
  const [recentBook, setRecentBook] = useState<Book | null>(null);
  const [savedDraft, setSavedDraft] = useState<BookFormValues | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<BookFormValues | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastMessage>(null);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [archiveOverrides, setArchiveOverrides] = useState<Record<string, string | null>>({});
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [pendingCleanup, setPendingCleanup] = useState(cleanupPending);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const showToast = useCallback((message: string) => setToast({ id: Date.now(), text: message }), []);
  const dismissToast = useCallback(() => setToast(null), []);
  const displayBooks = (recentBook
    ? books.some((book) => book.id === recentBook.id)
      ? books.map((book) => book.id === recentBook.id ? recentBook : book)
      : [recentBook, ...books]
    : books).filter((book) => !removedIds.includes(book.id)).map((book) =>
      Object.hasOwn(archiveOverrides, book.id)
        ? { ...book, archived_at: archiveOverrides[book.id], published: archiveOverrides[book.id] ? false : book.published }
        : book);
  const visibleBooks = displayBooks.filter((book) => tab === "archived" ? !!book.archived_at : !book.archived_at);
  useEffect(() => {
    try { setSavedDraft(parseBookDraft(window.localStorage.getItem(draftKey(ownerId)))); }
    catch { setSavedDraft(null); }
  }, [ownerId]);
  useEffect(() => { setPendingCleanup(cleanupPending); }, [cleanupPending]);
  async function send(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    return result;
  }
  async function savePolicy(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const data = new FormData(e.currentTarget);
    try {
      await send("/api/admin/policies", {
        ...Object.fromEntries(data),
        published: data.get("published") === "on",
      });
      showToast(t("নীতিমালা সংরক্ষিত হয়েছে।", "Policy saved."));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function askDelete(book: Book) {
    setDeleteTarget(book);
    deleteDialog.current?.showModal();
  }
  async function deleteBook() {
    if (!deleteTarget || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/books/${deleteTarget.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(`${result.error || "Delete failed."}${result.requestId ? ` (request ${result.requestId})` : ""}`);
      if (result.action === "archived") {
        setArchiveOverrides((current) => ({ ...current, [deleteTarget.id]: new Date().toISOString() }));
        showToast(t("অর্ডার থাকায় বইটি আর্কাইভ করা হয়েছে। আগের ক্রেতারা ডাউনলোড করতে পারবেন।", "Book archived because orders exist. Existing buyers keep their downloads."));
      } else {
        setRemovedIds((current) => [...current, deleteTarget.id]);
        if (result.cleanupPending) setPendingCleanup((current) => current + 1);
        showToast(result.cleanupPending ? t("বই মুছে ফেলা হয়েছে। কিছু ফাইল পরিষ্কার করা বাকি আছে।", "Book deleted. Some file cleanup is pending.") : t("বই ও ফাইল মুছে ফেলা হয়েছে।", "Book and files deleted."));
      }
      if (editing === deleteTarget.id) setEditing(null);
      if (recentBook?.id === deleteTarget.id) setRecentBook(null);
      deleteDialog.current?.close();
      router.refresh();
    } catch (failure) { setError((failure as Error).message); deleteDialog.current?.close(); }
    finally { setBusy(false); }
  }
  async function restoreBook(book: Book) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await send(`/api/admin/books/${book.id}/restore`, {});
      setArchiveOverrides((current) => ({ ...current, [book.id]: null }));
      showToast(t("বইটি খসড়া হিসেবে ফিরেছে। প্রকাশের আগে যাচাই করুন।", "Book restored as a draft. Review it before publishing."));
      router.refresh();
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  async function retryCleanup() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await send("/api/admin/storage-cleanup", {});
      setPendingCleanup(result.remaining || 0);
      showToast(result.remaining ? t("কিছু ফাইল এখনো পরিষ্কার হয়নি। পরে আবার চেষ্টা করুন।", "Some files still need cleanup. Retry later.") : t("ফাইল পরিষ্কার করা হয়েছে।", "File cleanup completed."));
      router.refresh();
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <div className="container page">
      <div className="admin-heading">
        <div>
          <span className="eyebrow muted">
            {t("শুধু স্টোর মালিকের জন্য", "OWNER WORKSPACE")}
          </span>
          <h1>{t("স্টোর পরিচালনা", "Your store, at a glance")}</h1>
        </div>
        {tab === "books" && (
          <button
            className="button"
            onClick={() => {
              if (savedDraft) {
                setEditing(null);
                setNotice(t("আগের খসড়া ফিরিয়ে আনুন অথবা মুছুন।", "Restore or discard the existing browser draft first."));
                return;
              }
              setEditing("new");
              setRestoredDraft(null);
              setNotice("");
              setError("");
            }}
          >
            <Plus size={17} />
            {t("নতুন বই", "Add a book")}
          </button>
        )}
      </div>
      <div className="admin-stats">
        <div className="panel">
          <strong>{displayBooks.filter((book) => !book.archived_at).length}</strong>
          <span>{t("ক্যাটালগে বই", "Books in catalogue")}</span>
        </div>
        <div className="panel">
          <strong>{orders.filter((o) => o.status === "paid").length}</strong>
          <span>{t("সাম্প্রতিক সম্পন্ন অর্ডার", "Recent paid orders")}</span>
        </div>
        <div className="panel">
          <strong>
            {mode === "sandbox" ? t("পরীক্ষা", "Sandbox") : "Live"}
          </strong>
          <span>{t("পেমেন্ট পরিবেশ", "Payment environment")}</span>
        </div>
      </div>
      <div className="admin-tabs" role="group" aria-label="Admin sections">
        {[
          ["books", "বই", "Books"],
          ["archived", "আর্কাইভ", "Archived"],
          ["orders", "অর্ডার", "Orders"],
          ["policies", "নীতিমালা", "Policies"],
          ["launch", "প্রকাশের প্রস্তুতি", "Launch readiness"],
        ].map(([id, bn, en]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id);
              setNotice("");
              setError("");
            }}
          >
            {t(bn, en)}
          </button>
        ))}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {pendingCleanup > 0 && <div className="notice" role="status">
        {t("কিছু পুরোনো ফাইল পরিষ্কার করা বাকি আছে।", "Some old files are pending cleanup.")}{" "}
        <button className="button secondary" type="button" disabled={busy} onClick={() => void retryCleanup()}>{t("আবার চেষ্টা করুন", "Retry cleanup")}</button>
      </div>}
      {tab === "books" && (
        <>
          {savedDraft && !editing && (
            <div className="notice draft-recovery" role="status">
              <p>{t("এই ব্রাউজারে একটি অসম্পূর্ণ বইয়ের খসড়া আছে।", "An unsaved book draft is in this browser.")}</p>
              <div className="form-actions">
                <button className="button" type="button" onClick={() => { setRestoredDraft(savedDraft); setEditing("new"); setNotice(""); }}>
                  {t("খসড়া ফিরিয়ে আনুন", "Restore draft")}
                </button>
                <button className="button secondary" type="button" onClick={() => {
                  try { window.localStorage.removeItem(draftKey(ownerId)); } catch { /* Storage may be unavailable. */ }
                  setSavedDraft(null); setRestoredDraft(null);
                }}>
                  {t("খসড়া মুছুন", "Discard draft")}
                </button>
              </div>
            </div>
          )}
          {editing && <BookEditor
            key={editing}
            book={editing === "new" ? undefined : recentBook?.id === editing ? recentBook : books.find((book) => book.id === editing)}
            ownerId={ownerId}
            sandbox={mode === "sandbox"}
            restored={editing === "new" ? restoredDraft : null}
            onClose={() => { setEditing(null); setRestoredDraft(null); }}
            onDraftChange={setSavedDraft}
            onSuccess={showToast}
            onPreviewSaved={(id, pages, sourcePages, sourceKind) => {
              setRecentBook((current) => {
                const existing = current?.id === id ? current : books.find((book) => book.id === id);
                return existing ? { ...existing, preview_pages: pages, preview_source_pages: sourcePages,
                  preview_source_kind: sourceKind || undefined } : current;
              });
            }}
            onPagesDetected={(id, pages) => {
              setRecentBook((current) => {
                const existing = current?.id === id ? current : books.find((book) => book.id === id);
                return existing ? { ...existing, pages } : current;
              });
            }}
            onSaved={(id, values) => {
              const existing = recentBook?.id === id ? recentBook : books.find((book) => book.id === id);
              setRecentBook({
                id, slug: values.slug, title_bn: values.title_bn, title_en: values.title_en,
                author_bn: values.author_bn, author_en: values.author_en,
                description_bn: values.description_bn, description_en: values.description_en,
                category: values.category, price_paisa: Math.round(Number(values.price) * 100),
                pages: Number(values.pages), language: values.language,
                cover_style: values.cover_style, cover_path: existing?.cover_path || null,
                formats: existing?.formats || [], format_names: existing?.format_names,
                published: values.published, is_demo: values.is_demo, featured: values.featured,
                archived_at: existing?.archived_at || null,
                preview_pages: existing?.preview_pages || 0,
                preview_source_pages: existing?.preview_source_pages,
                preview_source_kind: existing?.preview_source_kind,
              });
              setNotice("");
              setEditing(id); setRestoredDraft(null);
            }}
            onUploaded={(id, kind, name, path) => {
              setRecentBook((current) => {
                const existing = current?.id === id ? current : books.find((book) => book.id === id);
                if (!existing) return current;
                return kind === "cover"
                  ? { ...existing, cover_path: path || existing.cover_path }
                  : { ...existing, formats: [...new Set([...existing.formats, kind.toUpperCase()])], format_names: { ...existing.format_names, [kind]: name } };
              });
            }}
          />}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("বই", "Book")}</th>
                  <th>{t("মূল্য", "Price")}</th>
                  <th>{t("প্রকাশিত", "Published")}</th>
                  <th>{t("ফাইল", "Files")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleBooks.map((book) => (
                  <tr key={book.id}>
                    <td>
                      {locale === "bn" ? book.title_bn : book.title_en}
                      {book.is_demo && " · Sample"}
                    </td>
                    <td>
                      <Price paisa={book.price_paisa} />
                    </td>
                    <td>
                      {book.published ? t("হ্যাঁ", "Yes") : t("খসড়া", "Draft")}
                    </td>
                    <td>{book.formats.join(", ") || "—"}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${book.title_en}`}
                        onClick={() => {
                          setEditing(book.id);
                          setRestoredDraft(null);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button className="icon-button" type="button" aria-label={`${t("মুছুন", "Delete")} ${book.title_en}`} onClick={() => askDelete(book)}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "archived" && <div className="table-wrap">
        {visibleBooks.length === 0 ? <p className="notice">{t("আর্কাইভে কোনো বই নেই।", "No archived books.")}</p> : <table><thead><tr>
          <th>{t("বই", "Book")}</th><th>{t("ফাইল", "Files")}</th><th>{t("কাজ", "Actions")}</th>
        </tr></thead><tbody>{visibleBooks.map((book) => <tr key={book.id}>
          <td>{locale === "bn" ? book.title_bn : book.title_en}</td><td>{book.formats.join(", ") || "—"}</td>
          <td><button type="button" className="button secondary" disabled={busy} onClick={() => void restoreBook(book)}><RotateCcw size={16} /> {t("খসড়ায় ফিরিয়ে আনুন", "Restore as draft")}</button></td>
        </tr>)}</tbody></table>}
      </div>}
      {tab === "orders" && (
        <>
          <p>
            {t(
              "সর্বশেষ ২০০টি অর্ডার। পরীক্ষামূলক ও আসল অর্ডার আলাদাভাবে চিহ্নিত।",
              "Latest 200 orders. Test and live orders are labelled separately.",
            )}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Book</th>
                  <th>Mode</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.tran_id}</td>
                    <td>{o.book_title}</td>
                    <td>{o.mode}</td>
                    <td>
                      <Price paisa={o.amount_paisa} />
                    </td>
                    <td>
                      <span className={`status status-${o.status}`}>
                        {statusLabel(o.status, locale)}
                      </span>
                    </td>
                    <td>{new Date(o.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "policies" && (
        <>
          <div className="notice">
            {t(
              "আপনার চূড়ান্ত নীতিমালা দুই ভাষায় লিখে প্রকাশ করুন। এখানে কোনো স্বয়ংক্রিয় আইনি খসড়া নেই।",
              "Add and publish your final policies in both languages. No legal text is generated for you.",
            )}
          </div>
          {["privacy", "terms", "refund", "copyright"].map((slug) => {
            const p = policies.find((x) => x.slug === slug);
            return (
              <form
                className="panel admin-form"
                key={slug}
                onSubmit={savePolicy}
              >
                <h2>{slug.charAt(0).toUpperCase() + slug.slice(1)}</h2>
                <input type="hidden" name="slug" value={slug} />
                <div className="form-grid">
                  <label>
                    শিরোনাম (বাংলা)
                    <input
                      name="title_bn"
                      required
                      defaultValue={p?.title_bn}
                    />
                  </label>
                  <label>
                    Title (English)
                    <input
                      name="title_en"
                      required
                      defaultValue={p?.title_en}
                    />
                  </label>
                </div>
                <label>
                  নীতিমালা (বাংলা)
                  <textarea name="body_bn" defaultValue={p?.body_bn} />
                </label>
                <label>
                  Policy (English)
                  <textarea name="body_en" defaultValue={p?.body_en} />
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="published"
                    defaultChecked={p?.published}
                  />
                  {t("প্রকাশিত", "Published")}
                </label>
                <button className="button" disabled={busy}>
                  {t("সংরক্ষণ করুন", "Save policy")}
                </button>
              </form>
            );
          })}
        </>
      )}
      {tab === "launch" && (
        <div className="panel">
          <h2>
            {t("আসল পেমেন্ট চালুর প্রস্তুতি", "Before accepting real payments")}
          </h2>
          <p>
            {t(
              "সার্ভারের সেটিংস ও স্টোরের তথ্য থেকে এই অবস্থা নির্ধারিত হয়।",
              "These checks reflect server settings and the content in your store.",
            )}
          </p>
          <ul className="gate-list">
            {gates.map((g) => (
              <li key={g.key} className={g.passed ? "passed" : "missing"}>
                {g.passed ? <CheckCircle2 size={20} /> : <Circle size={20} />}{" "}
                {g.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      <dialog ref={deleteDialog} className="confirm-dialog" aria-labelledby="delete-title" onClose={() => setDeleteTarget(null)}>
        <h2 id="delete-title">{t("বই মুছবেন?", "Delete this book?")}</h2>
        <p>{deleteTarget && (locale === "bn" ? deleteTarget.title_bn : deleteTarget.title_en)}</p>
        <p>{t("বইটির কোনো অর্ডার থাকলে এটি দোকান থেকে সরিয়ে আর্কাইভ হবে; আগের ক্রেতারা ডাউনলোড করতে পারবেন। অর্ডার না থাকলে বই ও ফাইল স্থায়ীভাবে মুছে যাবে।", "If this book has any orders, it will be archived and removed from the shop; buyers keep their downloads. Otherwise, the book and its files will be permanently deleted.")}</p>
        <div className="form-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={() => deleteDialog.current?.close()}>{t("বাতিল", "Cancel")}</button>
          <button type="button" className="button danger" disabled={busy} onClick={() => void deleteBook()}>{busy ? t("অপেক্ষা করুন…", "Working…") : t("মুছুন", "Delete")}</button>
        </div>
      </dialog>
      <SuccessToast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
