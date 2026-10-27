"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkoutControlsInput, type CheckoutControls } from "@/lib/checkout-controls";
import { useLanguage } from "./store";

export function CheckoutSettings({ initial, gates, physicalGates, onSuccess }: {
  initial: CheckoutControls; gates: { key: string; label: string; passed: boolean }[];
  physicalGates: { key: string; label: string; passed: boolean }[];
  onSuccess: (message: string) => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const parsed = checkoutControlsInput.safeParse(draft);
    if (!parsed.success) { setError(t("চালু করার আগে ব্যবসায়িক bKash অ্যাকাউন্ট ও COD কুরিয়ারের প্রযোজ্য নিশ্চয়তা দিন।", parsed.error.issues[0].message)); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/checkout-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save checkout settings.");
      onSuccess(t("পেমেন্টের সুইচ সংরক্ষিত। নিচে চালু হওয়ার অবস্থা দেখুন।", "Payment switches saved. Check the availability status below.")); router.refresh();
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  const requirements = [
    ["businessConfirmed", t("আমার অনুমোদিত ব্যবসায়িক bKash অ্যাকাউন্ট প্রস্তুত", "My eligible business bKash account is ready")],
    ["bkashEnabled", t("bKash পেমেন্ট চালু করুন", "Enable bKash payments")],
    ["courierConfirmed", t("আমার COD সংগ্রহকারী কুরিয়ার প্রস্তুত", "My courier can collect cash on delivery")],
    ["codEnabled", t("ক্যাশ অন ডেলিভারি চালু করুন", "Enable cash on delivery")],
  ] as const;
  const ebookReady = gates.length > 0 && gates.every((gate) => gate.passed);
  const codReady = physicalGates.length > 0 && physicalGates.every((gate) => gate.passed);
  const printedBkashReady = physicalGates.length > 0 &&
    physicalGates.filter((gate) => !["courier", "cod"].includes(gate.key)).every((gate) => gate.passed) &&
    ["account", "number", "enabled"].every((key) => gates.some((gate) => gate.key === key && gate.passed));
  return <section className="panel admin-form">
    <h2>{t("পেমেন্ট চালু / বন্ধ", "Enable or pause payments")}</h2>
    <p>{t("bKash ট্রানজ্যাকশন আপনি যাচাই করে অনুমোদন করবেন। COD শুধু ছাপা বইয়ের জন্য; টাকা পাওয়ার পরেই পরিশোধিত করুন।", "Verify and approve bKash transfers yourself. COD is for printed books only; mark it paid only after collecting cash.")}</p>
    <form className="admin-form" onSubmit={(event) => void save(event)}>
      {requirements.map(([key, label]) => <label className="checkbox" key={key}><input type="checkbox" disabled={busy} checked={draft[key]}
        onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })} />{label}</label>)}
      {error && <p role="alert" className="notice error">{error}</p>}
      <button className="button" disabled={busy}>{busy ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("পেমেন্ট সেটিংস সংরক্ষণ করুন", "Save payment switches")}</button>
    </form>
    <h3>{t("সংরক্ষিত সেটিংস অনুযায়ী বর্তমান অবস্থা", "Availability with saved settings")}</h3>
    <p>bKash {t("ইবুক", "ebooks")}: {ebookReady ? t("চালু", "Open") : t("এখনো বন্ধ", "Not open yet")} · COD: {codReady ? t("চালু", "Open") : t("এখনো বন্ধ", "Not open yet")}</p>
    <p>bKash {t("ছাপা বই", "printed books")}: {printedBkashReady ? t("চালু", "Open") : t("এখনো বন্ধ", "Not open yet")}</p>
    <p>{t("সুইচ চালু থাকলেও নিচের অসম্পূর্ণ শর্ত পূরণ না হলে চেকআউট খুলবে না।", "Switches do not bypass these requirements. Complete any outstanding items to open checkout.")}</p>
    <ul>{[...gates, ...physicalGates].filter((gate) => !gate.passed).map((gate, index) => <li key={`${gate.key}-${index}`}>{gate.label}</li>)}</ul>
  </section>;
}
