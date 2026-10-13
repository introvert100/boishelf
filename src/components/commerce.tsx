"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Package, ShoppingCart, Truck } from "lucide-react";
import { addToCart, readCart, saveCart } from "@/lib/cart";
import { districts } from "@/lib/commerce-validation";
import type { Book, Bundle, CartLine, Order, OrderLine, OrderShipping, Viewer } from "@/lib/types";
import { Cover, Price, statusLabel, useLanguage } from "./store";

function title(value: { title_bn: string; title_en: string }, locale: string) {
  return locale === "bn" ? value.title_bn : value.title_en;
}
export function BundleCovers({ bundle }: { bundle: Bundle }) {
  return <div className="bundle-covers" aria-hidden="true">
    {bundle.members.slice(0, 4).map((book) => <Cover book={book} key={book.id} />)}
  </div>;
}
export function FeaturedBundles({ bundles }: { bundles: Bundle[] }) {
  const { locale, t } = useLanguage();
  if (!bundles.length) return null;
  return <section className="container page featured-bundles" aria-labelledby="featured-bundles-heading">
    <div className="section-heading"><div><span className="eyebrow muted">READ AND RICH</span>
      <h2 id="featured-bundles-heading">{t("একসঙ্গে আরও ভালো", "Better together")}</h2></div>
      <Link className="button secondary" href="/bundles">{t("সব বান্ডেল", "All bundles")}</Link></div>
    <div className="book-grid">{bundles.slice(0, 3).map((bundle) => <article className="book-card bundle-card" key={bundle.id}>
      <Link href={`/bundles/${bundle.slug}`}><BundleCovers bundle={bundle} /></Link>
      <div className="book-info"><small>{bundle.kind === "physical" ? t("ছাপা বই", "Printed") : t("ইবুক", "Ebook")}</small>
        <h3><Link href={`/bundles/${bundle.slug}`}>{title(bundle, locale)}</Link></h3>
        <strong><Price paisa={bundle.price_paisa} /></strong></div>
    </article>)}</div>
  </section>;
}
export function BundleList({ bundles }: { bundles: Bundle[] }) {
  const { locale, t } = useLanguage();
  return <div className="container page">
    <span className="eyebrow muted">READ AND RICH</span>
    <h1>{t("বইয়ের বান্ডেল", "Book bundles")}</h1>
    <p>{t("একসঙ্গে বাছাই করা বই, একটি দামে। ইবুক ও ছাপা বইয়ের বান্ডেল আলাদা।",
      "Curated books together at one price. Ebook and printed bundles are separate.")}</p>
    {bundles.length ? <div className="book-grid">{bundles.map((bundle) => <article className="book-card bundle-card" key={bundle.id}>
      <Link href={`/bundles/${bundle.slug}`}><BundleCovers bundle={bundle} /></Link>
      <div className="book-info"><small>{bundle.kind === "physical" ? t("ছাপা বই", "Printed books") : t("ইবুক", "Ebooks")}</small>
        <h2><Link href={`/bundles/${bundle.slug}`}>{title(bundle, locale)}</Link></h2>
        <p>{bundle.members.length} {t("টি বই", "books")}</p>
        <strong><Price paisa={bundle.price_paisa} /></strong>
        <p><Link className="button secondary" href={`/bundles/${bundle.slug}`}>{t("বিস্তারিত দেখুন", "View bundle")}</Link></p>
      </div>
    </article>)}</div> : <p className="notice">{t("এখনো কোনো বান্ডেল প্রকাশিত হয়নি।", "No bundles are published yet.")}</p>}
  </div>;
}
export function BundleDetail({ bundle, viewer, ebookReady }: { bundle: Bundle; viewer: Viewer; ebookReady: boolean }) {
  const { locale, t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const individualTotal = bundle.members.reduce((sum, member) => sum +
    (bundle.kind === "ebook" ? member.price_paisa : member.print_price_paisa || 0), 0);
  const physicalAvailable = bundle.members.every((book) =>
    book.print_price_paisa != null && (book.print_on_hand || 0) - (book.print_reserved || 0) > 0);
  async function buyEbook() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/checkout/bundle", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId: bundle.id, accepted }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create the order.");
      window.location.assign(`/orders/${body.orderId}`);
    } catch (failure) { setError((failure as Error).message); setBusy(false); }
  }
  function addPhysical() {
    if (!addToCart("bundle", bundle.id)) { setError(t("কার্টে সর্বোচ্চ পরিমাণ আছে।", "Cart quantity limit reached.")); return; }
    window.location.assign("/cart");
  }
  return <div className="container page">
    <Link className="text-link" href="/bundles">{t("সব বান্ডেল", "All bundles")}</Link>
    <section className="book-detail">
      <BundleCovers bundle={bundle} />
      <div className="detail-copy">
        <span className="eyebrow muted">{bundle.kind === "physical" ? t("ছাপা বইয়ের বান্ডেল", "PRINTED BUNDLE") : t("ইবুক বান্ডেল", "EBOOK BUNDLE")}</span>
        <h1>{title(bundle, locale)}</h1>
        <p className="description">{locale === "bn" ? bundle.description_bn : bundle.description_en}</p>
        <div className="detail-price"><Price paisa={bundle.price_paisa} /></div>
        {individualTotal > bundle.price_paisa && <p className="field-help">
          {t("আলাদা কিনলে", "Bought separately")}: <Price paisa={individualTotal} /> · {t("সাশ্রয়", "Save")}: <Price paisa={individualTotal - bundle.price_paisa} />
        </p>}
        <h2>{t("বান্ডেলে থাকছে", "Included books")}</h2>
        <ul>{bundle.members.map((book) => <li key={book.id}><Link href={`/books/${book.slug}`}>{title(book, locale)}</Link></li>)}</ul>
        {bundle.kind === "physical" ? <>
          {!physicalAvailable && <p className="notice">{t("একটি বই মজুতে নেই।", "A book in this bundle is out of stock.")}</p>}
          <button className="button wide" disabled={!physicalAvailable} onClick={addPhysical}><ShoppingCart size={18} /> {t("কার্টে যোগ করুন", "Add printed bundle to cart")}</button>
        </> : !viewer ? <Link className="button wide" href={`/signin?next=${encodeURIComponent(`/bundles/${bundle.slug}`)}`}>
          {t("কিনতে Gmail দিয়ে লগইন করুন", "Sign in to buy")}</Link> : <>
          <label className="checkbox"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>{t("আমি", "I agree to the")} <Link href="/policies/terms">{t("শর্তাবলি", "terms")}</Link> {t("ও", "and")} <Link href="/policies/refund">{t("রিফান্ড নীতি", "refund policy")}</Link></span>
          </label>
          {!ebookReady && <p className="notice">{t("ইবুক চেকআউট এখনো চালু হয়নি।", "Ebook checkout is not available yet.")}</p>}
          <button className="button wide" disabled={!accepted || !ebookReady || busy} onClick={() => void buyEbook()}>
            {busy ? t("অপেক্ষা করুন…", "Working…") : t("bKash অর্ডার তৈরি করুন", "Create bKash order")}</button>
        </>}
        {error && <p className="notice error" role="alert">{error}</p>}
      </div>
    </section>
  </div>;
}

type Quote = { items: (CartLine & { title_bn: string; title_en: string; unit_price_paisa: number })[];
  subtotal_paisa: number; shipping_fee_paisa: number; total_paisa: number };
export function PhysicalCart({ books, bundles, viewer, ready }: {
  books: Book[]; bundles: Bundle[]; viewer: Viewer; ready: { cod: boolean; bkash: boolean };
}) {
  const { locale, t } = useLanguage();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [district, setDistrict] = useState("");
  const [method, setMethod] = useState<"cod" | "bkash_manual">("cod");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const requestVersion = useRef(0);
  const clientKey = useRef("");
  useEffect(() => { setLines(readCart()); setLoaded(true); }, []);
  useEffect(() => { if (!ready.cod && ready.bkash) setMethod("bkash_manual"); }, [ready.cod, ready.bkash]);
  useEffect(() => {
    if (!loaded || !viewer || !district || !lines.length) { setQuote(null); return; }
    const version = ++requestVersion.current;
    setQuoteBusy(true); setQuote(null); setError("");
    const controller = new AbortController();
    void fetch("/api/physical/quote", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines, district }), signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not calculate delivery total.");
        if (version === requestVersion.current) setQuote(body);
      }).catch((failure) => {
        if (!controller.signal.aborted && version === requestVersion.current)
          setError((failure as Error).message);
      }).finally(() => { if (version === requestVersion.current) setQuoteBusy(false); });
    return () => controller.abort();
  }, [loaded, viewer, district, lines]);
  function update(next: CartLine[]) { setLines(next); saveCart(next); clientKey.current = ""; setQuote(null); }
  const products = useMemo(() => lines.map((line) => {
    const product = line.kind === "book" ? books.find((book) => book.id === line.id) : bundles.find((bundle) => bundle.id === line.id);
    return { line, product };
  }), [lines, books, bundles]);
  async function order(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote || busy) return;
    const form = new FormData(event.currentTarget);
    if (!clientKey.current) clientKey.current = crypto.randomUUID();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/checkout/physical", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientKey: clientKey.current, lines, method, district,
          recipientName: form.get("recipientName"), phone: form.get("phone"),
          localArea: form.get("localArea"), streetAddress: form.get("streetAddress"),
          expectedTotalPaisa: quote.total_paisa, accepted }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not place the order.");
      saveCart([]);
      window.location.assign(`/orders/${body.orderId}`);
    } catch (failure) { setError((failure as Error).message); setBusy(false); }
  }
  return <div className="container page">
    <span className="eyebrow muted">READ AND RICH</span>
    <h1>{t("ছাপা বইয়ের কার্ট", "Printed-book cart")}</h1>
    {!loaded ? <p role="status">{t("কার্ট লোড হচ্ছে…", "Loading cart…")}</p> : !lines.length ? <div className="notice">
      <p>{t("কার্টে কোনো ছাপা বই নেই।", "Your printed-book cart is empty.")}</p>
      <Link href="/#catalogue" className="button secondary">{t("বই দেখুন", "Explore books")}</Link>
    </div> : <div className="checkout-layout">
      <div className="panel admin-form">
        <h2>{t("আপনার বই", "Your books")}</h2>
        {products.map(({ line, product }) => <div className="cart-row" key={`${line.kind}:${line.id}`}>
          <div><strong>{product ? title(product, locale) : t("এই বইটি আর নেই", "Item no longer available")}</strong>
            <small>{line.kind === "bundle" ? t("বান্ডেল", "Bundle") : t("ছাপা বই", "Printed book")}</small></div>
          <label>{t("সংখ্যা", "Quantity")} <input type="number" min="1" max="10" value={line.quantity}
            onChange={(event) => { const quantity = Number(event.target.value); if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 10)
              update(lines.map((item) => item === line ? { ...item, quantity } : item)); }} /></label>
          <button type="button" className="button secondary" onClick={() => update(lines.filter((item) => item !== line))}>
            {t("সরান", "Remove")}</button>
        </div>)}
        {!viewer ? <p className="notice">{t("ঠিকানা ও মোট খরচ দেখতে Gmail দিয়ে লগইন করুন।", "Sign in with Gmail to enter delivery details and see the exact total.")}
          <Link className="button" href="/signin?next=%2Fcart">{t("লগইন করুন", "Sign in")}</Link></p> : <form onSubmit={(event) => void order(event)} className="admin-form">
          <h2>{t("ডেলিভারির ঠিকানা", "Delivery address")}</h2>
          <label>{t("প্রাপকের নাম", "Recipient name")}<input name="recipientName" required minLength={2} maxLength={100} autoComplete="name" /></label>
          <label>{t("বাংলাদেশি মোবাইল নম্বর", "Bangladesh mobile number")}<input name="phone" required inputMode="tel" pattern="01[3-9][0-9]{8}" placeholder="01XXXXXXXXX" autoComplete="tel" /></label>
          <label>{t("জেলা", "District")}<select value={district} required onChange={(event) => setDistrict(event.target.value)}>
            <option value="">{t("জেলা বেছে নিন", "Choose district")}</option>
            {districts.map((name) => <option value={name} key={name}>{name}</option>)}
          </select></label>
          <label>{t("এলাকা / উপজেলা", "Area / upazila")}<input name="localArea" required minLength={2} maxLength={120} autoComplete="address-level2" /></label>
          <label>{t("বাড়ি, রাস্তা ও সম্পূর্ণ ঠিকানা", "House, road and full address")}<textarea name="streetAddress" required minLength={5} maxLength={300} autoComplete="street-address" /></label>
          <fieldset className="payment-choices"><legend>{t("পেমেন্ট পদ্ধতি", "Payment method")}</legend>
            <label><input type="radio" name="method" checked={method === "cod"} onChange={() => setMethod("cod")} disabled={!ready.cod} /> {t("ডেলিভারিতে নগদ", "Cash on delivery")}</label>
            <label><input type="radio" name="method" checked={method === "bkash_manual"} onChange={() => setMethod("bkash_manual")} disabled={!ready.bkash} /> bKash</label>
          </fieldset>
          {!ready.cod && !ready.bkash && <p className="notice">{t("ছাপা বইয়ের চেকআউট এখনো চালু হয়নি।", "Printed-book checkout is not available yet.")}</p>}
          <label className="checkbox"><input type="checkbox" required checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>{t("আমি", "I agree to the")} <Link href="/policies/terms">{t("শর্তাবলি", "terms")}</Link>, <Link href="/policies/refund">{t("রিফান্ড নীতি", "refund policy")}</Link> {t("ও", "and")} <Link href="/policies/shipping">{t("ডেলিভারি নীতি", "shipping policy")}</Link></span>
          </label>
          {error && <p role="alert" className="notice error">{error}</p>}
          <button className="button wide" disabled={busy || quoteBusy || !quote || !ready[method === "cod" ? "cod" : "bkash"] || !accepted}>
            {busy ? t("অর্ডার হচ্ছে…", "Placing order…") : t("অর্ডার নিশ্চিত করুন", "Place order")}</button>
          <p className="field-help">{t("bKash বেছে নিলে অর্ডার দেওয়ার পর নম্বর ও রেফারেন্স দেখাবে। COD-তে ডেলিভারির সময় টাকা দিন। অর্ডারের খবর এই সাইটে দেখুন।",
            "For bKash, the number and reference appear after ordering. Pay COD at delivery. Check this site for order updates.")}</p>
        </form>}
      </div>
      <aside className="panel order-summary"><h2>{t("মোট খরচ", "Order total")}</h2>
        {quoteBusy && <p role="status">{t("খরচ হিসাব হচ্ছে…", "Calculating total…")}</p>}
        {quote && <><p>{t("বইয়ের দাম", "Books")}: <Price paisa={quote.subtotal_paisa} /></p>
          <p>{t("ডেলিভারি", "Delivery")}: <Price paisa={quote.shipping_fee_paisa} /></p>
          <hr /><p className="total"><strong>{t("সর্বমোট", "Total")}: <Price paisa={quote.total_paisa} /></strong></p></>}
        {!district && <p>{t("ডেলিভারির ফি জানতে জেলা বেছে নিন।", "Choose a district to see the delivery fee.")}</p>}
      </aside>
    </div>}
  </div>;
}

export function MyOrders({ orders }: { orders: Order[] }) {
  const { locale, t } = useLanguage();
  return <div className="container page"><h1>{t("আমার অর্ডার", "My orders")}</h1>
    {orders.length ? <div className="order-list">{orders.map((order) => <Link className="panel order-list-item" href={`/orders/${order.id}`} key={order.id}>
      <strong>{order.order_kind === "physical" ? t("ছাপা বইয়ের অর্ডার", "Printed-book order") : order.book_title}</strong><span>{order.order_kind === "physical" ? t("ছাপা বই", "Printed") : t("ইবুক", "Ebook")}</span>
      <span><Price paisa={order.amount_paisa} /></span><small>{new Date(order.created_at).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-BD")}</small>
      <span>{order.payment_method === "cod" && order.status === "pending" ? t("ডেলিভারিতে পরিশোধ", "Pay on delivery") : statusLabel(order.status, locale)}</span></Link>)}</div> : <p className="notice">{t("এখনো কোনো অর্ডার নেই।", "No orders yet.")}</p>}
  </div>;
}

export function PhysicalOrderView({ order, shipping, lines, rejectionReason }: { order: Order; shipping: OrderShipping; lines: OrderLine[]; rejectionReason: string | null }) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function action(path: string, body?: unknown) {
    setBusy(true); setError("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again.");
      router.refresh();
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="container page narrow physical-order">
    <Link href="/orders" className="text-link">{t("আমার অর্ডার", "My orders")}</Link>
    <h1>{t("ছাপা বইয়ের অর্ডার", "Printed-book order")}</h1>
    <p>{t("রেফারেন্স", "Reference")}: <strong>{order.tran_id}</strong></p>
    <div className="panel"><h2>{t("অর্ডারের অবস্থা", "Order status")}</h2>
      <p>{t("ডেলিভারি", "Delivery")}: <strong>{({ placed: t("অর্ডার হয়েছে", "Placed"), shipped: t("পাঠানো হয়েছে", "Shipped"), delivered: t("পৌঁছেছে", "Delivered"), cancelled: t("বাতিল", "Cancelled"), returned: t("ফেরত এসেছে", "Returned") })[shipping.fulfillment_status]}</strong></p>
      <p>{t("পেমেন্ট", "Payment")}: <strong>{order.payment_method === "cod" && order.status === "pending" ? t("ডেলিভারিতে বাকি", "Due at delivery") : statusLabel(order.status, locale)}</strong></p>
      {shipping.delivery_target ? <p>{t("লক্ষ্য তারিখ", "Delivery target")}: {shipping.delivery_target}</p>
        : <p>{t("ডেলিভারির তারিখ মালিক পরে জানাবেন। অর্ডার দেখতে আবার এই পাতা খুলুন।", "The owner will set a delivery target. Return to this page for updates.")}</p>}
      {shipping.courier_name && <p>{t("কুরিয়ার", "Courier")}: {shipping.courier_name}</p>}
      {shipping.tracking_number && <p>{t("ট্র্যাকিং", "Tracking")}: {shipping.tracking_number}</p>}
      {shipping.refund_due && <p className="notice">{t("রিফান্ড মালিক যাচাই করছেন।", "A manual refund is pending.")}</p>}
    </div>
    <div className="panel"><h2>{t("বই ও খরচ", "Books and total")}</h2>
      {lines.map((line) => <p key={line.id}>{title(line, locale)} × {line.quantity} — <Price paisa={line.unit_price_paisa * line.quantity} /></p>)}
      <p>{t("ডেলিভারি", "Delivery")}: <Price paisa={shipping.shipping_fee_paisa} /></p>
      <strong>{t("সর্বমোট", "Total")}: <Price paisa={order.amount_paisa} /></strong>
    </div>
    <div className="panel"><h2>{t("ডেলিভারির ঠিকানা", "Delivery address")}</h2>
      <p>{shipping.recipient_name} · {shipping.phone}</p>
      <p>{shipping.street_address}, {shipping.local_area}, {shipping.district}</p>
    </div>
    {order.payment_method === "cod" && shipping.fulfillment_status !== "cancelled" && <p className="notice">
      <Truck size={18} /> {t("ডেলিভারির সময় কুরিয়ারকে সম্পূর্ণ টাকা দিন। সাইটে আগাম টাকা পাঠাবেন না।",
        "Pay the full amount to the courier at delivery. Do not send money in advance for this COD order.")}</p>}
    {order.payment_method === "bkash_manual" && ["pending","rejected"].includes(order.status) && shipping.fulfillment_status === "placed" && <div className="panel admin-form">
      <h2>{t("bKash দিয়ে পরিশোধ করুন", "Pay with bKash")}</h2>
      <p>{t("নম্বর", "Receiving number")}: <strong>{order.manual_receive_number}</strong></p>
      <p>{t("ঠিক এই টাকা পাঠান", "Send this exact total")}: <strong><Price paisa={order.amount_paisa} /></strong></p>
      <p>{t("রেফারেন্স", "Reference")}: {order.tran_id}</p>
      {rejectionReason && <p className="notice error" role="alert">{t("আগের দাবির কারণ", "Previous claim rejected because")}: {rejectionReason}</p>}
      <p>{t("মালিক লেনদেন যাচাই না করা পর্যন্ত পেমেন্ট নিশ্চিত হবে না। PIN বা OTP দেবেন না।",
        "Payment is pending until the owner verifies it. Never enter your PIN or OTP here.")}</p>
      <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget);
        void action(`/api/orders/${order.id}/claim`, { transactionId: data.get("transactionId"), senderLast4: data.get("senderLast4") }); }}>
        <label>{t("ট্রানজ্যাকশন আইডি", "Transaction ID")}<input name="transactionId" required minLength={6} maxLength={30} pattern="[A-Za-z0-9]{6,30}" /></label>
        <label>{t("প্রেরকের নম্বরের শেষ ৪ সংখ্যা", "Last 4 digits of sender number")}<input name="senderLast4" required pattern="[0-9]{4}" maxLength={4} inputMode="numeric" /></label>
        <button className="button" disabled={busy}>{t("যাচাইয়ের জন্য জমা দিন", "Submit for review")}</button>
      </form>
    </div>}
    {order.status === "review" && <p className="notice">{t("আপনার bKash দাবি যাচাই হচ্ছে।", "Your bKash claim is under review.")}</p>}
    {shipping.fulfillment_status === "placed" && ["pending","rejected"].includes(order.status) && <button className="button secondary" disabled={busy}
      onClick={() => { if (window.confirm(t("আপনি কি নিশ্চিত? bKash-এ টাকা পাঠিয়ে থাকলে বাতিল করবেন না; আগে সহায়তার সঙ্গে যোগাযোগ করুন।",
        "Cancel this order? If you already sent bKash money, contact support instead."))) void action(`/api/orders/${order.id}/cancel`); }}>{t("অর্ডার বাতিল করুন", "Cancel order")}</button>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="button secondary" disabled={busy} onClick={() => router.refresh()}>{t("অবস্থা নতুন করে দেখুন", "Refresh status")}</button>
  </div>;
}
