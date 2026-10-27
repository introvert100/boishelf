import { z } from "zod";
import type { CheckoutControls } from "./checkout-controls";

export const paymentSettingsInput = z.object({
  receivingNumber: z.string().trim().regex(/^01[3-9]\d{8}$/,
    "Enter an 11-digit Bangladesh bKash receiving number, for example 01712345678."),
});

export type PaymentSettings = { receivingNumber: string | null; source: "admin" | "environment" | "unset"; checkout?: CheckoutControls };

export function resolvePaymentSettings(saved: string | null, environment: string | null): PaymentSettings {
  if (saved !== null) {
    return { receivingNumber: paymentSettingsInput.parse({ receivingNumber: saved }).receivingNumber, source: "admin" };
  }
  return { receivingNumber: environment, source: environment ? "environment" : "unset" };
}
