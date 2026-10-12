# Deploy BoiShelf with manual bKash checkout

## 1. Apply the database migration

Back up the Supabase project. Apply every unapplied file in `supabase/migrations/` in filename order. Existing installations need `20261012000000_manual_bkash.sql` after the previous migrations. In Supabase SQL Editor, paste that file and run it once. The migration preserves historical sandbox orders and adds RLS-protected manual-claims and transaction-reservation tables plus service-only functions. Do not rerun the initial schema or mix SQL Editor and CLI migration history blindly.

Verify that `public.manual_payment_claims` and `public.manual_payment_references` exist with RLS enabled, and the `ebooks` and `covers` buckets remain private. Run `npm run db:test` locally before deploying.

## 2. Configure existing services

Keep the existing Supabase URL, publishable key, server secret, Gmail OTP/Brevo SMTP, Turnstile, `ADMIN_EMAIL`, app URL, support email and monitor token settings. Use the Render Blueprint in `render.yaml` for the web service. Its new bKash flags are **false by default**. Remove old `PAYMENT_MODE`, `SSLCOMMERZ_*`, `LIVE_PAYMENTS_*`, `MERCHANT_APPROVED` and `PAID_HOSTING_CONFIRMED` variables from Render after the new release is live.

Use a bKash **Personal Retail or Merchant** account for receiving customer payments. bKash says its [personal app is for personal use](https://www.bkash.com/en/page/terms-of-use-bkash-app), while its [Personal Retail Account](https://www.bkash.com/en/page/personal-retail-account) can receive customer payments without this store calling a payment API. Do not put a personal receiving number into checkout.

In Render, set `BKASH_RECEIVE_NUMBER` to the eligible 11-digit number. Confirm its exact payment method with bKash and test it yourself. Publish real, non-sample books with PDF/EPUB files and your final Privacy, Terms, Refund and Copyright policies in Bangla and English. Then set `BKASH_BUSINESS_ACCOUNT_CONFIRMED=true` and `MANUAL_BKASH_ENABLED=true` in the Blueprint and redeploy. Keep these flags false until every check is complete; a value in Render may be reset on Blueprint sync if `render.yaml` still says false.

## 3. Verify the live flow

Check `/api/health` and the authenticated `/api/health/ready` monitor. Sign in with a Gmail code. Create one small real order: the site must show the exact BDT amount, receiving number and order reference. Pay in bKash, submit the transaction ID and sender-number last four digits. The order must remain **under review** and the download endpoint must deny access. Compare recipient, amount, transaction ID and reference in your bKash account; approve in `/admin` → **Orders**. Only then should PDF/EPUB appear in My Library and download successfully.

Also test a rejected claim and resubmission, duplicate transaction ID, a second customer, sign-out, mobile/keyboard use, and 200% zoom. Do not claim instant delivery: approval depends on you checking the transfer. Monitor the Admin queue and failed request IDs. The free Render service can sleep and has limited capacity; plan reliable hosting and backups before promising response times.

## Rollback

Set `MANUAL_BKASH_ENABLED=false` and redeploy to stop new orders. Keep order status and Admin review available for payments already sent. Never delete the migration or existing orders to roll back application code. Restore from a tested backup only if the database itself is damaged.
