import { test } from "node:test";
import assert from "node:assert/strict";
import { paymentSettingsInput, resolvePaymentSettings } from "../src/lib/payment-validation";

test("receiving numbers are validated and normalized before saving", () => {
  assert.equal(paymentSettingsInput.parse({ receivingNumber: " 01712345678 " }).receivingNumber, "01712345678");
  for (const receivingNumber of ["", "01212345678", "0171234567", "+8801712345678", "017123456789", "01712abc678"])
    assert.equal(paymentSettingsInput.safeParse({ receivingNumber }).success, false);
});

test("saved admin number takes precedence; environment is bootstrap only", () => {
  assert.deepEqual(resolvePaymentSettings("01812345678", "01712345678"), { receivingNumber: "01812345678", source: "admin" });
  assert.deepEqual(resolvePaymentSettings(null, "01712345678"), { receivingNumber: "01712345678", source: "environment" });
  assert.deepEqual(resolvePaymentSettings(null, null), { receivingNumber: null, source: "unset" });
  assert.throws(() => resolvePaymentSettings("invalid", "01712345678"));
});
