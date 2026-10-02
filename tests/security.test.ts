import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isGmailUser,
  safeReturnTo,
  moneyToPaisa,
  isGatewayUrl,
} from "../src/lib/security";
import {
  validatePayment,
  canTakePayment,
  type LaunchSettings,
} from "../src/lib/payment-rules";
import { detectUpload } from "../src/lib/admin-validation";
import type { User } from "@supabase/supabase-js";
const user = {
  id: "reader",
  aud: "authenticated",
  created_at: "2026-01-01",
  user_metadata: {},
  email: "reader@gmail.com",
  email_confirmed_at: "2026-01-01",
  app_metadata: { provider: "google" },
  identities: [
    {
      id: "identity",
      identity_id: "identity",
      user_id: "reader",
      created_at: "2026-01-01",
      provider: "google",
      identity_data: { email: "reader@gmail.com", email_verified: true },
    },
  ],
} as User;
test("only confirmed Gmail Google identities are accepted", () => {
  assert.equal(isGmailUser(user), true);
  assert.equal(isGmailUser({ ...user, email: "reader@company.com" }), false);
  assert.equal(isGmailUser({ ...user, email_confirmed_at: undefined }), false);
  assert.equal(isGmailUser({ ...user, identities: [] }), false);
  assert.equal(
    isGmailUser({
      ...user,
      identities: [
        {
          ...user.identities![0],
          identity_data: { email: "attacker@gmail.com", email_verified: true },
        },
      ],
    }),
    false,
  );
  assert.equal(
    isGmailUser({
      ...user,
      identities: [
        {
          ...user.identities![0],
          identity_data: { email: user.email, email_verified: false },
        },
      ],
    }),
    false,
  );
  assert.equal(isGmailUser(null), false);
});
test("return paths cannot redirect to external domains", () => {
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/\r\nevil",
    null,
  ])
    assert.equal(safeReturnTo(value), "/library");
  assert.equal(
    safeReturnTo("/checkout/book?lang=en"),
    "/checkout/book?lang=en",
  );
});
test("currency parsing uses exact integer paisa", () => {
  assert.equal(moneyToPaisa("249.01"), 24901);
  for (const value of ["249.001", "1e3", "-20", "NaN", {}, "1,000"])
    assert.equal(moneyToPaisa(value), null);
});
const order = { tran_id: "BS-test", amount_paisa: 24900 };
const paid = {
  status: "VALID",
  tran_id: "BS-test",
  amount: "249.00",
  currency: "BDT",
  val_id: "validation-1",
  bank_tran_id: "bank-1",
  risk_level: "0",
  store_id: "merchant",
};
test("validated payments must match order, currency and identity", () => {
  assert.equal(validatePayment(order, paid, "merchant"), "paid");
  assert.equal(
    validatePayment(order, { ...paid, status: "VALIDATED" }, "merchant"),
    "paid",
  );
  for (const changes of [
    { amount: "249.01" },
    { currency: "USD" },
    { tran_id: "BS-other" },
    { store_id: "other" },
    { status: "FAILED" },
    { status: "CANCELLED" },
    { status: "PENDING" },
    { val_id: "" },
    { bank_tran_id: "" },
  ])
    assert.throws(() =>
      validatePayment(order, { ...paid, ...changes }, "merchant"),
    );
});
test("high or unknown gateway risk never unlocks downloads", () => {
  assert.equal(
    validatePayment(order, { ...paid, risk_level: "1" }, "merchant"),
    "review",
  );
  assert.equal(
    validatePayment(order, { ...paid, risk_level: undefined }, "merchant"),
    "review",
  );
});
test("checkout redirects are restricted to the correct provider environment", () => {
  assert.equal(
    isGatewayUrl("https://sandbox.sslcommerz.com/pay", "sandbox"),
    true,
  );
  for (const url of [
    "https://evil.test/pay",
    "https://sandbox.sslcommerz.com.evil.test",
    "http://sandbox.sslcommerz.com",
    "https://user@sandbox.sslcommerz.com",
    "https://securepay.sslcommerz.com/pay",
  ])
    assert.equal(isGatewayUrl(url, "sandbox"), false);
});
const live: LaunchSettings = {
  mode: "live",
  appUrl: "https://books.example.com",
  enabled: true,
  merchantApproved: true,
  paidHosting: true,
  tested: true,
  testMode: false,
  adminConfigured: true,
  credentials: true,
  policies: true,
  realCatalogue: true,
};
test("every live launch gate is required", () => {
  assert.equal(canTakePayment(live, false), true);
  for (const key of [
    "enabled",
    "merchantApproved",
    "paidHosting",
    "tested",
    "adminConfigured",
    "credentials",
    "policies",
    "realCatalogue",
  ] as const)
    assert.equal(canTakePayment({ ...live, [key]: false }, false), false, key);
  assert.equal(
    canTakePayment({ ...live, appUrl: "https://boishelf.onrender.com" }, false),
    false,
  );
  assert.equal(
    canTakePayment({ ...live, appUrl: "http://books.example.com" }, false),
    false,
  );
});
test("owner-only live test mode does not unlock checkout for customers", () => {
  const settings = { ...live, tested: false, testMode: true };
  assert.equal(canTakePayment(settings, true), true);
  assert.equal(canTakePayment(settings, false), false);
  assert.equal(canTakePayment({ ...settings, policies: false }, true), false);
  assert.equal(
    canTakePayment({ ...live, mode: "sandbox", enabled: false }, false),
    true,
  );
});
test("upload type checks reject disguised HTML and malformed ebooks", () => {
  assert.equal(
    detectUpload(new TextEncoder().encode("<html>evil</html>"), "cover"),
    null,
  );
  assert.equal(
    detectUpload(new TextEncoder().encode("%PDF-1.4\n"), "pdf"),
    "application/pdf",
  );
  assert.equal(detectUpload(new Uint8Array([0x50, 0x4b, 3, 4]), "epub"), null);
});
