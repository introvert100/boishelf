"use client";
import { DeliverySettings } from "./delivery-settings";
import type { DeliveryDistrict } from "@/lib/delivery-validation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Book, Bundle, EditionFormat, Order, OrderLine, OrderShipping } from "@/lib/types";
import { bundleBookIssue, hasEdition } from "@/lib/bundle-selection";
import { Price, useLanguage } from "./store";

async function post(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Please try again.");
  return data;
}
function name(value: { title_bn: string; title_en: string }, locale: string) {
  return locale === "bn" ? value.title_bn : value.title_en;
}
export function PrintEditionEditor({ book, onSaved, onSuccess }: {
  book: Book; onSaved: (price: number, stock: number) => void; onSuccess: (message: string) => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [price, setPrice] = useState(book.print_price_paisa != null ? String(book.print_price_paisa / 100) : "");
  const [stock, setStock] = useState(String(book.print_on_hand || 0));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await post(`/api/admin/print-editions/${book.id}`, {
        pricePaisa: Math.round(Number(price) * 100), onHand: Number(stock), reason,
      });
      onSaved(Math.round(Number(price) * 100), Number(stock));
      onSuccess(t("ছাপা সংস্করণ ও মজুত সংরক্ষিত হয়েছে।", "Printed edition and stock saved."));
      router.refresh();
      setReason("");
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return <form className="panel admin-form print-edition-editor" onSubmit={(event) => void save(event)}>
    <h2>{t("ছাপা সংস্করণ", "Printed edition")}</h2>
    <p>{t("ইবুক থেকে আলাদা দাম ও মজুত। প্রথমে বইটি খসড়া হিসেবে সংরক্ষণ করুন।",
      "Set a separate printed price and stock after saving the book draft.")}</p>
    <div className="form-grid">
      <label>{t("ছাপা বইয়ের দাম (টাকা)", "Printed price (BDT)")}
        <input type="number" required min="10" max="100000" step="0.01" value={price}
          onChange={(event) => setPrice(event.target.value)} /></label>
      <label>{t("মোট হাতে থাকা কপি", "Total copies on hand")}
        <input type="number" required min={book.print_reserved || 0} max="100000" step="1" value={stock}
          onChange={(event) => setStock(event.target.value)} />
        <small>{t("অর্ডারের জন্য সংরক্ষিত", "Reserved for orders")}: {book.print_reserved || 0}</small></label>
    </div>
    <label>{t("মজুত পরিবর্তনের কারণ", "Reason for stock update")}
      <input required minLength={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)}
        placeholder={t("যেমন: নতুন ১০ কপি এসেছে", "For example: Received 10 new copies")} /></label>
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="button" disabled={busy}>{busy ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("ছাপা সংস্করণ সংরক্ষণ করুন", "Save printed edition")}</button>
  </form>;
}

type PhysicalAdminOrder = Order & { order_shipping: OrderShipping | OrderShipping[] | null;
  order_items: OrderLine[] };
type BundleDraft = { id?: string; slug: string; kind: EditionFormat | "";
  title_bn: string; title_en: string; description_bn: string; description_en: string;
  price: string; published: boolean; members: { bookId: string; format: EditionFormat }[] };
const blankBundle: BundleDraft = { slug: "", kind: "ebook", title_bn: "", title_en: "",
  description_bn: "", description_en: "", price: "", published: false, members: [] };
export function CommerceAdmin({ books, bundles, physicalOrders, shipping, onSuccess, onEditBook, section = "all" }: {
  books: Book[]; bundles: Bundle[]; physicalOrders: PhysicalAdminOrder[];
  shipping: DeliveryDistrict[];
  onSuccess: (message: string) => void;
  onEditBook?: (book: Book) => void;
  section?: "bundles" | "delivery" | "all";
}) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [draft, setDraft] = useState<BundleDraft>(blankBundle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [targetDates, setTargetDates] = useState<Record<string, string>>({});
  const [couriers, setCouriers] = useState<Record<string, string>>({});
  const [trackings, setTrackings] = useState<Record<string, string>>({});
  async function saveBundle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await post("/api/admin/bundles", { ...draft, price_paisa: Math.round(Number(draft.price) * 100) });
      onSuccess(t("বান্ডেল সংরক্ষিত হয়েছে।", "Bundle saved.")); setDraft(blankBundle); router.refresh();
    } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  }
  async function archiveBundle(bundle: Bundle) {
    if (!window.confirm(t("বান্ডেলটি দোকান থেকে সরাবেন? আগের অর্ডার থাকবে।", "Archive this bundle? Previous orders remain."))) return;
    setBusy(true); setError("");
    try { await post(`/api/admin/bundles/${bundle.id}/archive`, {});
      onSuccess(t("বান্ডেল আর্কাইভ হয়েছে।", "Bundle archived.")); router.refresh();
    } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  }
  async function changeOrder(order: PhysicalAdminOrder, action: string) {
    const sensitive = ["cancel","cancel_paid","return","refund","collect"];
    if (sensitive.includes(action) && !window.confirm(t("এই কাজটি সত্যিই সম্পন্ন করেছেন?", "Have you verified this action in real life?"))) return;
    setBusy(true); setError("");
    try {
      await post(`/api/admin/physical-orders/${order.id}`, {
        action, target: targetDates[order.id] || undefined,
        courier: couriers[order.id] || undefined, tracking: trackings[order.id] || undefined,
      });
      onSuccess(t("অর্ডারের অবস্থা সংরক্ষিত হয়েছে।", "Order updated.")); router.refresh();
    } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  }
  const issueLabels = {
    archived: t("আর্কাইভ করা—আগে পুনরুদ্ধার করুন।", "Archived: restore this book first."),
    sample: t("নমুনা বই বিক্রি করা যায় না।", "Sample books cannot be sold."),
    draft: t("বইটি আগে প্রকাশ করুন।", "Publish this book first."),
    ebook: t("এই বইয়ে PDF বা EPUB আপলোড করুন।", "Upload a PDF or EPUB for this book."),
    physical: t("এই বইয়ের ছাপা সংস্করণের দাম ও মজুত সংরক্ষণ করুন।", "Save a printed edition price and stock for this book."),
  };
  function changeKind(kind: EditionFormat) {
    setDraft({ ...draft, kind, members: draft.members.flatMap((member) => {
      const book = books.find((item) => item.id === member.bookId);
      if (!book || bundleBookIssue(book, kind)) return [];
      return [{ ...member, format: kind }];
    }) });
  }
  function editBundle(bundle: Bundle) {
    const kind = bundle.kind === "mixed" ? "" : bundle.kind;
    setDraft({ id: bundle.id, slug: bundle.slug, kind, title_bn: bundle.title_bn, title_en: bundle.title_en,
      description_bn: bundle.description_bn, description_en: bundle.description_en, price: String(bundle.price_paisa / 100),
      published: !!kind && bundle.published, members: kind
        ? bundle.members.map((member) => ({ bookId: member.id, format: kind })) : [] });
  }
  const eligibleCount = draft.kind ? books.filter((book) => !bundleBookIssue(book, draft.kind as EditionFormat)).length : 0;
  return <div className="commerce-admin">
    {error && <p className="notice error" role="alert">{error}</p>}
    <div hidden={section === "bundles"}><DeliverySettings shipping={shipping} onSuccess={onSuccess} /></div>
    <section className="panel admin-form" hidden={section === "delivery"}>
      <h2>{t("বান্ডেল", "Bundles")}</h2>
      <p>{t("PDF/EPUB ইবুক একসঙ্গে বিক্রি করুন অথবা আলাদা ছাপা বইয়ের বান্ডেল তৈরি করুন।", "Sell PDF/EPUB ebooks together, or create a separate printed-book bundle.")}</p>
      {bundles.length > 0 && <div className="bundle-admin-list">{bundles.map((bundle) => <div key={bundle.id} className="cart-row">
        <span><strong>{name(bundle, locale)}</strong> · {bundle.kind === "mixed" ? t("এক ধরনের বই বাছা প্রয়োজন", "Choose a single format") : bundle.kind === "physical" ? t("ছাপা বই", "Printed only") : t("ইবুক", "Ebooks only")} · <Price paisa={bundle.price_paisa} />
          {bundle.archived_at ? ` · ${t("আর্কাইভ", "Archived")}` : bundle.kind === "mixed" ? ` · ${t("বিক্রির জন্য উপলব্ধ নয়", "Unavailable for sale")}` : bundle.published ? ` · ${t("প্রকাশিত", "Published")}` : ` · ${t("খসড়া", "Draft")}`}</span>
        {!bundle.archived_at && <><button type="button" className="button secondary" onClick={() => editBundle(bundle)}>{t("সম্পাদনা", "Edit")}</button>
          <button type="button" className="button secondary" disabled={busy} onClick={() => void archiveBundle(bundle)}>{t("আর্কাইভ", "Archive")}</button></>}
      </div>)}</div>}
      <form className="admin-form" onSubmit={(event) => void saveBundle(event)}>
        <h3>{draft.id ? t("বান্ডেল সম্পাদনা", "Edit bundle") : draft.kind === "ebook" ? t("নতুন ইবুক বান্ডেল (PDF / EPUB)", "New ebook bundle (PDF / EPUB)") : t("নতুন ছাপা বইয়ের বান্ডেল", "New printed bundle")}</h3>
        {draft.kind === "ebook" && <p className="notice">{t("অন্তত দুটি বই বাছুন যেগুলোতে PDF বা EPUB আপলোড করা আছে। ছাপা বইয়ের মজুত বা ডেলিভারি ফি লাগবে না। bKash পেমেন্ট অনুমোদনের পর ক্রেতা বান্ডেলের প্রতিটি ইবুক পাবেন।", "Choose at least two books with uploaded PDF or EPUB files. No printed stock or delivery fee is needed. After bKash approval, the buyer gets every ebook in the bundle.")}</p>}
        <div className="form-grid"><label>{t("ধরন", "Format")}<select required value={draft.kind} onChange={(event) => changeKind(event.target.value as EditionFormat)}>
          {!draft.kind && <option value="" disabled>{t("একটি ধরন বাছুন", "Choose one format")}</option>}
          <option value="ebook">{t("শুধু ইবুক (PDF / EPUB)", "Ebooks only (PDF / EPUB)")}</option><option value="physical">{t("শুধু ছাপা বই", "Printed only")}</option></select></label>
          <label>URL slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={90} value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} /></label></div>
        <div className="form-grid"><label>{t("নাম (বাংলা)", "Bangla title")}<input required minLength={2} maxLength={160} value={draft.title_bn} onChange={(event) => setDraft({ ...draft, title_bn: event.target.value })} /></label>
          <label>English title<input required minLength={2} maxLength={160} value={draft.title_en} onChange={(event) => setDraft({ ...draft, title_en: event.target.value })} /></label></div>
        <div className="form-grid"><label>{t("বিবরণ (বাংলা)", "Bangla description")}<textarea required minLength={10} value={draft.description_bn} onChange={(event) => setDraft({ ...draft, description_bn: event.target.value })} /></label>
          <label>English description<textarea required minLength={10} value={draft.description_en} onChange={(event) => setDraft({ ...draft, description_en: event.target.value })} /></label></div>
        <label>{t("বান্ডেলের মোট দাম (টাকা)", "Bundle total price (BDT)")}<input type="number" min="10" max="100000" step="0.01" required value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} /></label>
        <fieldset className="bundle-member-picker"><legend>{t("অন্তত দুটি বই বাছুন", "Choose at least two books")}</legend>
          <p className="field-help">{t("বান্ডেলের সব বই একই ধরনের হতে হবে: শুধু ছাপা বই অথবা শুধু ইবুক। বাছা যাচ্ছে না এমন বইয়ের পাশে কারণ দেখুন।", "Every book must match the bundle format: printed only or ebooks only. Unavailable books explain what to fix.")}</p>
          {draft.kind && <p role="status">{draft.kind === "physical" ? t("ছাপা বান্ডেলের জন্য প্রস্তুত বই", "Books ready for a printed bundle") : t("ইবুক বান্ডেলের জন্য প্রস্তুত বই", "Books ready for an ebook bundle")}: {eligibleCount}
            {eligibleCount < 2 && <> · {t("অন্তত দুটি বই প্রস্তুত করুন। নিচে বইয়ের সেটআপ খুলুন।", "Prepare at least two books. Open book setup below.")}</>}
          </p>}
          {!draft.kind && <p className="notice">{t("এই পুরোনো বান্ডেলটি বিক্রি করা যাবে না। একটি ধরন বেছে অন্তত দুটি উপযুক্ত বই বাছুন। আগের অর্ডার থাকবে।", "This old bundle cannot be sold. Choose one format and at least two eligible books. Previous orders are preserved.")}</p>}
          {books.map((book) => {
            const issue = bundleBookIssue(book, draft.kind || "physical");
            const selected = draft.members.find((member) => member.bookId === book.id);
            return <div key={book.id} className={`bundle-member-row${issue ? " unavailable" : ""}`}>
              <label><input type="checkbox" disabled={!draft.kind || (!selected && (!!issue || draft.members.length >= 10))} checked={!!selected}
                onChange={(event) => setDraft({ ...draft, members: event.target.checked
                  ? [...draft.members, { bookId: book.id, format: draft.kind as EditionFormat }]
                  : draft.members.filter((member) => member.bookId !== book.id) })} /> {name(book, locale)}</label>
              <small>{t("সংস্করণ", "Editions")}: {[hasEdition(book, "physical") ? t("ছাপা", "Printed") : "", hasEdition(book, "ebook") ? t("ইবুক", "Ebook") : ""].filter(Boolean).join(" · ") || t("এখনো নেই", "None yet")}</small>
              {issue && <small>{issueLabels[issue]}</small>}
              {onEditBook && issue && <button type="button" className="button secondary" onClick={() => onEditBook(book)}
                aria-label={`${t("বইয়ের সেটআপ খুলুন", "Open book setup")}: ${name(book, locale)}`}>
                {issue === "archived" ? t("আর্কাইভে খুলুন", "Open in Archived") : issue === "physical" ? t("ছাপা সংস্করণ সেট করুন", "Set up printed edition") : issue === "ebook" ? t("ইবুক আপলোড করুন", "Upload ebook") : t("বইয়ের সেটআপ খুলুন", "Open book setup")}
              </button>}
            </div>;
          })}
          {!books.length && <p className="field-help">{t("আগে দুটি বই যোগ করুন।", "Add at least two books first.")}</p>}
          <p role="status">{draft.members.length}/10 {t("টি বই বাছা হয়েছে", "books selected")}</p>
        </fieldset>
        <label className="checkbox"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} /> {t("প্রকাশিত", "Published")}</label>
        <button className="button" disabled={busy || !draft.kind || draft.members.length < 2}>{t("বান্ডেল সংরক্ষণ করুন", "Save bundle")}</button>
        {draft.id && <button className="button secondary" type="button" onClick={() => setDraft(blankBundle)}>{t("নতুন বান্ডেল শুরু করুন", "Start new bundle")}</button>}
      </form>
    </section>
    <section className="admin-form" hidden={section === "bundles"}><h2>{t("ছাপা বইয়ের অর্ডার", "Printed-book orders")}</h2>
      {!physicalOrders.length && <p className="notice">{t("এখনো কোনো অর্ডার নেই।", "No printed orders yet.")}</p>}
      {physicalOrders.map((order) => {
        const shipping = Array.isArray(order.order_shipping) ? order.order_shipping[0] : order.order_shipping;
        if (!shipping) return null;
        return <article className="panel admin-form" key={order.id}>
          <h3>{order.tran_id} · {shipping.fulfillment_status}</h3>
          <p>{order.payment_method === "cod" ? "COD" : "bKash"} · {order.status} · <Price paisa={order.amount_paisa} /></p>
          <p>{shipping.recipient_name} · {shipping.phone}</p>
          <p>{shipping.street_address}, {shipping.local_area}, {shipping.district}</p>
          {order.order_items.map((item) => <div key={item.id}><p>{name(item, locale)} × {item.quantity}</p>
            {!!item.order_item_members?.length && <ul>{item.order_item_members.map((member) => <li key={member.book_id}>{name(member, locale)} · {member.format === "physical" ? t("ছাপা", "Printed") : t("ইবুক", "Ebook")}</li>)}</ul>}
          </div>)}
          <p>{t("ডেলিভারি ফি", "Delivery fee")}: <Price paisa={shipping.shipping_fee_paisa} /></p>
          {shipping.delivery_target && <p>{t("ডেলিভারির লক্ষ্য", "Delivery target")}: {shipping.delivery_target}</p>}
          {shipping.courier_name && <p>{shipping.courier_name} · {shipping.tracking_number}</p>}
          {shipping.refund_due && <p className="notice error">{t("ম্যানুয়াল রিফান্ড বাকি।", "Manual refund due.")}</p>}
          {shipping.fulfillment_status === "placed" && <>
            <label>{t("এই অর্ডারের ডেলিভারির লক্ষ্য", "Delivery target for this order")}
              <input type="date" min={new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10)} value={targetDates[order.id] || shipping.delivery_target || ""}
                onChange={(event) => setTargetDates({ ...targetDates, [order.id]: event.target.value })} /></label>
            <button type="button" className="button secondary" disabled={busy || !targetDates[order.id]} onClick={() => void changeOrder(order, "target")}>{t("লক্ষ্য সংরক্ষণ", "Save target")}</button>
            <div className="form-grid"><label>{t("কুরিয়ারের নাম", "Courier name")}<input value={couriers[order.id] || ""} onChange={(event) => setCouriers({ ...couriers, [order.id]: event.target.value })} /></label>
              <label>{t("ট্র্যাকিং নম্বর", "Tracking number")}<input value={trackings[order.id] || ""} onChange={(event) => setTrackings({ ...trackings, [order.id]: event.target.value })} /></label></div>
            <div className="form-actions"><button type="button" className="button" disabled={busy || !shipping.delivery_target || !couriers[order.id] || !trackings[order.id] || (order.payment_method === "bkash_manual" && order.status !== "paid")}
              onClick={() => void changeOrder(order, "ship")}>{t("পাঠানো হয়েছে", "Mark shipped")}</button>
              <button type="button" className="button secondary" disabled={busy || !["pending","rejected"].includes(order.status)}
                onClick={() => void changeOrder(order, "cancel")}>{t("বাতিল করুন", "Cancel")}</button>
              {order.status === "paid" && <button type="button" className="button secondary" disabled={busy} onClick={() => void changeOrder(order, "cancel_paid")}>{t("বাতিল ও রিফান্ড বাকি", "Cancel, refund due")}</button>}
            </div>
          </>}
          {shipping.fulfillment_status === "shipped" && <button type="button" className="button" disabled={busy} onClick={() => void changeOrder(order, "deliver")}>{t("পৌঁছেছে", "Mark delivered")}</button>}
          {shipping.fulfillment_status === "delivered" && order.payment_method === "cod" && order.status !== "paid" && <button type="button" className="button" disabled={busy} onClick={() => void changeOrder(order, "collect")}>{t("কুরিয়ার থেকে টাকা পাওয়া গেছে", "Cash received from courier")}</button>}
          {["shipped","delivered"].includes(shipping.fulfillment_status) && <button type="button" className="button secondary" disabled={busy} onClick={() => void changeOrder(order, "return")}>{t("ফেরত এসেছে", "Mark returned")}</button>}
          {shipping.refund_due && <button type="button" className="button secondary" disabled={busy} onClick={() => void changeOrder(order, "refund")}>{t("রিফান্ড সম্পন্ন", "Refund completed")}</button>}
        </article>;
      })}
    </section>
  </div>;
}
