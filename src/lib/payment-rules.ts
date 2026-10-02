import type { Order, PaymentMode } from "./types";
import { moneyToPaisa } from "./security";
export type GatewayResult = {
  status?: string;
  tran_id?: string;
  val_id?: string;
  bank_tran_id?: string;
  amount?: string;
  currency?: string;
  currency_type?: string;
  risk_level?: string | number;
  store_id?: string;
};
export function validatePayment(
  order: Pick<Order, "tran_id" | "amount_paisa">,
  value: GatewayResult,
  storeId: string,
) {
  if (!["VALID", "VALIDATED"].includes(value.status || ""))
    throw new Error("Payment not confirmed");
  if (
    value.tran_id !== order.tran_id ||
    moneyToPaisa(value.amount) !== order.amount_paisa ||
    value.currency !== "BDT"
  )
    throw new Error("Payment details do not match");
  if (value.store_id && value.store_id !== storeId)
    throw new Error("Merchant mismatch");
  if (!value.val_id || !value.bank_tran_id)
    throw new Error("Payment identity missing");
  return String(value.risk_level) === "0"
    ? ("paid" as const)
    : ("review" as const);
}
export type LaunchSettings = {
  mode: PaymentMode;
  appUrl: string;
  enabled: boolean;
  merchantApproved: boolean;
  paidHosting: boolean;
  tested: boolean;
  testMode: boolean;
  adminConfigured: boolean;
  credentials: boolean;
  policies: boolean;
  realCatalogue: boolean;
};
export function launchGates(settings: LaunchSettings) {
  const url = new URL(settings.appUrl);
  return [
    {
      key: "owner",
      label: "Owner Gmail configured",
      passed: settings.adminConfigured,
    },
    {
      key: "credentials",
      label: "Payment credentials configured",
      passed: settings.credentials,
    },
    {
      key: "policies",
      label: "Four policies published in both languages",
      passed: settings.policies,
    },
    {
      key: "catalogue",
      label: "Real catalogue with downloadable files",
      passed: settings.realCatalogue,
    },
    {
      key: "merchant",
      label: "Merchant approval confirmed",
      passed: settings.merchantApproved,
    },
    {
      key: "hosting",
      label: "Paid hosting confirmed",
      passed: settings.paidHosting,
    },
    {
      key: "domain",
      label: "Custom HTTPS domain",
      passed:
        url.protocol === "https:" &&
        !url.hostname.endsWith(".onrender.com") &&
        !["localhost", "127.0.0.1"].includes(url.hostname),
    },
    {
      key: "tested",
      label: "Live payment tests confirmed",
      passed: settings.tested,
    },
    {
      key: "enabled",
      label: "Live payments enabled",
      passed: settings.enabled,
    },
  ];
}
export function canTakePayment(settings: LaunchSettings, owner: boolean) {
  if (settings.mode === "sandbox") return settings.credentials;
  const gates = launchGates(settings);
  return (
    gates.every(
      (g) => g.passed || (g.key === "tested" && settings.testMode && owner),
    ) &&
    (!settings.testMode || owner)
  );
}
