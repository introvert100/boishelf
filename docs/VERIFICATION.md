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

## Free-tier file limit and cover loading — 7 October 2026

The owner reported that a 239 KB JPG showed a blank crop and that Supabase rejected a PDF upload. The JPG itself was not available for inspection. Code review found the crop loader could be restarted when its translation function changed, revoking the image URL while loading; it now reads the selected file once through `FileReader` and checks its image signature before opening the editor. A truly unreadable or mislabeled image gets a specific recovery message. The initial migration also set both the private `ebooks` bucket and `book_formats.size_bytes` constraint to 30 MB. The new append-only migration raises both to 50 MB, the maximum permitted by Supabase Free; it does not make 100 MB files possible on the current plan. The start endpoint checks the bucket limit before transfer so an unapplied migration produces a clear message. Separate sample PDFs remain at 30 MB.

Validation: `npm run typecheck`, `npm test`, production build, desktop/mobile Playwright, and browser decoding of a generated JPG. The actual owner JPG/PDF and hosted Supabase settings still need a live authenticated test after applying the migration. If the crop still fails, obtain the original image with private data removed or a browser console error; if PDF upload fails, capture its Storage code/HTTP status and time. Roll back the app commit if needed; the larger check constraint and private bucket limit are backward compatible with the previous app.

## Ebook upload and cover crop — 7 October 2026

The owner reported a PDF upload failure with a generic message. The available Render log only contained `upload_failed` and a request ID; it did not include the Storage/database error, and its ID differed from the screenshot. The exact hosted cause therefore remains unconfirmed. Code inspection found that the old ebook endpoint buffered the entire 30 MB request on Render and hid the failing stage. PDF/EPUB transfers now use signed resumable chunks directly to private Supabase Storage, then an owner-only finalize step validates the bytes and saves the book record. Transient finalize errors retry; success appears only after finalization. Upload failures log a safe stage/status/code and return a request ID. The cover control now opens a draggable, keyboard-operable crop window, shows a catalogue-size preview, and uploads only the selected 800 × 1130 JPEG.

Local evidence: `npm run check` passed (43 unit/database/security tests and production build); `npm run test:e2e` passed 10 desktop/mobile tests, including anonymous denial for both new upload routes. A separate Chromium pixel check rendered four PNG images (wide left/right and tall top/bottom) and verified the selected crop pixels; screenshots were inspected in ignored `.local/cover-*.png`. The first browser suite had one intermittent mobile navigation timeout; the targeted test passed twice and the complete rerun passed 10/10. No migration or new environment variable is required. The owner's actual PDF, authenticated direct transfer, Supabase bucket limit/MIME settings, and Render memory during preview replacement still require a hosted check. Roll back to the previous Render app deploy if necessary; the existing database and active paid file paths remain compatible.
