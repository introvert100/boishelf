"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "./store";
import { paymentSettingsInput, type PaymentSettings } from "@/lib/payment-validation";

export function PaymentSettingsEditor({ settings, onSuccess }: {
  settings: PaymentSettings; onSuccess: (message: string) => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [number, setNumber] = useState(settings.receivingNumber || "");
  const [savedNumber, setSavedNumber] = useState(settings.receivingNumber);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const parsed = paymentSettingsInput.safeParse({ receivingNumber: number });
    if (!parsed.success) {
      setError(t("১১ সংখ্যার বাংলাদেশি bKash প্রাপক নম্বর লিখুন, যেমন 01712345678।",
        parsed.error.issues[0].message)); return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/payments", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const result = await response.json();
      if (!response.ok) throw new Error(`${result.error || "Could not save the receiving number."}${result.requestId ? ` (request ${result.requestId})` : ""}`);
      setSavedNumber(result.receivingNumber); setNumber(result.receivingNumber);
      onSuccess(t("bKash নম্বর সংরক্ষিত। নতুন অর্ডারে এই নম্বর দেখাবে।", "bKash number saved. New orders will use this number."));
      router.refresh();
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return <form className="panel admin-form payment-settings-form" onSubmit={(event) => void save(event)} noValidate>
    <h2>{t("bKash পেমেন্ট সেটিংস", "bKash payment settings")}</h2>
    <p>{t("ক্রেতারা এই ব্যবসায়িক নম্বরে টাকা পাঠিয়ে ট্রানজ্যাকশন আইডি জমা দেবেন। আপনি bKash-এ যাচাই করে অর্ডার অনুমোদন করবেন।",
      "Customers pay to this business receiving number and submit their transaction ID. Verify the transfer in bKash, then approve it in Orders.")}</p>
    <p>{t("বর্তমানে সংরক্ষিত নম্বর", "Current receiving number")}: <strong>{savedNumber || t("সেট করা হয়নি", "Not configured")}</strong></p>
    <label htmlFor="bkash-receiving-number">{t("bKash প্রাপক নম্বর", "bKash receiving number")}</label>
    <input id="bkash-receiving-number" type="tel" inputMode="numeric" autoComplete="off" value={number}
      maxLength={11} disabled={busy} aria-invalid={!!error} aria-describedby={`bkash-number-help${error ? " bkash-number-error" : ""}`}
      onChange={(event) => { setNumber(event.target.value); setError(""); }} />
    <small id="bkash-number-help">{t("১১ সংখ্যা, 01 দিয়ে শুরু। আপনার অনুমোদিত ব্যবসায়িক bKash নম্বর ব্যবহার করুন। আগের অর্ডারের নম্বর বদলাবে না।",
      "11 digits starting with 01. Use your eligible business bKash number. Existing orders keep their original number.")}</small>
    {error && <p id="bkash-number-error" className="notice error" role="alert">{error}</p>}
    <button className="button" disabled={busy}>{busy ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("bKash নম্বর সংরক্ষণ করুন", "Save bKash number")}</button>
    <p className="field-help">{t("নম্বর সংরক্ষণ করলেই চেকআউট চালু হবে না। প্রকাশের প্রস্তুতিতে বাকি শর্ত দেখুন।", "Saving a number does not enable checkout. Check Launch readiness for the remaining requirements.")}</p>
  </form>;
}
