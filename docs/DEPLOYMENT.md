# Deployment and launch

## 1. Supabase (free pilot)

Create a standard PostgreSQL Supabase project, preferably near Render's Singapore region. Do not select an experimental database engine. Keep pilot and commercial production in separate Supabase projects if possible; this makes sandbox isolation and rollback simpler.

Apply `supabase/migrations/20261002043706_initial_store.sql` through the Supabase CLI after authenticating and linking the project:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

Alternatively run the migration once in the project's SQL Editor for an initial empty project, then reconcile migration history before later CLI migrations. Do not rerun it against an existing schema or edit a migration already applied in production.

The migration creates eight RLS-protected public tables and two **private** storage buckets (`ebooks`, `covers`). Browser roles can read only published metadata and their own orders/entitlements. They cannot alter purchases, upload objects or read ebook paths. The server secret is used only in server-only modules.

Set `.env.local` or Render environment variables:

| Variable                               | Value                                                            |
| -------------------------------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Project URL                                                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable API key                                              |
| `SUPABASE_SECRET_KEY`                  | Secret API key (legacy service-role key also works)              |
| `NEXT_PUBLIC_APP_URL`                  | Exact app origin, no trailing path                               |
| `ADMIN_EMAIL`                          | Your exact verified Gmail address; blank disables administration |

The public key and project URL are intentionally public. Never expose the secret key through a `NEXT_PUBLIC_` variable.

## 2. Google-only sign-in

In Google Cloud, create a Web application OAuth client and configure its consent screen. Register the Supabase callback displayed in the project's Google provider settings, normally `https://PROJECT.supabase.co/auth/v1/callback`. Put the Google client ID and secret **in Supabase Auth's Google provider settings**, not in the browser or repository.

In Supabase Auth:

1. Enable Google and disable Email, Phone, anonymous sign-ins, manual identity linking, and all other providers. Disable email changes for the app's supported account flows; do not expose profile email updates.
2. Set Site URL to the app origin. Add the exact application callback `https://YOUR-APP/auth/callback` to the redirect allowlist (and `http://localhost:3000/auth/callback` for local development). The `next` query parameter carries only an app-relative return path.
3. Under Auth Hooks, enable **Before User Created** → PostgreSQL → `public.before_user_created_hook`. The hook rejects non-Gmail and non-Google registrations. The application independently verifies Google identity, confirmed email and Gmail domain on each protected request.
4. Use the Google consent screen's test-user list while in OAuth testing mode. Move the OAuth app to the appropriate published status before the public launch.
5. Sign in using `ADMIN_EMAIL`, then open `/admin`. No first-user promotion or client-editable role exists.

Local Supabase config includes the Gmail hook and disables email signup. Google local-stack settings require your own OAuth credentials; configure the Google provider if you choose to run the full local Supabase stack. Hosted Dashboard settings are separate from `supabase/config.toml` and must be configured explicitly.

## 3. SSLCOMMERZ sandbox

Create a sandbox merchant account through SSLCOMMERZ's developer portal. Set:

```dotenv
PAYMENT_MODE=sandbox
SSLCOMMERZ_SANDBOX_STORE_ID=your-test-store
SSLCOMMERZ_SANDBOX_STORE_PASSWORD=your-test-password
LIVE_PAYMENTS_ENABLED=false
```

The app supplies `/api/payments/ipn` and `/api/payments/return` URLs when starting checkout. They must be publicly reachable over HTTPS for gateway callbacks. A localhost checkout can show the hosted gateway, but its notifications cannot reach your local server without an approved HTTPS development tunnel. Test integrations on the Render pilot.

The gateway handles payment credentials; BoiShelf sends the authenticated email and customer-provided name, phone, address and city. Do not enter real card details in sandbox mode.

To seed original one-page demo ebooks after migration:

```sh
npm run seed:demo
```

The script uploads real PDF/EPUB sample files to private storage and inserts clearly marked sample books. It skips existing books, refuses live mode, and does not overwrite commercial content. If a seed is interrupted, its incomplete books remain drafts: finish their files and publication in `/admin`.

## 4. GitHub and Render

1. Create a **private** GitHub repository named `boishelf` under your account. Add it as this project's `origin` remote. Commit the source and lockfile, review the diff for secrets, and push `main`.
2. Enable branch protection on `main`: require review and the `Store checks / verify` check before merging.
3. Connect that repository to Render and create a Blueprint from `render.yaml`. Select the free service in Singapore. The Blueprint does not create a Render database; all durable state is in Supabase.
4. Enter the environment variables marked `sync: false`. For a catalogue-only preview, credentials can remain unconfigured, but real authentication/checkout require them. Use the assigned `https://NAME.onrender.com` origin for `NEXT_PUBLIC_APP_URL` and update Supabase's redirect settings to match.
5. Render runs `npm ci && npm run build`, starts on `0.0.0.0:$PORT`, and checks `/api/health`. `autoDeployTrigger: checksPass` waits for GitHub checks before deploying commits on `main`.
6. Confirm a live deploy, HTTP 200 health response, catalogue loading, Google login, and an actual SSLCOMMERZ sandbox purchase/download. Review Render logs for callback or download failures.

Render's free web service can spin down; its filesystem is ephemeral. Never store uploaded ebooks or authoritative records on Render disk. Supabase's free quotas and inactivity behavior also need review. Free service limits are suitable for this chosen pilot, not a reliability guarantee for paid customers.

Official references: [Render free services](https://render.com/docs/free), [Render Blueprints](https://render.com/docs/blueprint-spec), [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase auth hooks](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook), [SSLCOMMERZ integration](https://developer.sslcommerz.com/doc/v4/).

## 5. Real-payment launch gates

Before changing to `PAYMENT_MODE=live`:

- Upgrade Render to an always-on paid service. Change `plan: free` in `render.yaml` to the chosen paid plan so the Blueprint remains the source of truth. Budget for Supabase capacity, storage egress and backups; free plans have limits.
- Add a custom HTTPS domain in Render; set the app origin and Supabase callback allowlist to the same origin. DNS configuration depends on the domain you supply.
- Obtain merchant approval and set separate `SSLCOMMERZ_LIVE_STORE_ID` / `SSLCOMMERZ_LIVE_STORE_PASSWORD` secrets in Render. Provider fees are separate from hosting.
- Set the owner Gmail. Upload actual book files and cover artwork you have distribution rights to. Mark commercial books as non-demo; unpublish pilot samples.
- Publish your final Privacy, Terms, Refund and Copyright policy text in both languages using `/admin`. The app never invents these policies for you.
- Set `MERCHANT_APPROVED=true`, `PAID_HOSTING_CONFIRMED=true`, `LIVE_PAYMENTS_ENABLED=true` only after these facts are true. Add the live credential and launch flags to the Blueprint as appropriate before syncing it again, because the pilot Blueprint deliberately keeps live flags false.
- Set `LIVE_PAYMENT_TEST_MODE=true` and leave `LIVE_PAYMENT_TESTS_CONFIRMED=false`. This permits **only the configured owner** to test real checkout after all other gates pass. These are real charges; use your approved merchant test process.
- Test bKash, Nagad and card payments, return/IPN ordering, one-time fulfillment and downloads. Check failed/cancelled payments, delayed notifications and transaction references in the merchant dashboard.
- Only after successful live tests set `LIVE_PAYMENT_TESTS_CONFIRMED=true` and `LIVE_PAYMENT_TEST_MODE=false`. Check the Launch readiness tab before inviting customers.

The paid-hosting and merchant flags are owner attestations; the app cannot independently verify your billing subscription or merchant agreement. Gates also check actual published policy text, a real catalogue with files, configured keys, Gmail ownership and a custom HTTPS origin. A flag is not a substitute for external acceptance testing.

## 6. Acceptance checklist

- Google login works on mobile/desktop; non-Gmail/workspace Google accounts are rejected; sign-out and session expiry close access.
- Two different customers cannot read one another's orders or signed download links through the app.
- A paid customer downloads both PDF and EPUB; an unpaid customer cannot. Direct storage paths remain private.
- Amount/currency/transaction tampering is rejected, duplicate callbacks are harmless, and an unverified return page never unlocks a book.
- `review` payments remain blocked until the merchant resolves them with the provider; sandbox entitlements never unlock live downloads.
- Check Bangla/English, keyboard navigation, 200% zoom, mobile layout, checkout errors and policy publication.
- Test `/api/health/ready` using the monitor token and perform a database and storage restore drill before real sales.
