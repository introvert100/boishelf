# Deploy Read and Rich

## 1. Apply the database migration

Back up the Supabase project. Apply every unapplied file in `supabase/migrations/` in filename order. The existing store already has `20261013000000_read_and_rich_commerce.sql`; apply `20261017102902_mixed_bundles.sql` **before** deploying the navigation/mixed-bundle update. Paste its complete contents into Supabase SQL Editor and run once. It backfills existing bundle/order component formats, adds mixed bundles, and preserves historical orders and entitlements. No existing book or file is deleted. Do not rerun the initial schema or mix SQL Editor and CLI migration history blindly.

Verify RLS on `print_editions`, `bundles`, `bundle_members`, `order_items`, `order_item_members`, `order_shipping`, `fulfillment_events`, and `inventory_events`. The `ebooks` and `covers` buckets remain private. Run `npm run db:test` locally before deploying.

## 2. Configure existing services

Keep the existing Supabase URL, publishable key, server secret, Gmail OTP/Brevo SMTP, Turnstile, `ADMIN_EMAIL`, support email and monitor token settings. Use `render.yaml` for the existing `boishelf` web service; its internal service name remains unchanged. `MANUAL_BKASH_ENABLED`, `BKASH_BUSINESS_ACCOUNT_CONFIRMED`, `COD_ENABLED`, and `COD_COURIER_CONFIRMED` are **false by default**. Remove obsolete `PAYMENT_MODE`, `SSLCOMMERZ_*`, `LIVE_PAYMENTS_*`, `MERCHANT_APPROVED` and `PAID_HOSTING_CONFIRMED` variables after release.

Use a bKash **Personal Retail or Merchant** account for receiving customer payments. bKash says its [personal app is for personal use](https://www.bkash.com/en/page/terms-of-use-bkash-app), while its [Personal Retail Account](https://www.bkash.com/en/page/personal-retail-account) can receive customer payments without this store calling a payment API. Do not put a personal receiving number into checkout.

In Render, set `BKASH_RECEIVE_NUMBER` to the eligible 11-digit number. Confirm its exact payment method with bKash and test it yourself. Publish real books and your final Privacy, Terms, Refund, Copyright, and Shipping policies in Bangla and English. For printed sales, set Dhaka/outside-Dhaka fees, actual on-hand stock, and a COD-capable courier arrangement. Test a controlled COD delivery. Only then set `COD_COURIER_CONFIRMED=true` and `COD_ENABLED=true`. Separately, set `BKASH_BUSINESS_ACCOUNT_CONFIRMED=true` and `MANUAL_BKASH_ENABLED=true` only after a real transfer and review test. Change flags in **both** the Blueprint and Render; Blueprint sync may reset a dashboard-only value.

## 3. Connect readandrich.com

`render.yaml` adds the **root** `readandrich.com` to the existing service. In Render → service → Settings → Custom Domains, check it appears or add it there if the Blueprint has not synced. Root registration makes Render redirect `www` to the root.

**Check the domain's authoritative nameservers before editing DNS.** As of 14 October 2026 they are Namecheap (`dns1.registrar-servers.com` and `dns2.registrar-servers.com`), and the root A record resolves to Render's `216.24.57.1`. In Namecheap → Domain List → **Manage** → **Advanced DNS**, keep `A` host `@` → `216.24.57.1` and `CNAME` host `www` → `boishelf.onrender.com`; remove conflicting records and `AAAA` records. Render verifies the domain and redirects `www` to the root. Follow [Render's Namecheap DNS instructions](https://render.com/docs/configure-namecheap-dns). If authoritative nameservers are changed back to Cloudflare, edit DNS there instead: use `CNAME` `@` and `www` → `boishelf.onrender.com`, both **DNS only** until Render issues certificates, with Cloudflare SSL/TLS mode **Full**, following [Render's Cloudflare instructions](https://render.com/docs/configure-cloudflare-dns).

When HTTPS works, set Render `NEXT_PUBLIC_APP_URL=https://readandrich.com` under **Environment** and redeploy. A 403 from a same-origin checkout request indicates this value is still the old address. In Supabase → Authentication → URL Configuration, set Site URL to `https://readandrich.com` and add any exact production callback/redirect URL used by the email template or app; retain the old Render URL temporarily during transition. In Cloudflare Turnstile, add `readandrich.com` and `www.readandrich.com` to allowed hostnames and retain the Render hostname during transition. Change the Supabase email-template subject/body to **Read and Rich** while keeping `{{ .Token }}`. Test a Gmail code end to end. See [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) and [Turnstile hostnames](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/).

## 4. Verify the live flow

Check `/api/health` and the authenticated `/api/health/ready` monitor. Sign in with a Gmail code. Create one small real order: the site must show the exact BDT amount, receiving number and order reference. Pay in bKash, submit the transaction ID and sender-number last four digits. The order must remain **under review** and the download endpoint must deny access. Compare recipient, amount, transaction ID and reference in your bKash account; approve in `/admin` → **Orders**. Only then should PDF/EPUB appear in My Library and download successfully.

Also test a rejected claim and resubmission, duplicate transaction ID, a second customer, sign-out, mobile/keyboard use, and 200% zoom. Do not claim instant delivery: approval depends on you checking the transfer. Monitor the Admin queue and failed request IDs. The free Render service can sleep and has limited capacity; plan reliable hosting and backups before promising response times.

Test a printed-only book, printed bundle, ebook bundle, and mixed bundle. Confirm cart totals for Dhaka and outside Dhaka, out-of-stock rejection, order retry, cancellation/restocking, COD collection, bKash approval, and ebook entitlements. Only printed components reserve stock. Mixed-bundle ebooks remain locked until payment approval or confirmed COD collection. Check customer address isolation, homepage landing after login, and library refresh. Run `npm run check`, `npm run validate:render`, `npm run test:e2e`, and `npm run test:e2e:ui`.

## Rollback

Set `COD_ENABLED=false` and `MANUAL_BKASH_ENABLED=false` in both the Blueprint and Render, then redeploy to stop new orders. Keep order status and Admin review available for existing orders. Before rolling back to code from before mixed bundles, unpublish mixed bundles and finish or reconcile their payments/fulfillment using the new code. Older code does not understand mixed orders. Preserve the migration, snapshots, and orders; restore a tested backup only if the database itself is damaged.
