"use client";
import Link, { NavigationProvider } from "./navigation";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  BookOpen,
  Search,
  Library,
  ShieldCheck,
  Download,
  Globe2,
  X,
  Check,
  Menu,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpRight,
  Sparkles,
  BookMarked,
  LogOut,
  LayoutDashboard,
  CircleHelp,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  LockKeyhole,
  Smartphone,
  Mail,
  KeyRound,
  ShoppingCart,
} from "lucide-react";
import type { Book, Locale, Viewer, Order, Policy, ManualClaim } from "@/lib/types";
import { categories } from "@/lib/demo";
import { browserClient } from "@/lib/supabase-browser";
import { isGmailUser } from "@/lib/security";
import { Turnstile } from "@/components/turnstile";
import { PreviewDialog } from "@/components/preview-dialog";
import { addToCart } from "@/lib/cart";

const Language = createContext<{
  locale: Locale;
  t: (bn: string, en: string) => string;
}>({ locale: "bn", t: (bn) => bn });
export const useLanguage = () => useContext(Language);
export function Price({ paisa }: { paisa: number }) {
  const { locale } = useLanguage();
  return (
    <span>
      ৳
      {new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD", {
        maximumFractionDigits: 2,
      }).format(paisa / 100)}
    </span>
  );
}

export function Shell({
  children,
  initialLocale,
  viewer,
  configured,
}: {
  children: ReactNode;
  initialLocale: Locale;
  viewer: Viewer;
  configured: boolean;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [menu, setMenu] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const t = (bn: string, en: string) => (locale === "bn" ? bn : en);
  useEffect(() => { setHydrated(true); }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  function switchLanguage() {
    const next = locale === "bn" ? "en" : "bn";
    setLocale(next);
    document.cookie = `locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
  }
  async function logout() {
    await fetch("/auth/signout", { method: "POST" });
    window.location.assign("/");
  }
  return (
    <Language.Provider value={{ locale, t }}>
      <NavigationProvider label={t("পাতা লোড হচ্ছে…", "Loading page…")}>
      <a className="skip" href="#main">
        {t("মূল বিষয়বস্তুতে যান", "Skip to content")}
      </a>
      <header className="header">
        <div className="container header-inner">
          <Link href="/" className="brand" aria-label="Read and Rich home">
            <span className="brand-icon">
              <BookOpen size={23} />
            </span>
            <span>
              Read <span className="brand-light">and Rich</span>
              <i />
            </span>
          </Link>
          <nav
            className="desktop-nav"
            aria-label={t("প্রধান নেভিগেশন", "Main navigation")}
          >
            <Link href="/#catalogue">{t("বই খুঁজুন", "Explore books")}</Link>
            <Link href="/#categories">{t("বিভাগসমূহ", "Categories")}</Link>
            <Link href="/bundles">{t("বান্ডেল", "Bundles")}</Link>
            <Link href="/how-it-works">
              {t("যেভাবে কাজ করে", "How it works")}
            </Link>
          </nav>
          <div className="header-actions">
            <button
              className="language-button"
              disabled={!hydrated}
              onClick={switchLanguage}
              aria-label={
                locale === "bn" ? "Switch to English" : "বাংলায় দেখুন"
              }
            >
              <Globe2 size={16} />
              {locale === "bn" ? "EN" : "বাংলা"}
            </button>
            <Link className="library-link" href="/library">
              <Library size={19} />
              <span>{t("আমার লাইব্রেরি", "My library")}</span>
            </Link>
            <Link className="library-link cart-link" href="/cart" aria-label={t("কার্ট", "Cart")}><ShoppingCart size={19} /><span>{t("কার্ট", "Cart")}</span></Link>
            <Link className="library-link orders-link" href="/orders">{t("অর্ডার", "Orders")}</Link>
            {viewer ? (
              <button
                onClick={logout}
                className="icon-button desktop-only"
                aria-label={t("লগ আউট", "Sign out")}
                title={viewer.email}
              >
                <LogOut size={18} />
              </button>
            ) : (
              <Link href="/signin" className="button small desktop-only">
                {t("লগ ইন", "Sign in")}
              </Link>
            )}
            <button
              className="icon-button mobile-only"
              aria-label="Menu"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-menu">
            <Link href="/#catalogue" onClick={() => setMenu(false)}>
              {t("বই খুঁজুন", "Explore books")}
            </Link>
            <Link href="/how-it-works" onClick={() => setMenu(false)}>
              {t("যেভাবে কাজ করে", "How it works")}
            </Link>
            <Link href="/bundles" onClick={() => setMenu(false)}>{t("বান্ডেল", "Bundles")}</Link>
            <Link href="/cart" onClick={() => setMenu(false)}>{t("কার্ট", "Cart")}</Link>
            <Link href="/orders" onClick={() => setMenu(false)}>{t("আমার অর্ডার", "My orders")}</Link>
            {viewer ? (
              <button onClick={logout}>{t("লগ আউট", "Sign out")}</button>
            ) : (
              <Link href="/signin" onClick={() => setMenu(false)}>
                {t("লগ ইন", "Sign in")}
              </Link>
            )}
          </nav>
        )}
      </header>
      <main id="main">{children}</main>
      <footer className="footer">
        <div className="container footer-top">
          <div>
            <Link className="brand" href="/">
              <span className="brand-icon">
                <BookOpen size={23} />
              </span>
              <span>
                Read <span className="brand-light">and Rich</span>
                <i />
              </span>
            </Link>
            <p>
              {t(
                "পড়ার আনন্দ, এখন আপনার হাতের মুঠোয়।",
                "A little more reading. A whole new world.",
              )}
            </p>
          </div>
          <div className="footer-links">
            <Link href="/how-it-works">{t("কীভাবে কিনবেন", "How to buy")}</Link>
            <Link href="/library">{t("আমার লাইব্রেরি", "My library")}</Link>
            <Link href="/orders">{t("আমার অর্ডার", "My orders")}</Link>
            <Link href="/bundles">{t("বান্ডেল", "Bundles")}</Link>
            {viewer?.admin && (
              <Link href="/admin">
                <LayoutDashboard size={14} />{" "}
                {t("স্টোর পরিচালনা", "Manage store")}
              </Link>
            )}
          </div>
          <div className="payment-brands">
            <small>
              {t("ইবুকে bKash · ছাপা বইয়ে COD বা bKash", "EBOOK BKASH · PRINTED COD OR BKASH")}
            </small>
            <div>
              <b className="bkash">bKash</b>
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Read and Rich</span>
          <div>
            {["privacy", "terms", "refund", "copyright", "shipping"].map((slug, i) => (
              <Link key={slug} href={`/policies/${slug}`}>
                {t(
                  ["গোপনীয়তা", "শর্তাবলি", "রিফান্ড", "কপিরাইট", "ডেলিভারি"][i],
                  ["Privacy", "Terms", "Refunds", "Copyright", "Shipping"][i],
                )}
              </Link>
            ))}
          </div>
        </div>
        {!configured && (
          <div className="setup-note">
            {t(
              "নমুনা ক্যাটালগ · Gmail কোড লগইন ও পেমেন্ট এখনো সংযুক্ত নয়",
              "Sample catalogue · Gmail code sign-in and payments are not connected yet",
            )}
          </div>
        )}
      </footer>
      </NavigationProvider>
    </Language.Provider>
  );
}

export function Cover({ book, hero = false }: { book: Book; hero?: boolean }) {
  const { locale, t } = useLanguage();
  const image = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  useEffect(() => {
    if (!book.cover_path) return;
    setState("loading");
    const current = image.current;
    if (current?.complete) setState(current.naturalWidth > 0 ? "loaded" : "error");
  }, [book.id, book.cover_path]);
  if (book.cover_path)
    return (
      <div className={`cover cover-uploaded ${hero ? "hero-cover" : ""}`}>
        <img
          ref={image}
          src={`/api/covers/${book.id}`}
          alt={locale === "bn" ? book.title_bn : book.title_en}
          loading={hero ? "eager" : "lazy"}
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          className={state === "loaded" ? "" : "cover-image-pending"}
        />
        {state !== "loaded" && <span className="cover-image-status" role={state === "error" ? "alert" : "status"}>
          {state === "loading" ? <><LoaderCircle size={18} aria-hidden="true" />{t("প্রচ্ছদ লোড হচ্ছে…", "Loading cover image…")}</>
            : t("প্রচ্ছদ লোড হয়নি। পাতা আবার খুলুন।", "Cover unavailable. Reload to retry.")}
        </span>}
      </div>
    );
  return (
    <div
      className={`cover cover-${book.cover_style} ${hero ? "hero-cover" : ""}`}
      aria-label={locale === "bn" ? book.title_bn : book.title_en}
    >
      <div className="cover-top">
        READ AND RICH <span>EDITION 01</span>
      </div>
      <div className="cover-title">
        {locale === "bn" ? book.title_bn : book.title_en}
      </div>
      <div className="cover-art" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="cover-author">
        {locale === "bn" ? book.author_bn : book.author_en}
      </div>
    </div>
  );
}

export function Catalogue({ books }: { books: Book[] }) {
  const { locale, t } = useLanguage();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("curated");
  const filtered = useMemo(
    () =>
      books
        .filter(
          (b) =>
            (category === "all" || b.category === category) &&
            `${b.title_bn} ${b.title_en} ${b.author_bn} ${b.author_en}`
              .toLowerCase()
              .includes(search.toLowerCase().trim()),
        )
        .sort((a, b) =>
          sort === "low"
            ? (a.formats.length ? a.price_paisa : a.print_price_paisa || 0) - (b.formats.length ? b.price_paisa : b.print_price_paisa || 0)
            : sort === "high"
              ? (b.formats.length ? b.price_paisa : b.print_price_paisa || 0) - (a.formats.length ? a.price_paisa : a.print_price_paisa || 0)
              : 0,
        ),
    [books, category, search, sort],
  );
  const heroBooks = books.slice(0, 3);
  return (
    <>
      <section className="container hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span />{" "}
            {t(
              "আপনার পরের প্রিয় বইটি এখানেই",
              "YOUR NEXT CHAPTER STARTS HERE",
            )}
          </span>
          <h1>
            {t("একটি বই খুলুন,", "Open a book.")}
            <br />
            <em>{t("নতুন পৃথিবী খুঁজুন।", "Find a new world.")}</em>
          </h1>
          <p>
            {t(
              "গল্প, নতুন ভাবনা আর শেখার আনন্দ। ইবুক বা ছাপা বই বেছে নিন, পড়ুন আপনার নিজের সময়ে।",
              "Stories and ideas in ebooks and printed books. Find your next great read.",
            )}
          </p>
          <a className="button" href="#catalogue">
            <BookOpen size={18} />
            {t("বইগুলো দেখুন", "Explore the collection")}
          </a>
          <div className="hero-note">
            <Check size={15} />
            {t(
              "একবার কিনুন, নিজের মতো পড়ুন",
              "Buy once. Read at your own pace.",
            )}
          </div>
        </div>
        <div className="hero-display" aria-hidden="true">
          <div className="hero-orbit" />
          <div className="hero-books">
            {heroBooks.map((b, i) => (
              <div key={b.id} className={`hero-book book-${i}`}>
                <Cover book={b} hero />
              </div>
            ))}
          </div>
          <span className="floating-label">
            <BookMarked size={19} />
            {t("ভালো বই, সবসময় কাছে", "Good books, always with you")}
          </span>
          <span className="hero-star">✳</span>
        </div>
      </section>
      <section
        className="benefits container"
        aria-label={t("স্টোরের সুবিধা", "Store benefits")}
      >
        <div>
          <Download />
          <span>
            <b>{t("যাচাইয়ের পর ডাউনলোড", "Download after review")}</b>
            <small>
              {t(
                "মালিক পেমেন্ট যাচাই করলে বইটি পাবেন",
                "The owner unlocks your book after verifying payment",
              )}
            </small>
          </span>
        </div>
        <div>
          <ShieldCheck />
          <span>
            <b>{t("bKash বা ডেলিভারিতে নগদ", "bKash or cash on delivery")}</b>
            <small>{t("ছাপা বইয়ে COD; bKash মালিক যাচাই করেন", "COD for print; bKash transfers are checked")}</small>
          </span>
        </div>
        <div>
          <Smartphone />
          <span>
            <b>{t("যেকোনো ডিভাইসে পড়ুন", "Read on your terms")}</b>
            <small>
              {t("মোবাইল, ট্যাবলেট বা কম্পিউটার", "Phone, tablet or computer")}
            </small>
          </span>
        </div>
      </section>
      <section id="catalogue" className="container catalogue">
        <div className="section-heading">
          <div>
            <span className="eyebrow muted">
              {t("বইয়ের জগতে", "THE BOOKSHELF")}
            </span>
            <h2>{t("আপনার জন্য বাছাই করা", "Find your next favourite")}</h2>
          </div>
          <span className="collection-count">
            {t(
              "একটু পড়ুন, অনেকটা আবিষ্কার করুন।",
              "A good read is a good beginning.",
            )}
          </span>
        </div>
        <div className="catalogue-tools">
          <label className="search-box">
            <Search size={20} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                "বই বা লেখকের নাম খুঁজুন…",
                "Search books or authors…",
              )}
              aria-label={t("বই খুঁজুন", "Search books")}
            />
            {search && (
              <button aria-label="Clear search" onClick={() => setSearch("")}>
                <X size={16} />
              </button>
            )}
          </label>
          <label className="sort">
            <SlidersHorizontal size={17} />
            <span className="sr-only">{t("সাজান", "Sort")}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="curated">
                {t("আমাদের বাছাই", "Our selection")}
              </option>
              <option value="low">
                {t("দাম: কম থেকে বেশি", "Price: low to high")}
              </option>
              <option value="high">
                {t("দাম: বেশি থেকে কম", "Price: high to low")}
              </option>
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
        <div
          id="categories"
          className="category-list"
          role="group"
          aria-label={t("বইয়ের বিভাগ", "Book categories")}
        >
          {categories.map((c) => (
            <button
              key={c.id}
              aria-pressed={category === c.id}
              className={category === c.id ? "active" : ""}
              onClick={() => setCategory(c.id)}
            >
              {locale === "bn" ? c.bn : c.en}
            </button>
          ))}
        </div>
        <div className="results-label" aria-live="polite">
          {t(`${filtered.length}টি বই`, `${filtered.length} books`)}
          {(search || category !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setCategory("all");
              }}
            >
              {t("সব দেখুন", "Clear filters")}
            </button>
          )}
        </div>
        {filtered.length ? (
          <div className="book-grid">
            {filtered.map((book) => (
              <article className="book-card" key={book.id}>
                <Link
                  className={`book-stage stage-${book.cover_style}`}
                  href={`/books/${book.slug}`}
                >
                  <Cover book={book} />
                  {book.is_demo && (
                    <span className="demo-badge">{t("নমুনা", "SAMPLE")}</span>
                  )}
                  <span className="view-book">
                    <ArrowUpRight size={18} />
                    <span className="sr-only">
                      {t("বই দেখুন", "View book")}
                    </span>
                  </span>
                </Link>
                <div className="book-info">
                  <div className="book-category">
                    {categories.find((c) => c.id === book.category)?.[locale] ||
                      book.category}
                  </div>
                  <h3>
                    <Link href={`/books/${book.slug}`}>
                      {locale === "bn" ? book.title_bn : book.title_en}
                    </Link>
                  </h3>
                  <p>{locale === "bn" ? book.author_bn : book.author_en}</p>
                  <div className="book-bottom">
                    <strong>
                      <Price paisa={book.formats.length ? book.price_paisa : book.print_price_paisa || 0} />
                    </strong>
                    <span>{[...book.formats, ...(book.print_price_paisa != null ? [t("ছাপা", "PRINT")] : [])].join(" · ")}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <Search size={36} />
            <h3>{t("কোনো বই পাওয়া যায়নি", "No books found")}</h3>
            <p>
              {t(
                "অন্য নাম বা বিভাগ দিয়ে খুঁজে দেখুন।",
                "Try another title, author or category.",
              )}
            </p>
            <button
              className="button secondary"
              onClick={() => {
                setSearch("");
                setCategory("all");
              }}
            >
              {t("সব বই দেখুন", "Show all books")}
            </button>
          </div>
        )}
      </section>
      <section className="container reading-banner">
        <span className="reading-icon">
          <BookOpen size={37} />
        </span>
        <div>
          <h2>
            {t(
              "আপনার লাইব্রেরি, আপনার সঙ্গেই।",
              "Your bookshelf. Always within reach.",
            )}
          </h2>
          <p>
            {t(
              "কেনা সব বই এক জায়গায়। যখন ইচ্ছে, আবার ডাউনলোড করুন।",
              "Every book you own, in one place. Come back and download whenever you like.",
            )}
          </p>
        </div>
        <Link href="/library" className="button secondary">
          {t("আমার লাইব্রেরি", "Visit my library")}
        </Link>
      </section>
    </>
  );
}

export function BookDetail({ book }: { book: Book }) {
  const { locale, t } = useLanguage();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cartError, setCartError] = useState("");
  const availablePrint = (book.print_on_hand || 0) - (book.print_reserved || 0);
  function addPrint() {
    if (!addToCart("book", book.id)) {
      setCartError(t("কার্টে সর্বোচ্চ পরিমাণ আছে।", "Cart quantity limit reached.")); return;
    }
    window.location.assign("/cart");
  }
  return (
    <div className="container page">
      <div className="breadcrumbs">
        <Link href="/">{t("হোম", "Home")}</Link>
        <span>/</span>
        <Link href="/#catalogue">{t("সব বই", "All books")}</Link>
        <span>/</span>
        <span>{locale === "bn" ? book.title_bn : book.title_en}</span>
      </div>
      <section className="book-detail">
        <div className={`detail-stage stage-${book.cover_style}`}>
          <Cover book={book} />
        </div>
        <div className="detail-copy">
          <span className="eyebrow muted">
            {categories.find((c) => c.id === book.category)?.[locale]}
          </span>
          <h1>{locale === "bn" ? book.title_bn : book.title_en}</h1>
          <p className="author">
            {locale === "bn" ? book.author_bn : book.author_en}
          </p>
          <p className="description">
            {locale === "bn" ? book.description_bn : book.description_en}
          </p>
          <div className="book-specs">
            <div>
              <small>{t("ভাষা", "Language")}</small>
              <b>{book.language === "bn" ? t("বাংলা", "Bangla") : "English"}</b>
            </div>
            <div>
              <small>{t("পৃষ্ঠা", "Pages")}</small>
              <b>{book.pages}</b>
            </div>
            <div>
              <small>{t("ফরম্যাট", "Formats")}</small>
              <b>{[...book.formats, ...(book.print_price_paisa != null ? [t("ছাপা", "Print")] : [])].join(" + ") || "—"}</b>
            </div>
          </div>
          <div className="edition-choices">
            {book.formats.length > 0 && <div className="panel edition-choice">
              <h2>{t("ইবুক", "Ebook")}</h2><p>{book.formats.join(" + ")}</p>
              <strong><Price paisa={book.price_paisa} /></strong>
              {!book.is_demo && <Link className="button wide" href={`/checkout/${book.slug}`}>{t("ইবুক কিনুন", "Buy ebook")}</Link>}
            </div>}
            {book.print_price_paisa != null && <div className="panel edition-choice">
              <h2>{t("ছাপা বই", "Printed book")}</h2>
              <p>{availablePrint > 0 ? t(`${availablePrint}টি কপি আছে`, `${availablePrint} copies available`) : t("মজুত নেই", "Out of stock")}</p>
              <strong><Price paisa={book.print_price_paisa} /></strong>
              {!book.is_demo && <button className="button wide" disabled={availablePrint < 1} onClick={addPrint}><ShoppingCart size={17} /> {t("কার্টে যোগ করুন", "Add to cart")}</button>}
            </div>}
          </div>
          {cartError && <p className="notice error" role="alert">{cartError}</p>}
          {!!book.preview_pages && <button type="button" className="button secondary wide" onClick={() => setPreviewOpen(true)}>
            {t(`প্রথম ${book.preview_pages} পৃষ্ঠা পড়ুন`, `Read ${book.preview_pages}-page preview`)}
          </button>}
          {!!book.formats.length && <p className="secure-note">
            <ShieldCheck size={16} />
            {t(
              "bKash পেমেন্ট যাচাইয়ের পর ডাউনলোড",
              "Download after manual bKash payment verification",
            )}
          </p>}
          {book.is_demo && (
            <div className="notice">
              {t(
                "এটি একটি নমুনা বই। এটি কেনা যাবে না।",
                "This is a sample ebook and cannot be purchased.",
              )}
            </div>
          )}
        </div>
      </section>
      {!!book.preview_pages && <PreviewDialog bookId={book.id} open={previewOpen} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

export function SignIn({
  configured,
  error,
}: {
  configured: boolean;
  error?: string;
}) {
  const { t } = useLanguage();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  const ready = configured && !!siteKey;
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const verifying = useRef(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(error ? "send" : "");
  const messages: Record<string, [string, string]> = {
    invalid: [
      "শুধু যাচাইকৃত @gmail.com অ্যাকাউন্ট ব্যবহার করুন।",
      "Please use a verified @gmail.com account.",
    ],
    captcha: [
      "নিরাপত্তা যাচাই সম্পন্ন করুন।",
      "Please complete the security check.",
    ],
    send: [
      "কোড পাঠানো যায়নি। একটু পরে আবার চেষ্টা করুন।",
      "We could not send the code. Please try again shortly.",
    ],
    code: [
      "কোডটি সঠিক নয়। আট সংখ্যার কোডটি আবার লিখুন।",
      "That code is not valid. Enter the eight-digit code again.",
    ],
  };

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function sendCode() {
    const normalized = email.trim().toLowerCase();
    if (!/^[^@\s]+@gmail\.com$/.test(normalized)) {
      setMessage("invalid");
      return;
    }
    if (!captchaToken) {
      setMessage("captcha");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error: sendError } = await browserClient().auth.signInWithOtp({
      email: normalized,
      options: { shouldCreateUser: true, captchaToken },
    });
    setCaptchaToken("");
    setCaptchaReset((value) => value + 1);
    setBusy(false);
    if (sendError) {
      setMessage("send");
      return;
    }
    setEmail(normalized);
    setCode("");
    setCooldown(60);
    setStep("code");
  }

  async function verifyCode() {
    if (verifying.current) return;
    if (!/^\d{8}$/.test(code)) {
      setMessage("code");
      return;
    }
    verifying.current = true;
    setBusy(true);
    setMessage("");
    const client = browserClient();
    const { data, error: verifyError } = await client.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    if (verifyError || !isGmailUser(data.user)) {
      if (data.session) await browserClient().auth.signOut();
      verifying.current = false;
      setBusy(false);
      // Supabase uses the same error for an expired token and a mismatched
      // token, so never claim that a code expired based on the error code.
      setMessage("code");
      return;
    }
    // A full navigation reads the freshly saved SSR cookies and starts at the
    // top of the storefront, even when sign-in began on a protected route.
    window.location.replace("/");
  }

  return (
    <div className="container auth-page">
      <div className="auth-card">
        <span className="large-icon">
          <BookOpen size={32} />
        </span>
        <span className="eyebrow muted">READ AND RICH</span>
        <h1>
          {t("আপনার পড়ার জগতে স্বাগতম", "Welcome to your reading world")}
        </h1>
        <p>
          {t(
            "Gmail-এ পাঠানো একবারের কোড দিয়ে নিরাপদে লগইন করুন।",
            "Sign in securely with a one-time code sent to your Gmail.",
          )}
        </p>
        {message && (
          <p className="notice error" role="alert">
            {t(...messages[message])}
          </p>
        )}
        {ready ? (
          <div className="auth-form">
            {step === "email" ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendCode();
                }}
              >
                <label htmlFor="signin-email">
                  {t("Gmail ঠিকানা", "Gmail address")}
                </label>
                <div className="auth-input">
                  <Mail size={18} />
                  <input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@gmail.com"
                    required
                  />
                </div>
                <Turnstile
                  siteKey={siteKey}
                  resetKey={captchaReset}
                  onToken={setCaptchaToken}
                />
                <button
                  className="button wide"
                  type="submit"
                  disabled={busy || !captchaToken}
                >
                  {busy
                    ? t("কোড পাঠানো হচ্ছে…", "Sending code…")
                    : t("লগইন কোড পাঠান", "Send login code")}
                </button>
              </form>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void verifyCode();
                }}
              >
                <p className="code-sent">
                  {t("কোড পাঠানো হয়েছে:", "Code sent to:")} <b>{email}</b>
                </p>
                <label htmlFor="signin-code">
                  {t("আট সংখ্যার কোড", "Eight-digit code")}
                </label>
                <div className="auth-input">
                  <KeyRound size={18} />
                  <input
                    id="signin-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{8}"
                    maxLength={8}
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, "").slice(0, 8))
                    }
                    placeholder="12345678"
                    required
                    autoFocus
                  />
                </div>
                <button className="button wide" type="submit" disabled={busy}>
                  {busy
                    ? t("যাচাই করা হচ্ছে…", "Verifying…")
                    : t("যাচাই করে লগইন করুন", "Verify and sign in")}
                </button>
                <Turnstile
                  siteKey={siteKey}
                  resetKey={captchaReset}
                  onToken={setCaptchaToken}
                />
                <div className="auth-secondary-actions">
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy || cooldown > 0 || !captchaToken}
                    onClick={() => void sendCode()}
                  >
                    {cooldown
                      ? t(
                          `${cooldown} সেকেন্ড পরে আবার পাঠান`,
                          `Resend in ${cooldown}s`,
                        )
                      : t("নতুন কোড পাঠান", "Send a new code")}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      setStep("email");
                      setCode("");
                      setMessage("");
                    }}
                  >
                    {t("Gmail বদলান", "Change Gmail")}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="notice">
            <LockKeyhole size={19} />
            {t(
              "Gmail কোড লগইন এখনো সম্পূর্ণভাবে সংযুক্ত হয়নি। এর মধ্যে নমুনা বইগুলো দেখতে পারেন।",
              "Gmail code sign-in is not fully connected yet. You can explore the sample collection in the meantime.",
            )}
          </div>
        )}
        <small>
          {t(
            "পাসওয়ার্ড লাগবে না · শুধু যাচাইকৃত @gmail.com ঠিকানা",
            "No password needed · verified @gmail.com addresses only",
          )}
        </small>
        <Link className="text-link" href="/#catalogue">
          {t("বইগুলো ঘুরে দেখুন", "Back to the collection")}
        </Link>
      </div>
    </div>
  );
}

export function Checkout({
  book,
  viewer,
  ready,
}: {
  book: Book;
  viewer: Viewer;
  ready: boolean;
}) {
  const { locale, t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id, accepted: data.get("accepted") === "on" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      window.location.assign(`/orders/${body.orderId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      setBusy(false);
    }
  }
  return (
    <div className="container page narrow">
      <Link className="text-link" href={`/books/${book.slug}`}>
        {t("বইয়ের বিবরণে ফিরুন", "Back to book details")}
      </Link>
      <h1>{t("বইটি আপনার করে নিন", "Make it yours")}</h1>
      <div className="checkout-layout">
        <form onSubmit={submit} className="panel checkout-form">
          <h2>{t("bKash চেকআউট", "bKash checkout")}</h2>
          <p>{t("অর্ডার তৈরির পর bKash নম্বর ও রেফারেন্স দেখানো হবে। টাকা পাঠানোর পর ট্রানজ্যাকশন আইডি দিন। মালিক যাচাই না করা পর্যন্ত ডাউনলোড চালু হবে না।", "After creating the order, you will see the bKash number and reference. Submit the transaction ID after paying. Downloads unlock only after the owner verifies the transfer.")}</p>
          {book.is_demo ? (
            <p className="notice">{t("নমুনা বই কেনা যাবে না।", "Sample books cannot be purchased.")}</p>
          ) : !viewer ? (
            <>
              <p>
                {t(
                  "চালিয়ে যেতে Gmail দিয়ে লগইন করুন।",
                  "Sign in with Gmail to continue.",
                )}
              </p>
              <Link
                className="button wide"
                href={`/signin?next=${encodeURIComponent(`/checkout/${book.slug}`)}`}
              >
                {t("Gmail কোড দিয়ে লগইন", "Sign in with a Gmail code")}
              </Link>
            </>
          ) : (
            <>
              <label>
                {t("Gmail ঠিকানা", "Gmail address")}
                <input value={viewer.email} readOnly type="email" />
              </label>
              <label className="checkbox">
                <input type="checkbox" name="accepted" required />
                <span>
                  {t("আমি স্টোরের", "I agree to the store’s")}{" "}
                  <Link href="/policies/terms">{t("শর্তাবলি", "terms")}</Link>{" "}
                  {t("ও", "and")}{" "}
                  <Link href="/policies/refund">
                    {t("রিফান্ড নীতি", "refund policy")}
                  </Link>
                </span>
              </label>
              {!ready && (
                <p className="notice">
                  {t(
                    "bKash চেকআউট এখনো চালু হয়নি। পরে আবার চেষ্টা করুন।",
                    "bKash checkout is not available yet. Please check back soon.",
                  )}
                </p>
              )}
              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
              <button className="button wide" disabled={busy || !ready}>
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <LockKeyhole size={17} />
                )}{" "}
                {t("অর্ডার তৈরি করুন", "Create order")}
              </button>
            </>
          )}
          <p className="secure-note">
            <ShieldCheck size={15} />
            {t(
              "আপনার bKash PIN বা OTP কখনো এখানে লিখবেন না।",
              "Never enter your bKash PIN or OTP on this site.",
            )}
          </p>
        </form>
        <aside className="panel order-summary">
          <Cover book={book} />
          <h3>{locale === "bn" ? book.title_bn : book.title_en}</h3>
          <p>{book.formats.join(" + ")}</p>
          <hr />
          <div className="total">
            <span>{t("সর্বমোট", "Total")}</span>
            <strong>
              <Price paisa={book.price_paisa} />
            </strong>
          </div>
          <p>
            <Check size={15} />
            {t(
              "পেমেন্ট নিশ্চিত হলে লাইব্রেরিতে পাবেন",
              "Added to your library after confirmation",
            )}
          </p>
        </aside>
      </div>
    </div>
  );
}

export function LibraryView({
  books,
  orders,
}: {
  books: Book[];
  orders: Order[];
}) {
  const { locale, t } = useLanguage();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function download(bookId: string, format: string) {
    setBusy(bookId + format);
    setError("");
    try {
      const res = await fetch(
        `/api/downloads/${bookId}/${format.toLowerCase()}`,
        { method: "POST" },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      window.location.assign(body.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download unavailable.");
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="container page">
      <span className="eyebrow muted">
        {t("আপনার নিজের সংগ্রহ", "YOUR PERSONAL COLLECTION")}
      </span>
      <h1>{t("আমার লাইব্রেরি", "My library")}</h1>
      <p className="page-intro">
        {t(
          "আপনার কেনা বইগুলো এখানেই। যখন ইচ্ছে, পড়তে শুরু করুন।",
          "All your books, right here. Your next chapter is waiting.",
        )}
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {books.length ? (
        <div className="library-grid">
          {books.map((book) => (
            <article className="panel library-book" key={book.id}>
              <Cover book={book} />
              <div>
                <h2>{locale === "bn" ? book.title_bn : book.title_en}</h2>
                <p>{locale === "bn" ? book.author_bn : book.author_en}</p>
                <div className="download-buttons">
                  {book.formats.map((format) => (
                    <button
                      className="button secondary small"
                      key={format}
                      disabled={!!busy}
                      onClick={() => download(book.id, format)}
                    >
                      {busy === book.id + format ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <Download size={16} />
                      )}{" "}
                      {format}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty panel">
          <Library size={42} />
          <h2>
            {t("আপনার প্রথম বইটির অপেক্ষায়", "Your first chapter awaits")}
          </h2>
          <p>
            {t(
              "কেনার পর আপনার বই এখানে দেখা যাবে।",
              "Your purchased ebooks will appear here.",
            )}
          </p>
          <Link className="button" href="/#catalogue">
            {t("বই খুঁজুন", "Find a book")}
          </Link>
        </div>
      )}
      {orders.length > 0 && (
        <section className="orders-section">
          <h2>{t("কেনাকাটার ইতিহাস", "Your orders")}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("বই", "Book")}</th>
                  <th>{t("তারিখ", "Date")}</th>
                  <th>{t("মূল্য", "Amount")}</th>
                  <th>{t("অবস্থা", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/orders/${order.id}`}>
                        {order.book_title}
                      </Link>
                    </td>
                    <td>
                      {new Date(order.created_at).toLocaleDateString(
                        locale === "bn" ? "bn-BD" : "en-GB",
                      )}
                    </td>
                    <td>
                      <Price paisa={order.amount_paisa} />
                    </td>
                    <td>
                      <span className={`status status-${order.status}`}>
                        {statusLabel(order.status, locale)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
export function statusLabel(status: string, locale: Locale) {
  const bn: Record<string, string> = {
    paid: "সম্পন্ন",
    pending: "অপেক্ষমাণ",
    failed: "ব্যর্থ",
    cancelled: "বাতিল",
    review: "যাচাই চলছে",
    refunded: "ফেরত দেওয়া হয়েছে",
    rejected: "দাবি গ্রহণ করা হয়নি",
  };
  const en: Record<string, string> = {
    paid: "Paid", pending: "Awaiting payment", failed: "Failed",
    cancelled: "Cancelled", review: "Under review", refunded: "Refunded",
    rejected: "Claim rejected",
  };
  return (locale === "bn" ? bn : en)[status] || status;
}
export function OrderView({ initial, initialClaim, bundleSnapshot }: {
  initial: Order; initialClaim: ManualClaim | null;
  bundleSnapshot?: { title_bn: string; title_en: string; members: { title_bn: string; title_en: string }[] } | null;
}) {
  const { locale, t } = useLanguage();
  const [order, setOrder] = useState(initial);
  const [claim, setClaim] = useState(initialClaim);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${order.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrder(data.order);
      setClaim(data.claim);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  async function submitClaim(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/orders/${order.id}/claim`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: values.get("transactionId"), senderLast4: values.get("senderLast4") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setOrder((current) => ({ ...current, status: "review" }));
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container auth-page">
      <div className="auth-card order-status">
        {order.status === "paid" ? (
          <CheckCircle2 className="success-icon" size={48} />
        ) : (
          <CircleHelp size={48} />
        )}
        <h1>{statusLabel(order.status, locale)}</h1>
        <h3>{bundleSnapshot ? (locale === "bn" ? bundleSnapshot.title_bn : bundleSnapshot.title_en) : order.book_title}</h3>
        {bundleSnapshot && <ul className="bundle-order-members">{bundleSnapshot.members.map((member, index) =>
          <li key={index}>{locale === "bn" ? member.title_bn : member.title_en}</li>)}</ul>}
        <p>
          <Price paisa={order.amount_paisa} />
        </p>
        <p>{order.status === "paid"
          ? t("আপনার বই এখন লাইব্রেরিতে। পড়া শুরু করুন!", "Your book is in your library. Happy reading!")
          : order.status === "review"
            ? t("লেনদেনের তথ্য জমা হয়েছে। মালিক bKash-এ টাকা পাওয়া যাচাই করছেন। যাচাই শেষ না হওয়া পর্যন্ত ডাউনলোড বন্ধ থাকবে।", "Your claim was submitted. The owner must verify the transfer in bKash before downloads unlock.")
            : order.status === "rejected"
              ? t("আপনার দাবি গ্রহণ করা হয়নি। নিচের কারণ দেখুন এবং সঠিক তথ্য দিয়ে আবার জমা দিন।", "Your claim was rejected. Read the reason below and resubmit the correct details.")
              : t("প্রথমে bKash-এ টাকা পাঠান, তারপর লেনদেনের আইডি জমা দিন।", "Pay in bKash first, then submit your transaction ID.")}</p>
        {order.payment_method === "bkash_manual" && (order.status === "pending" || order.status === "rejected") && (
          <div className="notice manual-payment">
            <h2>{t("bKash-এ পেমেন্ট করুন", "Pay with bKash")}</h2>
            <p>{t("গ্রহণকারীর নম্বর", "Receiving number")}: <strong>{order.manual_receive_number}</strong></p>
            <p>{t("ঠিক এই পরিমাণ পাঠান", "Send this exact amount")}: <strong><Price paisa={order.amount_paisa} /></strong></p>
            <p>{t("সম্ভব হলে bKash রেফারেন্সে এটি লিখুন", "Use this payment reference if bKash allows it")}: <strong>{order.tran_id}</strong></p>
            <p>{t("bKash অ্যাপ বা USSD-এ পেমেন্ট সম্পন্ন করুন। শুধু আইডি জমা দিলে বই খুলবে না। আপনার PIN বা OTP এখানে দেবেন না।", "Complete the payment in bKash. Submitting an ID alone does not unlock the book. Never enter your bKash PIN or OTP here.")}</p>
          </div>
        )}
        {claim?.status === "rejected" && claim.rejection_reason && (
          <p className="notice error" role="alert">{t("যাচাইয়ের কারণ: ", "Review reason: ")}{claim.rejection_reason}</p>
        )}
        {order.payment_method === "bkash_manual" && (order.status === "pending" || order.status === "rejected") && (
          <form className="admin-form" onSubmit={submitClaim}>
            <label>{t("bKash ট্রানজ্যাকশন আইডি", "bKash transaction ID")}
              <input name="transactionId" required minLength={6} maxLength={30} pattern="[A-Za-z0-9]{6,30}" autoCapitalize="characters" placeholder="e.g. A1B2C3D4" />
            </label>
            <label>{t("প্রেরকের bKash নম্বরের শেষ ৪ সংখ্যা", "Last 4 digits of sender's bKash number")}
              <input name="senderLast4" required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="1234" />
            </label>
            <button className="button wide" disabled={busy}>{t("যাচাইয়ের জন্য জমা দিন", "Submit for review")}</button>
          </form>
        )}
        {error && <p className="notice error">{error}</p>}
        {order.status !== "paid" && (
          <button
            className="button secondary wide"
            disabled={busy}
            onClick={refresh}
          >
            {busy && <LoaderCircle className="spin" size={17} />}{" "}
            {t("অবস্থা হালনাগাদ করুন", "Refresh order status")}
          </button>
        )}
        <Link className="button wide" href="/library">
          {t("লাইব্রেরিতে যান", "Go to my library")}
        </Link>
        <small>{t("অর্ডার রেফারেন্স", "Order reference")}: {order.tran_id}</small>
      </div>
    </div>
  );
}

export function PolicyView({
  policy,
  slug,
}: {
  policy: Policy | null;
  slug: string;
}) {
  const { locale, t } = useLanguage();
  return (
    <div className="container page narrow policy-page">
      <span className="eyebrow muted">READ AND RICH</span>
      <h1>
        {policy
          ? locale === "bn"
            ? policy.title_bn
            : policy.title_en
          : {
              privacy: t("গোপনীয়তা নীতি", "Privacy policy"),
              terms: t("শর্তাবলি", "Terms of service"),
              refund: t("রিফান্ড নীতি", "Refund policy"),
              copyright: t("কপিরাইট নীতি", "Copyright policy"),
              shipping: t("ডেলিভারি নীতি", "Shipping policy"),
            }[slug] || slug}
      </h1>
      {policy ? (
        <div className="policy-body">
          {locale === "bn" ? policy.body_bn : policy.body_en}
        </div>
      ) : (
        <div className="notice">
          {t(
            "এই নীতিমালাটি এখনো প্রকাশিত হয়নি। প্রয়োজন হলে স্টোর মালিকের সঙ্গে যোগাযোগ করুন।",
            "This policy is not published yet. Contact the store owner if you need help.",
          )}
        </div>
      )}
    </div>
  );
}
export function HowItWorks() {
  const { t } = useLanguage();
  return (
    <div className="container page narrow">
      <span className="eyebrow muted">
        {t("পড়া শুরু করা সহজ", "A GOOD READ IS THREE STEPS AWAY")}
      </span>
      <h1>{t("যেভাবে বই কিনবেন", "How to buy your books")}</h1>
      <div className="steps">
        {[
          [
            BookOpen,
            "পছন্দের বই বেছে নিন",
            "Find your next book",
            "ক্যাটালগ ও বান্ডেল দেখুন; ইবুক বা ছাপা সংস্করণ বেছে নিন।",
            "Browse books and bundles; choose an ebook or printed edition.",
          ],
          [
            ShieldCheck,
            "Gmail দিয়ে লগইন ও পেমেন্ট",
            "Sign in and check out",
            "Gmail দিয়ে লগইন করুন। ছাপা বইয়ের জন্য ডেলিভারিতে নগদ বা bKash বেছে নিন; ইবুকে bKash ব্যবহার করুন।",
            "Sign in with Gmail. Choose COD or bKash for print; use bKash for ebooks.",
          ],
          [
            Download,
            "বই হাতে পান বা ডাউনলোড করুন",
            "Receive or download",
            "ছাপা বইয়ের অর্ডার ও কুরিয়ারের তথ্য 'আমার অর্ডার'-এ দেখুন। bKash যাচাই হলে ইবুক লাইব্রেরি থেকে নামান।",
            "Track printed orders in My Orders. Download ebooks from My Library after bKash verification.",
          ],
        ].map(([Icon, bn, en, dbn, den], i) => {
          const C = Icon as typeof BookOpen;
          return (
            <article className="panel step" key={i}>
              <span className="step-number">0{i + 1}</span>
              <C size={26} />
              <h2>{t(bn as string, en as string)}</h2>
              <p>{t(dbn as string, den as string)}</p>
            </article>
          );
        })}
      </div>
      <Link className="button" href="/#catalogue">
        {t("বই খুঁজুন", "Explore books")}
      </Link>
    </div>
  );
}
