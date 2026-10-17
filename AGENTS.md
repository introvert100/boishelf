# Repository Guidelines

## Project Layout

Read and Rich is a Next.js 16/TypeScript ebook and printed-book store. The existing Render service and database identifiers retain their old names.

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
- `npm run test:e2e:ui`: test login, library, navigation, and mixed bundles in an isolated fixture app.
- `npm run build` / `npm start`: build and serve production output.
- `npm run check`: typecheck, test, and build.
- `npm run validate:render`: validate `render.yaml`.

## Coding, Testing, and Security

Use two-space indentation, strict TypeScript, small functions, PascalCase React components, camelCase variables/functions, and kebab-case routes. Preserve the accessible Bangla-first bilingual UI. Keep server-only code and secrets in `src/lib/`; never expose service-role keys or private storage paths.

Put security tests in `tests/security.test.ts`, RLS tests in `tests/database.test.ts`, and journeys in `tests/browser/store.spec.ts`. Keep ebook/cover buckets private and Gmail-only OTP enabled. Keep bKash and COD disabled until their business/courier arrangements, policies, fees, and stock are ready. Never unlock on a transaction ID alone or mark COD paid before cash collection. Keep addresses service-only. Copy `.env.example` to `.env.local`; never commit secrets. Use new migrations and review RLS.

## Strict Debug Protocol

Bundles may contain ebooks, printed copies, or both. Snapshot each member's edition; reserve stock only for printed members and grant ebook access only after verified payment or COD cash collection. Keep synthetic browser fixtures outside the production app.

1. **Describe the failure.** Record route/action, exact message, timestamp, environment, account role, and reproduction steps. Separate symptoms from hypotheses.
2. **Reproduce first.** Capture browser console output, network status/response, Render logs, Supabase logs, and request IDs. Redact passwords, OTPs, API keys, private paths, payment details, and signed URLs.
3. **Trace the boundary.** Check, in order: UI state/validation; API request/response; auth/session; Supabase database/RLS, stock and order transactions; Storage; Brevo; bKash claim/review or COD fulfillment; Render configuration/deployment.
4. **Make the smallest safe fix.** Never bypass auth, RLS, private buckets, origin checks, rate limits, or payment verification. Keep server-side validation and field-level errors. Use a new migration for schema changes.
5. **Verify and document.** Test the failure, success, unauthorized, refresh/retry, and relevant mobile paths. Run `npm run typecheck`, `npm test`, `npm run build`, and targeted E2E tests. Record root cause, files changed, evidence, remaining risk, and rollback steps.
6. **Escalate safely.** After repeated failed fixes, report the evidence and exact next diagnostic needed. Request screenshots only with secrets hidden and share public error/request IDs only.

## Commits and Pull Requests

Use short imperative subjects, such as `Add order reconciliation guard`. Pull requests should describe user-visible behavior, list validation commands, link issues, include UI screenshots when relevant, and call out migration, environment, payment, or security impact.
