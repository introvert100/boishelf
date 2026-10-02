# Repository Guidelines

## Project Structure

This is a Next.js 16 application using TypeScript, Supabase, and SSLCOMMERZ sandbox checkout.

- `src/app/` contains routes, pages, API handlers, and the health endpoints.
- `src/components/` contains client-facing catalogue, checkout, library, and admin UI.
- `src/lib/` contains server-only authentication, database, payment, validation, and configuration logic.
- `supabase/migrations/` contains append-only database schema and RLS migrations.
- `tests/` contains Node security/database tests and Playwright browser tests.
- `public/` contains static assets; `scripts/` contains local startup, seeding, validation, and inspection utilities.
- `docs/` documents deployment and operations; `.github/workflows/` defines CI and optional monitoring.

## Build, Test, and Development Commands

Use Node 24 (the required engine) and install with `npm ci`.

- `npm run dev` starts the local development server.
- `npm run typecheck` runs the TypeScript compiler without emitting files.
- `npm test` runs unit, security, and database tests.
- `npm run db:test` runs the database/RLS test suite alone.
- `npm run test:e2e` runs the Playwright desktop and mobile flows.
- `npm run build` creates the production build; `npm start` serves it.
- `npm run check` runs type checking, tests, and the production build.
- `npm run validate:render` validates `render.yaml` against Render’s schema.

## Coding Style and Naming

Use two-space indentation, strict TypeScript, and clear small functions. Keep server-only code in `src/lib/` and do not expose service-role keys or private storage paths to the browser. Use PascalCase for React components, camelCase for functions and variables, and kebab-case for route segments. Preserve the bilingual Bangla-first UI and use the existing formatting/style conventions when editing CSS.

## Testing Guidelines

Add security-sensitive behavior to `tests/security.test.ts` and database/RLS behavior to `tests/database.test.ts`. Add user journeys to `tests/browser/store.spec.ts`. Test both authenticated and unauthorized paths, and run `npm run check` plus `npm run test:e2e` before a pull request.

## Security and Configuration

Copy `.env.example` to `.env.local`; never commit secrets. Keep ebook and cover buckets private, require Gmail-only authentication, and leave live payments disabled until all documented launch gates pass. Apply schema changes through new Supabase migrations and review RLS policies with every data-model change.

## Commits and Pull Requests

Use short imperative commit subjects (for example, `Add order reconciliation guard`). Pull requests should explain the user-visible change, list validation commands, link related issues, and include screenshots for UI changes. Call out migration, environment-variable, payment, or security impacts explicitly.
