import "server-only";
import {
  appUrl,
  ownerEmail,
  paymentCredentials,
  paymentMode,
  hasSupabase,
} from "./config";
import { serviceClient } from "./supabase";
import {
  canTakePayment,
  type LaunchSettings,
  launchGates,
} from "./payment-rules";
import { policySlugs } from "./types";
export async function readiness(owner = false) {
  let credentials = false;
  try {
    paymentCredentials();
    credentials = true;
  } catch {}
  let policies = false,
    realCatalogue = false;
  if (hasSupabase()) {
    const db = serviceClient();
    const [{ data: p, error: pe }, { data: b, error: be }] = await Promise.all([
      db.from("policies").select("slug,body_bn,body_en").eq("published", true),
      db
        .from("books")
        .select("id,book_formats(id)")
        .eq("published", true)
        .eq("is_demo", false)
        .limit(100),
    ]);
    if (pe || be) throw pe || be;
    policies = policySlugs.every((slug) =>
      p?.some((x) => x.slug === slug && x.body_bn.trim() && x.body_en.trim()),
    );
    realCatalogue = !!b?.some((x) => x.book_formats.length > 0);
  }
  const settings: LaunchSettings = {
    mode: paymentMode(),
    appUrl: appUrl(),
    enabled: process.env.LIVE_PAYMENTS_ENABLED === "true",
    merchantApproved: process.env.MERCHANT_APPROVED === "true",
    paidHosting: process.env.PAID_HOSTING_CONFIRMED === "true",
    tested: process.env.LIVE_PAYMENT_TESTS_CONFIRMED === "true",
    testMode: process.env.LIVE_PAYMENT_TEST_MODE === "true",
    adminConfigured: /^[^@\s]+@gmail\.com$/.test(ownerEmail()),
    credentials,
    policies,
    realCatalogue,
  };
  return {
    ready: canTakePayment(settings, owner),
    gates: launchGates(settings),
    mode: settings.mode,
  };
}
