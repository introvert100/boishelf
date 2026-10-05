"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  CheckCircle2,
  Circle,
  LoaderCircle,
  Pencil,
} from "lucide-react";
import { useLanguage, Price, statusLabel } from "./store";
import { BookEditor } from "./book-editor";
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
}: {
  books: Book[];
  orders: Order[];
  policies: Policy[];
  gates: Gate[];
  mode: string;
  ownerId: string;
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
  useEffect(() => {
    try { setSavedDraft(parseBookDraft(window.localStorage.getItem(draftKey(ownerId)))); }
    catch { setSavedDraft(null); }
  }, [ownerId]);
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
      setNotice(t("নীতিমালা সংরক্ষিত হয়েছে।", "Policy saved."));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
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
          <strong>{books.length}</strong>
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
            book={editing === "new" ? undefined : books.find((book) => book.id === editing) || recentBook || undefined}
            ownerId={ownerId}
            restored={editing === "new" ? restoredDraft : null}
            onClose={() => { setEditing(null); setRestoredDraft(null); }}
            onDraftChange={setSavedDraft}
            onSaved={(id, values) => {
              setRecentBook({
                id, slug: values.slug, title_bn: values.title_bn, title_en: values.title_en,
                author_bn: values.author_bn, author_en: values.author_en,
                description_bn: values.description_bn, description_en: values.description_en,
                category: values.category, price_paisa: Math.round(Number(values.price) * 100),
                pages: Number(values.pages), language: values.language,
                cover_style: values.cover_style, cover_path: null, formats: [],
                published: values.published, is_demo: values.is_demo, featured: values.featured,
              });
              setNotice(editing === "new" ? t("খসড়া সংরক্ষিত হয়েছে। নিচে ফাইল আপলোড করুন।", "Draft saved. Upload its files below.") : "");
              setEditing(id); setRestoredDraft(null);
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
                {books.map((book) => (
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
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
    </div>
  );
}
