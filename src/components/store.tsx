"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
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
} from "lucide-react";
import type { Book, Locale, Viewer, Order, Policy } from "@/lib/types";
import { categories } from "@/lib/demo";
import { browserClient } from "@/lib/supabase-browser";
import { isGmailUser } from "@/lib/security";
import { Turnstile } from "@/components/turnstile";

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
  sandbox,
}: {
  children: ReactNode;
  initialLocale: Locale;
  viewer: Viewer;
  configured: boolean;
  sandbox: boolean;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [menu, setMenu] = useState(false);
  const router = useRouter();
  const t = (bn: string, en: string) => (locale === "bn" ? bn : en);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  function switchLanguage() {
    const next = locale === "bn" ? "en" : "bn";
    setLocale(next);
    document.cookie = `locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }
  async function logout() {
    await fetch("/auth/signout", { method: "POST" });
    window.location.assign("/");
  }
  return (
    <Language.Provider value={{ locale, t }}>
      <a className="skip" href="#main">
        {t("মূল বিষয়বস্তুতে যান", "Skip to content")}
      </a>
      {sandbox && (
        <div className="pilot-bar">
          <span className="pilot-dot" />
          {t(
            "পাইলট সংস্করণ · নমুনা বই ও পরীক্ষামূলক পেমেন্ট",
            "PILOT STORE · SAMPLE BOOKS & TEST PAYMENTS",
          )}
          <span>{t("আসল টাকা কাটা হবে না", "No real charges")}</span>
        </div>
      )}
      <header className="header">
        <div className="container header-inner">
          <Link href="/" className="brand" aria-label="BoiShelf home">
            <span className="brand-icon">
              <BookOpen size={23} />
            </span>
            <span>
              Boi<span className="brand-light">Shelf</span>
              <i />
            </span>
          </Link>
          <nav
            className="desktop-nav"
            aria-label={t("প্রধান নেভিগেশন", "Main navigation")}
          >
            <Link href="/#catalogue">{t("বই খুঁজুন", "Explore books")}</Link>
            <Link href="/#categories">{t("বিভাগসমূহ", "Categories")}</Link>
            <Link href="/how-it-works">
              {t("যেভাবে কাজ করে", "How it works")}
            </Link>
          </nav>
          <div className="header-actions">
            <button
              className="language-button"
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
                Boi<span className="brand-light">Shelf</span>
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
            {viewer?.admin && (
              <Link href="/admin">
                <LayoutDashboard size={14} />{" "}
                {t("স্টোর পরিচালনা", "Manage store")}
              </Link>
            )}
          </div>
          <div className="payment-brands">
            <small>
              {t("SSLCOMMERZ-এর মাধ্যমে পেমেন্ট", "PAYMENTS VIA SSLCOMMERZ")}
            </small>
            <div>
              <b className="bkash">bKash</b>
              <b className="nagad">Nagad</b>
              <b className="visa">VISA</b>
              <b className="rocket">Rocket</b>
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} BoiShelf</span>
          <div>
            {["privacy", "terms", "refund", "copyright"].map((slug, i) => (
              <Link key={slug} href={`/policies/${slug}`}>
                {t(
                  ["গোপনীয়তা", "শর্তাবলি", "রিফান্ড", "কপিরাইট"][i],
                  ["Privacy", "Terms", "Refunds", "Copyright"][i],
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
    </Language.Provider>
  );
}

export function Cover({ book, hero = false }: { book: Book; hero?: boolean }) {
  const { locale } = useLanguage();
  if (book.cover_path)
    return (
      <div className={`cover cover-uploaded ${hero ? "hero-cover" : ""}`}>
        <img
          src={`/api/covers/${book.id}`}
          alt={locale === "bn" ? book.title_bn : book.title_en}
          loading={hero ? "eager" : "lazy"}
        />
      </div>
    );
  return (
    <div
      className={`cover cover-${book.cover_style} ${hero ? "hero-cover" : ""}`}
      aria-label={locale === "bn" ? book.title_bn : book.title_en}
    >
      <div className="cover-top">
        BOISHELF <span>EDITION 01</span>
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
            ? a.price_paisa - b.price_paisa
            : sort === "high"
              ? b.price_paisa - a.price_paisa
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
              "গল্প, নতুন ভাবনা আর শেখার আনন্দ। পছন্দের ইবুকটি বেছে নিন, পড়ুন আপনার নিজের সময়ে।",
              "Stories to get lost in. Ideas to grow with. Discover your next great read, wherever life takes you.",
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
            <b>{t("কেনার পরই ডাউনলোড", "Yours in a moment")}</b>
            <small>
              {t(
                "পেমেন্ট নিশ্চিত হলেই বই আপনার",
                "Download after payment confirmation",
              )}
            </small>
          </span>
        </div>
        <div>
          <ShieldCheck />
          <span>
            <b>{t("বিশ্বস্ত পেমেন্ট", "Familiar ways to pay")}</b>
            <small>{t("bKash, Nagad ও কার্ড", "bKash, Nagad & cards")}</small>
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
                      <Price paisa={book.price_paisa} />
                    </strong>
                    <span>{book.formats.join(" · ")}</span>
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
              <b>{book.formats.join(" + ") || "—"}</b>
            </div>
          </div>
          <div className="detail-price">
            <Price paisa={book.price_paisa} />
            <small>
              {t(
                "সব উপলব্ধ ফরম্যাট অন্তর্ভুক্ত",
                "Includes all available formats",
              )}
            </small>
          </div>
          <Link className="button wide" href={`/checkout/${book.slug}`}>
            {t("এখনই কিনুন", "Buy this ebook")}
          </Link>
          <p className="secure-note">
            <ShieldCheck size={16} />
            {t(
              "SSLCOMMERZ-এর মাধ্যমে নিরাপদ চেকআউট",
              "Secure checkout with SSLCOMMERZ",
            )}
          </p>
          {book.is_demo && (
            <div className="notice">
              {t(
                "এটি একটি নমুনা বই। শুধু পরীক্ষামূলক পেমেন্টের জন্য।",
                "This is a sample ebook for test purchases only.",
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function SignIn({
  configured,
  returnTo,
  error,
}: {
  configured: boolean;
  returnTo: string;
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
      "কোডটি সঠিক নয়। ছয় সংখ্যার কোডটি আবার লিখুন।",
      "That code is not valid. Enter the six-digit code again.",
    ],
    expired: [
      "কোডটির মেয়াদ শেষ হয়েছে। নতুন কোড নিন।",
      "That code has expired. Request a new one.",
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
    if (!/^\d{6}$/.test(code)) {
      setMessage("code");
      return;
    }
    setBusy(true);
    setMessage("");
    const client = browserClient();
    let { data, error: verifyError } = await client.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    // A first-time sign-in can be classified by Supabase as signup
    // confirmation. Retry with that OTP type before showing an error.
    if (verifyError) {
      const retry = await client.auth.verifyOtp({
        email,
        token: code,
        type: "signup",
      });
      data = retry.data;
      verifyError = retry.error;
    }
    if (verifyError || !isGmailUser(data.user)) {
      if (data.session) await browserClient().auth.signOut();
      setBusy(false);
      setMessage(verifyError?.code?.includes("expired") ? "expired" : "code");
      return;
    }
    window.location.assign(returnTo);
  }

  return (
    <div className="container auth-page">
      <div className="auth-card">
        <span className="large-icon">
          <BookOpen size={32} />
        </span>
        <span className="eyebrow muted">BOISHELF</span>
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
                  {t("ছয় সংখ্যার কোড", "Six-digit code")}
                </label>
                <div className="auth-input">
                  <KeyRound size={18} />
                  <input
                    id="signin-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="123456"
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
  sandbox,
}: {
  book: Book;
  viewer: Viewer;
  ready: boolean;
  sandbox: boolean;
}) {
  const { locale, t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, bookId: book.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      window.location.assign(body.url);
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
          <h2>{t("চেকআউট", "Checkout")}</h2>
          {sandbox && (
            <div className="notice">
              {t(
                "পরীক্ষামূলক পেমেন্ট। আসল টাকা বা আসল কার্ড ব্যবহার করবেন না।",
                "Test checkout. Do not use real money or real card details.",
              )}
            </div>
          )}
          {!viewer ? (
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
                {t("আপনার নাম", "Your name")}
                <input
                  name="name"
                  required
                  maxLength={80}
                  defaultValue={viewer.name}
                  autoComplete="name"
                />
              </label>
              <label>
                {t("Gmail ঠিকানা", "Gmail address")}
                <input value={viewer.email} readOnly type="email" />
              </label>
              <label>
                {t("মোবাইল নম্বর", "Mobile number")}
                <input
                  name="phone"
                  type="tel"
                  required
                  pattern="(?:\+?88)?01[3-9][0-9]{8}"
                  placeholder="01XXXXXXXXX"
                  autoComplete="tel"
                />
              </label>
              <label>
                {t("বিলিং ঠিকানা", "Billing address")}
                <input
                  name="address"
                  required
                  maxLength={160}
                  autoComplete="street-address"
                />
              </label>
              <label>
                {t("শহর", "City")}
                <input
                  name="city"
                  required
                  maxLength={60}
                  autoComplete="address-level2"
                />
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
                  {sandbox && t(" (পাইলট পরীক্ষা)", " (pilot test)")}
                </span>
              </label>
              {!ready && (
                <p className="notice">
                  {t(
                    "পেমেন্ট এখনো চালু হয়নি। পরে আবার চেষ্টা করুন।",
                    "Payments are not connected yet. Please check back soon.",
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
                {t("পেমেন্টে যান", "Continue to payment")}
              </button>
            </>
          )}
          <p className="secure-note">
            <ShieldCheck size={15} />
            {t(
              "পেমেন্টের তথ্য স্টোরে সংরক্ষণ করা হয় না।",
              "Payment details are handled by SSLCOMMERZ.",
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
  sandbox,
}: {
  books: Book[];
  orders: Order[];
  sandbox: boolean;
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
      {sandbox && (
        <div className="notice">
          {t(
            "এখানে শুধু পরীক্ষামূলক কেনাকাটা দেখানো হচ্ছে।",
            "Showing sandbox purchases only.",
          )}
        </div>
      )}
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
  const map: Record<string, string> = {
    paid: "সম্পন্ন",
    pending: "অপেক্ষমাণ",
    failed: "ব্যর্থ",
    cancelled: "বাতিল",
    review: "যাচাই চলছে",
    refunded: "ফেরত দেওয়া হয়েছে",
  };
  return locale === "bn"
    ? map[status] || status
    : status.charAt(0).toUpperCase() + status.slice(1);
}
export function OrderView({ initial }: { initial: Order }) {
  const { locale, t } = useLanguage();
  const [order, setOrder] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${order.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrder(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (initial.status !== "pending") return;
    let count = 0;
    const timer = setInterval(() => {
      if (++count > 4) {
        clearInterval(timer);
        return;
      }
      void refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [initial.id]);
  return (
    <div className="container auth-page">
      <div className="auth-card order-status">
        {order.status === "paid" ? (
          <CheckCircle2 className="success-icon" size={48} />
        ) : (
          <CircleHelp size={48} />
        )}
        <h1>{statusLabel(order.status, locale)}</h1>
        <h3>{order.book_title}</h3>
        <p>
          <Price paisa={order.amount_paisa} />
        </p>
        <p>
          {order.status === "paid"
            ? t(
                "আপনার বই এখন লাইব্রেরিতে। পড়া শুরু করুন!",
                "Your book is in your library. Happy reading!",
              )
            : order.status === "review"
              ? t(
                  "পেমেন্টটি পর্যালোচনা করা হচ্ছে। সহায়তার জন্য স্টোরে যোগাযোগ করুন।",
                  "This payment needs review. Please contact the store for help.",
                )
              : t(
                  "পেমেন্টের অবস্থা নিশ্চিত করতে নিচের বোতাম ব্যবহার করুন।",
                  "Check the latest payment status below.",
                )}
        </p>
        {error && <p className="notice error">{error}</p>}
        {order.status !== "paid" && (
          <button
            className="button secondary wide"
            disabled={busy}
            onClick={refresh}
          >
            {busy && <LoaderCircle className="spin" size={17} />}{" "}
            {t("আবার যাচাই করুন", "Check payment status")}
          </button>
        )}
        <Link className="button wide" href="/library">
          {t("লাইব্রেরিতে যান", "Go to my library")}
        </Link>
        <small>{order.tran_id}</small>
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
      <span className="eyebrow muted">BOISHELF</span>
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
            }[slug] || slug}
      </h1>
      {policy ? (
        <div className="policy-body">
          {locale === "bn" ? policy.body_bn : policy.body_en}
        </div>
      ) : (
        <div className="notice">
          {t(
            "স্টোর মালিকের চূড়ান্ত নীতিমালা এখনো প্রকাশিত হয়নি। এটি পরীক্ষামূলক স্টোর; আসল টাকা নেওয়া হচ্ছে না।",
            "The store owner’s final policy has not been published yet. This is a pilot store and real payments are disabled.",
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
      <h1>{t("যেভাবে বই কিনবেন", "A simpler way to read")}</h1>
      <div className="steps">
        {[
          [
            BookOpen,
            "পছন্দের বই বেছে নিন",
            "Find your next book",
            "ক্যাটালগ ঘুরে দেখুন, বইয়ের বিবরণ ও ফরম্যাট দেখে নিন।",
            "Browse the collection and check the description and available formats.",
          ],
          [
            ShieldCheck,
            "Gmail দিয়ে লগইন ও পেমেন্ট",
            "Sign in and check out",
            "Gmail দিয়ে লগইন করে SSLCOMMERZ-এ পছন্দের মাধ্যমে পেমেন্ট করুন।",
            "Use your Gmail account, then pay through SSLCOMMERZ with an available payment method.",
          ],
          [
            Download,
            "ডাউনলোড করে পড়ুন",
            "Download and enjoy",
            "পেমেন্ট নিশ্চিত হলে লাইব্রেরি থেকে PDF বা EPUB নামিয়ে নিন।",
            "Once payment is confirmed, download your PDF or EPUB from My library.",
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
