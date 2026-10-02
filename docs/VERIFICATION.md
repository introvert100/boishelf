# Verification record — 2 October 2026

Completed locally:

- TypeScript check: passed.
- Production build: passed for all application and API routes.
- Security and PostgreSQL tests: **25 passed**. Includes schema execution, RLS, cross-customer isolation, protected writes, payment matching, repeated callbacks, risk review, sandbox/live isolation and rate limits.
- Desktop/mobile browser tests: **10 passed**. Covers language switching, catalogue filtering, book details, checkout sign-in, closed admin/download endpoints, CSRF, policy placeholders, missing pages and 200% enlargement.
- `render.yaml`: passed Render's current official JSON schema.
- npm dependency audit at installation: no known vulnerabilities reported.
- Desktop and mobile screenshots inspected. Final local previews are saved under ignored `.local/desktop.png` and `.local/mobile.png`.

Not verified or performed without account access:

- No GitHub remote repository has been created or pushed.
- No Render service or Supabase project has been provisioned; no public URL exists yet.
- Migration execution was tested in PGlite with Supabase-compatible fixtures, not against a hosted Supabase project.
- Google OAuth, Supabase storage upload/download, and SSLCOMMERZ sandbox/live network flows require account configuration and end-to-end validation.
- Owner account, merchant approval, real books, custom domain and final policies have not been supplied.
- Monitoring workflow and backups are documented/configured for future use but are not active in cloud accounts.

The implementation deliberately leaves real payments disabled. Follow DEPLOYMENT.md before treating the store as commercially launched.
