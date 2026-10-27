import "server-only";
import { bkashNumber, hasSupabase } from "./config";
import { serviceClient } from "./supabase";
import { resolvePaymentSettings } from "./payment-validation";
import { closedCheckout } from "./checkout-controls";

export async function paymentSettings() {
  if (!hasSupabase()) return { ...resolvePaymentSettings(null, bkashNumber()), checkout: closedCheckout };
  const { data, error } = await serviceClient().from("payment_settings")
    .select("receiving_number,bkash_enabled,cod_enabled,business_confirmed,courier_confirmed").eq("id", "default").single();
  // Fail closed on a missing migration or a database failure; never silently
  // show an obsolete environment number after the owner has changed it.
  if (error) throw error;
  return { ...resolvePaymentSettings(data.receiving_number, bkashNumber()), checkout: {
    bkashEnabled: data.bkash_enabled === true,
    codEnabled: data.cod_enabled === true,
    businessConfirmed: data.business_confirmed ?? process.env.BKASH_BUSINESS_ACCOUNT_CONFIRMED === "true",
    courierConfirmed: data.courier_confirmed ?? process.env.COD_COURIER_CONFIRMED === "true",
  } };
}
