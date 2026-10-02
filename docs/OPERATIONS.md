# Operations

## Health and logs

`GET /api/health` is a public liveness endpoint suitable for Render. It does not reveal configuration or credentials.

`GET /api/health/ready` requires `Authorization: Bearer MONITOR_TOKEN`. It checks database access and the existence of both private storage buckets and returns 503 when dependencies are unavailable. Do not put the token in URL parameters.

Server errors are JSON logs with event names such as `checkout_failed`, `payment_callback_failed`, `payment_return_unconfirmed`, `payment_review_required`, `payment_failed`, `download_failed`, `upload_failed` and `readiness_failed`. Logs intentionally omit passwords, provider response bodies, payment card details and signed links. Unexpected API failures include a request ID customers can report.

For a paid-production deployment, set GitHub repository variables `PRODUCTION_MONITOR_ENABLED=true` and `STORE_URL=https://YOUR-DOMAIN`, and repository secret `MONITOR_TOKEN` matching Render. The included workflow checks dependencies every six hours and can be run manually. Enable GitHub Actions failure notifications for the owner. This is a basic periodic check, not real-time paging or an uptime SLA. Configure your chosen continuous uptime monitor when needed. Leave production monitoring disabled for the free pilot; do not use a monitor to defeat free-tier sleep rules.

## Pending and reviewed payments

Customers can select an order in My Library and use **Check payment status**. The order page also makes a bounded set of checks while pending. This queries SSLCOMMERZ with the server's credentials, validates the transaction again and applies the same atomic settlement as IPN. Closing the browser does not block fulfillment if IPN arrives successfully.

There is no autonomous reconciliation worker in the free pilot. Review pending/review orders in `/admin` and the SSLCOMMERZ merchant dashboard. A checkout interrupted before the gateway session is saved remains pending to avoid creating a duplicate charge; the customer can inspect its status and retry after the 30-minute pending-checkout reuse window. Late verified payments can still settle an older failed/cancelled order. Paid/refunded orders cannot be downgraded by later failure notifications.

High-risk gateway responses never grant access automatically. Resolve them through your merchant process, then obtain a fresh safe validation. Do not alter a failed or reviewed order to paid by hand.

Refunds are not automated in this release. Complete any eligible refund through SSLCOMMERZ, retain its reference, and use a privileged, reviewed database transaction to mark the corresponding order/attempt refunded and revoke its matching entitlement. An already downloaded ebook cannot be recalled. Do not claim DRM protection or promise that downloaded files cannot be shared.

## Files and backups

Supabase holds all records and files; Render restarts and deploys do not remove them. New uploads use unique object paths. Replacing a format keeps the previous object for rollback, so periodically review unused old files before removing any. Never delete objects while their paths remain referenced in `book_formats` or `books.cover_path`.

Before real sales, establish database backups and a **separate** Storage object backup. Database backups alone do not contain ebook bytes. Test restoration in an isolated project with matching storage paths and access policies. Review Supabase's current plan-specific backup/retention options and storage quotas; no backup job is provisioned automatically in this disconnected environment.

## Rollback

1. If payments or fulfillment are malfunctioning, set `LIVE_PAYMENTS_ENABLED=false`. Keep the callback routes running so already paid orders can still be validated and delivered.
2. In Render, roll back to the last known-good deploy. Disable automatic deployment temporarily if necessary. Retain the same secrets and Supabase project.
3. Database migrations are append-only after deployment. Never undo a schema change by deleting the migration or running `db reset` against production. Prefer a forward corrective migration compatible with the previous app version.
4. Recheck liveness, authenticated dependency readiness, one customer's order visibility and protected downloads. Reconcile pending payments before reopening checkout.

## Security administration

Keep Render, GitHub, Google and Supabase accounts protected with MFA. `ADMIN_EMAIL` is a server-side allowlist, not editable user metadata. To revoke owner access, clear/change that variable and redeploy. Google identity and confirmed Gmail are checked for admin and download requests on the server.

Rotate any exposed server or gateway credential in the provider dashboard immediately and update Render. The app stores provider secrets only in environment variables. Signed downloads expire after 60 seconds; session sign-out does not retroactively cancel a URL already issued during that window.

Pin dependencies and commit the lockfile. CI tests unconfigured/sample mode without production secrets. Run live OAuth and gateway acceptance checks separately with real account access before marking the launch complete.
