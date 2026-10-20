"use client";
import { useState } from "react";
import { useLanguage } from "./store";

export function CopyPaymentNumber({ number }: { number: string | null }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!number) return null;
  return <span className="payment-number">
    <strong>{number}</strong>{" "}
    <button type="button" className="button secondary" onClick={async () => {
      try { await navigator.clipboard.writeText(number); setCopied(true); setFailed(false); }
      catch { setCopied(false); setFailed(true); }
    }}>{t("নম্বর কপি করুন", "Copy number")}</button>
    <span role="status">{failed ? t("কপি করা যায়নি। উপরের নম্বরটি বেছে কপি করুন।", "Could not copy. Select and copy the number above.") : copied ? t("নম্বর কপি হয়েছে।", "Number copied.") : ""}</span>
  </span>;
}
