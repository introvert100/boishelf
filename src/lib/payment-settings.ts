import "server-only";
import { bkashNumber, hasSupabase } from "./config";
import { serviceClient } from "./supabase";
import { resolvePaymentSettings } from "./payment-validation";

export async function paymentSettings() {
  if (!hasSupabase()) return resolvePaymentSettings(null, bkashNumber());
  const { data, error } = await serviceClient().from("payment_settings")
    .select("receiving_number").eq("id", "default").single();
  // Fail closed on a missing migration or a database failure; never silently
  // show an obsolete environment number after the owner has changed it.
  if (error) throw error;
  return resolvePaymentSettings(data.receiving_number, bkashNumber());
}
