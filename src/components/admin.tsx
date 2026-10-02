"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Upload,
  CheckCircle2,
  Circle,
  LoaderCircle,
  Pencil,
  X,
} from "lucide-react";
import { useLanguage, Price, statusLabel } from "./store";
import { categories } from "@/lib/demo";
import type { Book, Order, Policy } from "@/lib/types";
type Gate = { key: string; label: string; passed: boolean };
const blank: Partial<Book> = {
  title_bn: "",
  title_en: "",
  author_bn: "",
  author_en: "",
  description_bn: "",
  description_en: "",
  slug: "",
  category: "fiction",
  price_paisa: 19900,
  pages: 100,
  language: "bn",
  cover_style: "forest",
  published: false,
  is_demo: false,
  featured: false,
};
export function Admin({
  books,
  orders,
  policies,
  gates,
  mode,
}: {
  books: Book[];
  orders: Order[];
  policies: Policy[];
  gates: Gate[];
  mode: string;
}) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [tab, setTab] = useState("books");
  const [editing, setEditing] = useState<Partial<Book> | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
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
  async function saveBook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    setNotice("");
    const f = new FormData(e.currentTarget);
    const values = {
      ...editing,
      ...Object.fromEntries(f),
      price_paisa: Math.round(Number(f.get("price")) * 100),
      pages: Number(f.get("pages")),
      published: f.get("published") === "on",
      is_demo: f.get("is_demo") === "on",
      featured: f.get("featured") === "on",
    };
    try {
      const result = await send("/api/admin/books", values);
      setEditing({ ...values, id: result.id } as Book);
      setNotice(
        t(
          "বই সংরক্ষিত হয়েছে। এখন ফাইল আপলোড করতে পারেন।",
          "Book saved. You can now upload its files.",
        ),
      );
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(kind: string, file?: File) {
    if (!file || !editing?.id) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.set("bookId", editing.id);
      form.set("kind", kind);
      form.set("file", file);
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setNotice(
        `${kind.toUpperCase()} ${t("আপলোড হয়েছে", "uploaded successfully")}`,
      );
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
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
              setEditing({ ...blank });
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
          {editing && (
            <form className="panel admin-form" onSubmit={saveBook}>
              <div className="admin-heading">
                <h2>
                  {editing.id
                    ? t("বই সম্পাদনা", "Edit book")
                    : t("নতুন বই", "New book")}
                </h2>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Close editor"
                  onClick={() => setEditing(null)}
                >
                  <X />
                </button>
              </div>
              <div className="form-grid">
                {[
                  ["title_bn", "বইয়ের নাম (বাংলা)"],
                  ["title_en", "Title (English)"],
                  ["author_bn", "লেখক (বাংলা)"],
                  ["author_en", "Author (English)"],
                  ["slug", "URL slug"],
                ].map(([name, label]) => (
                  <label key={`${editing.id || "new"}-${name}`}>
                    {label}
                    <input
                      name={name}
                      required
                      defaultValue={String(editing[name as keyof Book] || "")}
                    />
                  </label>
                ))}
                <label>
                  {t("মূল্য (টাকা)", "Price (BDT)")}
                  <input
                    key={`${editing.id}-price`}
                    name="price"
                    type="number"
                    min="10"
                    max="100000"
                    step="0.01"
                    required
                    defaultValue={(editing.price_paisa || 0) / 100}
                  />
                </label>
                <label>
                  {t("বিভাগ", "Category")}
                  <select name="category" defaultValue={editing.category}>
                    {categories
                      .filter((x) => x.id !== "all")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c[locale]}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  {t("ভাষা", "Language")}
                  <select name="language" defaultValue={editing.language}>
                    <option value="bn">বাংলা</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label>
                  {t("পৃষ্ঠা", "Pages")}
                  <input
                    name="pages"
                    type="number"
                    min="1"
                    max="20000"
                    required
                    defaultValue={editing.pages}
                  />
                </label>
                <label>
                  {t("প্রচ্ছদের রং", "Fallback cover colour")}
                  <select name="cover_style" defaultValue={editing.cover_style}>
                    {[
                      "forest",
                      "blue",
                      "orange",
                      "pink",
                      "olive",
                      "violet",
                      "yellow",
                      "red",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                বিবরণ (বাংলা)
                <textarea
                  key={`${editing.id}-bn`}
                  name="description_bn"
                  required
                  minLength={10}
                  maxLength={5000}
                  defaultValue={editing.description_bn}
                />
              </label>
              <label>
                Description (English)
                <textarea
                  key={`${editing.id}-en`}
                  name="description_en"
                  required
                  minLength={10}
                  maxLength={5000}
                  defaultValue={editing.description_en}
                />
              </label>
              <div className="form-grid">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="published"
                    defaultChecked={editing.published}
                  />
                  {t(
                    "প্রকাশিত (আগে ফাইল আপলোড করুন)",
                    "Published (upload files first)",
                  )}
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="is_demo"
                    defaultChecked={editing.is_demo}
                  />
                  {t("নমুনা বই", "Sample book")}
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="featured"
                    defaultChecked={editing.featured}
                  />
                  {t("বিশেষ বাছাই", "Featured")}
                </label>
              </div>
              <button className="button" disabled={busy}>
                {busy && <LoaderCircle className="spin" size={16} />}{" "}
                {t("সংরক্ষণ করুন", "Save book")}
              </button>
              {editing.id && (
                <>
                  <h3>{t("বইয়ের ফাইল", "Book files")}</h3>
                  <p>
                    {t(
                      "প্রচ্ছদ সর্বোচ্চ ৫ MB; প্রতিটি ইবুক সর্বোচ্চ ৩০ MB।",
                      "Cover: up to 5 MB. Each ebook: up to 30 MB.",
                    )}
                  </p>
                  <div className="form-grid">
                    {["cover", "pdf", "epub"].map((kind) => (
                      <label key={kind}>
                        <span>
                          <Upload size={14} /> {kind.toUpperCase()}
                        </span>
                        <input
                          type="file"
                          disabled={busy}
                          accept={
                            kind === "cover"
                              ? "image/png,image/jpeg,image/webp"
                              : `.${kind}`
                          }
                          onChange={(e) => {
                            void upload(kind, e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </>
              )}
            </form>
          )}
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
                          setEditing(null);
                          setTimeout(() => setEditing(book), 0);
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
