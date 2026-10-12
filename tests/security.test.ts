import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isGmailUser,
  hasEmailOtpClaim,
  safeReturnTo,
} from "../src/lib/security";
import { detectUpload } from "../src/lib/admin-validation";
import { signedResumableEndpoint, signedUploadHeaders } from "../src/lib/signed-upload";
import { pdfFrameSources } from "../src/lib/pdf-frame-sources";
import type { User } from "@supabase/supabase-js";
const user = {
  id: "reader",
  aud: "authenticated",
  created_at: "2026-01-01",
  user_metadata: {},
  email: "reader@gmail.com",
  email_confirmed_at: "2026-01-01",
  app_metadata: { provider: "email" },
} as User;
test("signed ebook uploads use Supabase's signed TUS route and public API key", () => {
  assert.equal(
    signedResumableEndpoint("https://example.supabase.co"),
    "https://example.storage.supabase.co/storage/v1/upload/resumable/sign",
  );
  assert.equal(
    signedResumableEndpoint("http://127.0.0.1:54321"),
    "http://127.0.0.1:54321/storage/v1/upload/resumable/sign",
  );
  assert.equal(
    signedResumableEndpoint("https://example.storage.supabase.co"),
    "https://example.storage.supabase.co/storage/v1/upload/resumable/sign",
  );
  assert.deepEqual(signedUploadHeaders("public-key", "signed-token"), {
    apikey: "public-key",
    "x-signature": "signed-token",
  });
});
test("PDF frames allow only the configured Supabase project and Turnstile", () => {
  assert.equal(pdfFrameSources(), "https://challenges.cloudflare.com");
  assert.equal(pdfFrameSources("https://example.supabase.co"),
    "https://challenges.cloudflare.com https://example.supabase.co https://example.storage.supabase.co");
  assert.equal(pdfFrameSources("http://127.0.0.1:54321"),
    "https://challenges.cloudflare.com http://127.0.0.1:54321");
});
test("only confirmed Gmail addresses are accepted", () => {
  assert.equal(isGmailUser(user), true);
  assert.equal(isGmailUser({ ...user, email: "reader@company.com" }), false);
  assert.equal(isGmailUser({ ...user, email_confirmed_at: undefined }), false);
  assert.equal(isGmailUser(null), false);
});
test("protected sessions require an email OTP authentication method", () => {
  assert.equal(hasEmailOtpClaim({ amr: [{ method: "otp" }] }), true);
  assert.equal(hasEmailOtpClaim({ amr: ["otp"] }), true);
  assert.equal(hasEmailOtpClaim({ amr: [{ method: "password" }] }), false);
  assert.equal(hasEmailOtpClaim({ amr: [{ method: "oauth" }] }), false);
  assert.equal(hasEmailOtpClaim(null), false);
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
