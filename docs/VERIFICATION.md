# Verification record — 2 October 2026

Completed locally:

- TypeScript check: passed.
- Production build: passed for all application and API routes.
- Security and PostgreSQL tests: **27 passed**. Includes schema execution, Gmail/OTP auth hooks, password-session rejection, RLS, cross-customer isolation, protected writes, payment matching, repeated callbacks, risk review, sandbox/live isolation and rate limits.
- Desktop/mobile browser tests: **10 passed**. Covers language switching, catalogue filtering, book details, checkout sign-in, closed admin/download endpoints, CSRF, policy placeholders, missing pages and 200% enlargement.
- `render.yaml`: passed Render's current official JSON schema.
- npm dependency audit at installation: no known vulnerabilities reported.
- Desktop and mobile screenshots inspected. Final local previews are saved under ignored `.local/desktop.png` and `.local/mobile.png`.

Not verified or performed without account access:

- The source is pushed to `https://github.com/introvert100/boishelf`; cloud account setup remains outstanding.
- No Render service or Supabase project has been provisioned; no public URL exists yet.
- Migration execution was tested in PGlite with Supabase-compatible fixtures, not against a hosted Supabase project.
- Gmail OTP delivery through Brevo, Turnstile, Supabase storage upload/download, and SSLCOMMERZ sandbox/live network flows require account configuration and end-to-end validation.
- Owner account, merchant approval, real books, custom domain and final policies have not been supplied.
- Monitoring workflow and backups are documented/configured for future use but are not active in cloud accounts.

The implementation deliberately leaves real payments disabled. Follow DEPLOYMENT.md before treating the store as commercially launched.

## Admin editor update — 5 October 2026

The new book form now reports field-specific errors, keeps unfinished new-book entries in owner-scoped browser storage, and shows separate cover/PDF/EPUB upload controls with progress and status. Local checks: `npm run typecheck`, `npm test` (**31 passed**, including new validation/draft/upload checks), `npm run build`, and desktop/mobile Playwright (**10 passed**). Intermittent page-load timeouts in the browser suite were addressed by waiting for the document instead of all resources; the final complete run passed. Browser tests use the unconfigured sample mode, so an authenticated owner session and live Supabase Storage are still needed to confirm save, restore, upload, replacement, and publish on the deployed site. Roll back this change by restoring the previous application commit; browser drafts are local and have no database migration.

## Visual source inspection (7 October 2026)

The owner saw a one-page uploaded PDF and received the unclear error “Choose at most 0 preview pages.” The editor now offers a private PDF viewer with total pages, page navigation, and a button to save pages 1 through the selected page. A one-page paid PDF explains why no free preview is possible. EPUB books have an owner-only text chapter reader and retain the separate sample-PDF workflow. No migration or new public file access is needed. Local validation: TypeScript, **41 unit/database/security tests**, production build, **10 desktop/mobile browser tests**, and a synthetic EPUB opened in Chromium with scripted content removed from the text view. The new source endpoint rejects anonymous requests. The authenticated owner flow and actual uploaded files still need a live check; roll back the app commit if it fails, leaving the database unchanged.

## Preview and deletion release — 5 October 2026

Local verification: `npm run typecheck`, `npm test` (**41 passed**), production build, and desktop/mobile Playwright (**10 passed**). Database tests execute the new migration, verify RLS/service-only preview metadata, atomic paid PDF/excerpt replacement, archive visibility with buyer entitlement retention, and unsold deletion with cleanup jobs. PDF tests verify first-page-only extraction, later-page exclusion, one-page/over-limit rejection, and corrupt-file rejection. A 24 MB synthetic PDF with 80 pages generated a 79-page excerpt under a 384 MB Node heap limit and showed 173 MB RSS at completion; scanned real PDFs may use much more. Browser tests verify new admin endpoints reject anonymous callers; catalogue/mobile/200% zoom flows still pass in unconfigured mode. The largest real owner PDF, hosted Storage paths/signed URLs, authenticated admin dialogs/toasts, and Render 512 MB memory behavior still require a migration-first pilot test with account access. Rollback is the previous app deploy; keep the append-only migration in place. If the earlier stream error returns, record route, timestamp, network response, request ID, and Render memory/log context before changing code.

A desktop browser run exposed a language-button click before hydration (the page stayed in Bangla). The button now waits until the client is interactive; the rebuilt desktop/mobile suite passed 10/10. `render.yaml` passed Render's current official schema using Node's system certificate store.
