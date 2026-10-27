import "server-only";
import { hasSupabase, ownerEmail } from "./config";
import { paymentSettings } from "./payment-settings";
import { serviceClient } from "./supabase";
import { policySlugs } from "./types";

export async function readiness() {
  const { receivingNumber, checkout } = await paymentSettings();
  let policies = false;
  let realCatalogue = false;
  if (hasSupabase()) {
    const db = serviceClient();
    const [{ data: p, error: pe }, { data: b, error: be }] = await Promise.all([
      db.from("policies").select("slug,body_bn,body_en").eq("published", true),
      db.from("books").select("id,book_formats(id)").eq("published", true)
        .eq("is_demo", false).is("archived_at", null).limit(100),
    ]);
    if (pe || be) throw pe || be;
    policies = policySlugs.filter((slug) => slug !== "shipping").every((slug) =>
      p?.some((x) => x.slug === slug && x.body_bn.trim() && x.body_en.trim()));
    realCatalogue = !!b?.some((x) => x.book_formats.length > 0);
  }
  const gates = [
    { key: "owner", label: "Owner Gmail configured", passed: /^[^@\s]+@gmail\.com$/.test(ownerEmail()) },
    { key: "account", label: "Eligible bKash business account confirmed in Admin → Payments", passed: checkout.businessConfirmed },
    { key: "number", label: "bKash receiving number configured in Admin → Payments", passed: !!receivingNumber },
    { key: "policies", label: "Four policies published in both languages", passed: policies },
    { key: "catalogue", label: "Real catalogue with downloadable files", passed: realCatalogue },
    { key: "enabled", label: "Manual bKash checkout enabled in Admin → Payments", passed: checkout.bkashEnabled },
  ];
  return { ready: gates.every((gate) => gate.passed), gates };
}
