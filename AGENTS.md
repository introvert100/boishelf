# Repository Guidelines

## Project Layout

BoiShelf is a Next.js 16/TypeScript ebook store.

- `src/app/`: pages, API routes, and health checks.
- `src/components/`: catalogue, auth, checkout, library, and admin UI.
- `src/lib/`: server-only auth, database, storage, payments, and validation.
- `supabase/migrations/`: append-only schema and RLS migrations.
- `tests/`: unit, security, database, and Playwright browser tests.
- `public/`, `scripts/`, `docs/`: assets, utilities, and deployment documentation.

## Development Commands

Use Node 24 and `npm ci`.

- `npm run dev`: start development.
- `npm run typecheck`: run strict TypeScript checks.
- `npm test`: run unit, security, and database tests.
- `npm run db:test`: run database/RLS tests.
- `npm run test:e2e`: run Playwright desktop/mobile flows.
- `npm run build` / `npm start`: build and serve production output.
- `npm run check`: typecheck, test, and build.
- `npm run validate:render`: validate `render.yaml`.

## Coding, Testing, and Security

Use two-space indentation, strict TypeScript, small functions, PascalCase React components, camelCase variables/functions, and kebab-case routes. Preserve the accessible Bangla-first bilingual UI. Keep server-only code and secrets in `src/lib/`; never expose service-role keys or private storage paths.

Put security tests in `tests/security.test.ts`, RLS tests in `tests/database.test.ts`, and journeys in `tests/browser/store.spec.ts`. Keep ebook/cover buckets private, Gmail-only OTP enabled, and live payments disabled until launch gates pass. Copy `.env.example` to `.env.local`; never commit secrets. Apply database changes through new migrations and review RLS policies.

## Strict Debug Protocol

1. **Describe the failure.** Record route/action, exact message, timestamp, environment, account role, and reproduction steps. Separate symptoms from hypotheses.
2. **Reproduce first.** Capture browser console output, network status/response, Render logs, Supabase logs, and request IDs. Redact passwords, OTPs, API keys, private paths, payment details, and signed URLs.
3. **Trace the boundary.** Check, in order: UI state/validation; API request/response; auth/session; Supabase database/RLS; Storage; Brevo; SSLCOMMERZ; Render configuration/deployment.
4. **Make the smallest safe fix.** Never bypass auth, RLS, private buckets, origin checks, rate limits, or payment verification. Keep server-side validation and field-level errors. Use a new migration for schema changes.
5. **Verify and document.** Test the failure, success, unauthorized, refresh/retry, and relevant mobile paths. Run `npm run typecheck`, `npm test`, `npm run build`, and targeted E2E tests. Record root cause, files changed, evidence, remaining risk, and rollback steps.
6. **Escalate safely.** After repeated failed fixes, report the evidence and exact next diagnostic needed. Request screenshots only with secrets hidden and share public error/request IDs only.

## Commits and Pull Requests

Use short imperative subjects, such as `Add order reconciliation guard`. Pull requests should describe user-visible behavior, list validation commands, link issues, include UI screenshots when relevant, and call out migration, environment, payment, or security impact.
