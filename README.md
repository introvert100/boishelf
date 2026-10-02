# BoiShelf

A Bangla-first PDF/EPUB store, built with Next.js, Supabase and SSLCOMMERZ. Includes an English interface, private downloads, owner administration, sandbox checkout and a Render free-pilot configuration.

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. Without environment settings the app shows an explicitly labelled sample catalogue. It does **not** fake a login, payment or purchase. The admin area and downloads remain closed.

Copy `.env.example` to `.env.local` and follow [the deployment guide](docs/DEPLOYMENT.md) to connect the real services. No credentials belong in this repository.

## What is implemented

- Bangla/English storefront, search, category and price filters, book details and checkout.
- Passwordless Gmail codes with server-verified OTP sessions and Turnstile protection; no Google Cloud, password, phone, or guest checkout.
- Supabase PostgreSQL schema and RLS policies for customers, books, orders and entitlements.
- Private PDF/EPUB storage with purchase checks and 60-second signed download links.
- `/admin` for the explicitly configured owner: draft/publish books, upload cover/PDF/EPUB files, inspect orders and publish the owner's policy text.
- SSLCOMMERZ initiation, IPN/return handling, validation, pending-order reconciliation and atomic/idempotent fulfillment.
- Separate sandbox/live entitlements; real payments gated by launch settings and real content.
- Render Blueprint, GitHub CI, optional scheduled production health checks, and structured server error logs.

## Checks

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` runs pure security/payment tests and executes the actual SQL migrations against an isolated PostgreSQL-compatible PGlite instance, including real roles, RLS, stored procedures and transactional settlement. The database fixtures emulate Supabase's auth/storage schemas; they do not prove a hosted Supabase project's configuration. Browser checks use the unconfigured sample-catalogue mode; use a separate deployment for real email/SMTP/gateway acceptance tests.

## Launch status

Local implementation is complete enough to connect and validate the external services. A production build alone does not mean the store is ready to accept real money. The live checklist and account requirements are in [DEPLOYMENT.md](docs/DEPLOYMENT.md); operations, reconciliation, backups and rollback are in [OPERATIONS.md](docs/OPERATIONS.md).

Third-party live integration tests require your Supabase project, Brevo SMTP account, Cloudflare Turnstile site and SSLCOMMERZ sandbox merchant account. Public deployment additionally requires a GitHub repository connected to Render. Final policies and commercial books must come from the owner.
