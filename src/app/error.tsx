"use client";
import { useLanguage } from "@/components/store";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="container page empty">
      <h1>{t("একটু সমস্যা হয়েছে", "We couldn’t load this page")}</h1>
      <p>
        {t("কিছুক্ষণ পরে আবার চেষ্টা করুন।", "Please try again in a moment.")}
      </p>
      <button className="button" onClick={reset}>
        {t("আবার চেষ্টা করুন", "Try again")}
      </button>
    </div>
  );
}
