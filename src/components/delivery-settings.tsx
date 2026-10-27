"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { districts } from "@/lib/commerce-validation";
import { deliverySettingsInput, type DeliveryDistrict } from "@/lib/delivery-validation";
import { useLanguage } from "./store";

export function DeliverySettings({ shipping, onSuccess }: {
  shipping: DeliveryDistrict[]; onSuccess: (message: string) => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [rows, setRows] = useState(shipping.map((row) => ({ district: row.district, fee: String(row.fee_paisa / 100) })));
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (rows.some((row) => !/^\d+(\.\d{1,2})?$/.test(row.fee))) {
      setError(t("প্রতিটি জেলার ফি লিখুন; বিনামূল্যে হলে ০ লিখুন।", "Enter each district's fee; enter 0 for free delivery.")); return;
    }
    const input = deliverySettingsInput.safeParse({ districts: rows.map((row) => ({ district: row.district, fee_paisa: Math.round(Number(row.fee) * 100) })) });
    if (!input.success) { setError(t("প্রতিটি জেলা একবার বাছুন এবং ০–১০,০০০ টাকা ফি দিন।", "Choose each district once and set fees between 0 and 10,000 BDT.")); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/shipping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save delivery districts.");
      onSuccess(t("ডেলিভারি জেলা ও ফি সংরক্ষিত হয়েছে।", "Delivery districts and fees saved.")); router.refresh();
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return <form className="panel admin-form" onSubmit={(event) => void save(event)}>
    <h2>{t("ডেলিভারি ফি", "Delivery fees")}</h2>
    <p>{t("শুধু নিচের জেলায় নতুন অর্ডার নেওয়া হবে। জেলা যোগ বা সরিয়ে আলাদা ফি দিন। পরিবর্তন করে সংরক্ষণ করুন। আগের অর্ডার বদলাবে না।", "New orders can ship only to the districts below. Add or remove districts and set separate fees, then save. Existing orders stay unchanged.")}</p>
    <fieldset disabled={busy} className="admin-form">
      <legend>{t("ডেলিভারি জেলা", "Delivery districts")}</legend>
      {rows.map((row) => <div className="delivery-district-row" key={row.district}>
        <label>{row.district} — {t("ফি (টাকা)", "Fee (BDT)")}
          <input type="number" required min="0" max="10000" step="0.01" value={row.fee}
            onChange={(event) => setRows(rows.map((item) => item.district === row.district ? { ...item, fee: event.target.value } : item))} />
        </label>
        <button type="button" className="button secondary" aria-label={`${t("সরান", "Remove")} ${row.district}`}
          onClick={() => setRows(rows.filter((item) => item.district !== row.district))}>{t("সরান", "Remove")}</button>
      </div>)}
      {!rows.length && <p className="notice">{t("কোনো জেলা নেই। সংরক্ষণ করলে ছাপা বইয়ের চেকআউট বন্ধ থাকবে।", "No districts selected. Saving this will close printed-book checkout.")}</p>}
      <div className="delivery-district-row">
        <label>{t("জেলা বাছুন", "Choose district to add")}<select value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">{t("জেলা বাছুন", "Choose district")}</option>
          {districts.filter((district) => !rows.some((row) => row.district === district)).map((district) => <option key={district}>{district}</option>)}
        </select></label>
        <button type="button" className="button secondary" disabled={!selected} onClick={() => {
          setRows([...rows, { district: selected as DeliveryDistrict["district"], fee: "" }]); setSelected("");
        }}>{t("জেলা যোগ করুন", "Add district")}</button>
      </div>
    </fieldset>
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="button" disabled={busy}>{busy ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("ডেলিভারি ফি সংরক্ষণ করুন", "Save delivery fees")}</button>
  </form>;
}
