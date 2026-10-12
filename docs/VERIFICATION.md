# Verification

Run `npm run typecheck`, `npm test`, `npm run build`, `npm run validate:render`, and `npm run test:e2e` (after installing Playwright Chromium). Database tests execute all migrations in PGlite and check RLS, order creation, claim isolation, duplicate transaction IDs, rejection, idempotent approval and entitlement creation. These tests do not verify the hosted Supabase project's settings or an actual bKash transfer.

Before enabling payments, test the deployed Gmail OTP flow, private storage, owner-only Admin review and one real bKash transfer using an eligible receiving account. Confirm that a submitted claim does **not** unlock a download, that only owner approval does, and that both PDF and EPUB links are short-lived. Check mobile layout, keyboard navigation, 200% zoom, health checks, Render logs, Supabase logs and rollback instructions. Existing sandbox orders must remain historical tests only.
