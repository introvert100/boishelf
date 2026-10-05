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
