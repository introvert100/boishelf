# Deployment and launch

## 1. Supabase (free pilot)

Create a standard PostgreSQL Supabase project, preferably near Render's Singapore region. Do not select an experimental database engine. Keep pilot and commercial production in separate Supabase projects if possible; this makes sandbox isolation and rollback simpler.

Apply all unapplied files in `supabase/migrations/` in filename order through the Supabase CLI after authenticating and linking the project:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

For an existing BoiShelf Supabase project, apply each migration that has **not** run yet in filename order. If the preview migration has already succeeded, run only `20261007180000_ebook_limit_50mb.sql` for this update. In the SQL Editor, paste that file into a new query and run it once. Do not rerun the initial schema. If using the CLI instead, reconcile migration history before `db push`; do not mix methods blindly.

The migrations create ten RLS-protected public tables and two **private** storage buckets (`ebooks`, `covers`). Browser roles can read only published metadata and their own orders/entitlements. Preview paths and cleanup jobs are service-only. They cannot alter purchases, upload objects or read ebook paths. The server secret is used only in server-only modules.

For admin uploads, open **Storage → ebooks → Bucket settings** and allow individual files up to 50 MB, with PDF and EPUB MIME types. The bucket stays private. Apply `20261007180000_ebook_limit_50mb.sql` to an existing Supabase project before uploading files over 30 MB. No new Render variable is needed.

Supabase Free has a hard 50 MB maximum per file; a 100 MB single-file upload requires a paid plan or a different storage design. The global Storage limit must also allow 50 MB. The app checks the ebooks bucket limit before transferring a paid file and gives the owner a precise message if the new migration has not run. Separate sample PDFs remain capped at 30 MB because they pass through the Render preview-processing route.

Set `.env.local` or Render environment variables:

| Variable                               | Value                                                            |
| -------------------------------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Project URL                                                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable API key                                              |
| `SUPABASE_SECRET_KEY`                  | Secret API key (legacy service-role key also works)              |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`       | Public Cloudflare Turnstile site key                             |
| `NEXT_PUBLIC_APP_URL`                  | Exact app origin, no trailing path                               |
| `ADMIN_EMAIL`                          | Your exact verified Gmail address; blank disables administration |

The public key and project URL are intentionally public. Never expose the secret key through a `NEXT_PUBLIC_` variable.

## 2. Card-free Gmail code sign-in

The store uses eight-digit email OTPs. Set **Email OTP length** to `8` in Supabase to match the sign-in form. It does not need Google Cloud, OAuth credentials, passwords or a credit card. Supabase's default mailer is limited to project-team addresses and is not suitable for customers, so configure Brevo SMTP before public testing.

1. Create a free account at `https://www.brevo.com/products/transactional-email/`. The free plan allows up to 300 messages daily. Complete Brevo's account and sender verification.
2. In Brevo open **Transactional → Settings → Configuration → SMTP & API**. Create an SMTP key and keep the SMTP server, port, login and key private.
3. In Supabase open **Project Settings → Authentication → SMTP Settings**. Enable custom SMTP and enter the Brevo values. Use the verified Brevo sender address and `BoiShelf` as the sender name.
4. In **Authentication → Email Templates**, set **Magic Link**, **Confirm signup**, and **Reset password** to a short template containing `{{ .Token }}` (for example, `<p>Your BoiShelf login code is: <strong>{{ .Token }}</strong></p>`). Do not include `{{ .ConfirmationURL }}`, because that produces a magic link instead of the eight-digit code.
5. In **Authentication → Sign In / Providers**, enable Email with confirmed email required. Disable Phone, Anonymous and every external provider. Do not add any password form, recovery flow or email-change UI.
6. In **Authentication → URL Configuration**, set Site URL to the exact Render origin. No OAuth callback URL is required.
7. In **Authentication → Hooks**, enable **Before User Created** → PostgreSQL → `public.before_user_created_hook`, then enable **Custom Access Token** → PostgreSQL → `public.gmail_otp_access_token_hook`. The first hook rejects non-Gmail registration; the second rejects password, OAuth, anonymous and recovery sessions.
8. Create a free Turnstile site at `https://dash.cloudflare.com/`. Add the Render hostname. Put the public site key in Render as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
9. In Supabase open **Authentication → Bot and Abuse Protection**, enable CAPTCHA, select Cloudflare Turnstile and enter the private Turnstile secret. Never put this secret in Render or the repository.
10. Sign in with `ADMIN_EMAIL`, enter the emailed code, then open `/admin`. No first-user promotion or client-editable role exists.

Local Supabase configuration enables confirmed email OTP, both database hooks and Mailpit for test messages. Hosted Dashboard settings remain separate and must be configured explicitly.

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
6. Confirm a live deploy, HTTP 200 health response, Gmail code delivery and login, and an actual SSLCOMMERZ sandbox purchase/download. Review Render logs for authentication, callback or download failures.

For this preview/delete release, confirm the new migration is present **before** Render deploys new code. In `/admin`, test a multi-page PDF preview, an EPUB-only sample PDF, preview off, a rejected one-page paid PDF preview, a draft deletion, and archive/restore of a book with an order. Verify the archived buyer can still download and that an anonymous visitor cannot reach the full ebook. The free Render instance has 512 MB RAM: test your own largest PDF on the pilot and inspect memory/logs before relying on bulk preview generation.

Render's free web service can spin down; its filesystem is ephemeral. Never store uploaded ebooks or authoritative records on Render disk. Supabase's free quotas and inactivity behavior also need review. Free service limits are suitable for this chosen pilot, not a reliability guarantee for paid customers.

Official references: [Render free services](https://render.com/docs/free), [Render Blueprints](https://render.com/docs/blueprint-spec), [Supabase email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha), [Brevo free transactional email](https://www.brevo.com/products/transactional-email/), [SSLCOMMERZ integration](https://developer.sslcommerz.com/doc/v4/).

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

- Gmail code login works on mobile/desktop; non-Gmail, password and non-OTP sessions are rejected; expired/incorrect codes fail; sign-out and session expiry close access.
- Two different customers cannot read one another's orders or signed download links through the app.
- A paid customer downloads both PDF and EPUB; an unpaid customer cannot. Direct storage paths remain private.
- Amount/currency/transaction tampering is rejected, duplicate callbacks are harmless, and an unverified return page never unlocks a book.
- `review` payments remain blocked until the merchant resolves them with the provider; sandbox entitlements never unlock live downloads.
- Check Bangla/English, keyboard navigation, 200% zoom, mobile layout, checkout errors and policy publication.
- Test `/api/health/ready` using the monitor token and perform a database and storage restore drill before real sales.
