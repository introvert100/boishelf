# Read and Rich order operations

## Review an order

Open `/admin` → **Orders**. For every submitted claim, independently check the **receiving number, exact amount, bKash transaction ID, sender last four digits and order reference when present** against your bKash app or statement. A buyer-entered ID or screenshot is not payment proof. If the transfer matches, choose **Verified — approve**; this atomically marks the order paid and grants one live entitlement. If it does not match, enter a specific reason and reject the claim. The buyer sees that reason and can submit corrected details. Do not approve uncertain or duplicated transfers.

Customers can refresh `/orders/<id>` to see pending, under-review, rejected or paid status. The store does not receive automatic bKash callbacks or poll a payment API. It will never unlock a book solely because a transaction ID was entered. Ebook bundle approval unlocks each included title; printed-order approval marks payment paid but grants no ebook entitlement. Check the queue regularly and respond through your published support address when a payment is disputed.

## Printed orders and cash on delivery

Mixed bundles use the same delivery queue. Each saved order lists the purchased edition of every component. Reserve, dispatch, cancel, and restock only printed copies; ebook components have no physical stock. Approving bKash or confirming COD cash collection grants the ebook components in My Library. A paid cancellation revokes downloads from that order; completing its refund keeps them revoked. Full refunds after a return also revoke that order's ebook access. A separate earlier purchase is preserved. Already downloaded files cannot be recalled.

Open `/admin` → **Commerce** to see the private address and saved item/price snapshot. Enter a delivery target for each order. Book a COD-capable courier manually, enter its name and tracking number, then mark the order shipped. The buyer sees progress in **My Orders**; no email or courier API is sent. Stock is reserved when ordered and remains reserved until dispatch or pre-dispatch cancellation. Dispatch consumes it. Cancel a pending order before dispatch to release stock; a paid bKash order cancelled before dispatch requires a manual refund. After a return, inspect the books and adjust on-hand stock with a recorded reason before selling them again.

Mark COD **paid only after** the courier delivers and you actually receive the cash. If a buyer says they sent bKash money before cancellation, reconcile it first. Returns and refunds need an explicit admin action; keep the courier and refund references in your own records. Do not put private addresses, PINs, OTPs, or signed download links into logs or support screenshots.

## Refunds and records

Refunds are manual. Check your published refund policy, send any approved refund through bKash, keep its reference, and record the outcome through a reviewed privileged database operation that marks the order refunded and revokes the matching entitlement. Do not alter the order before the money movement is confirmed. A previously downloaded ebook cannot be recalled. Preserve order and claim audit history for reconciliation; never put bKash PINs, OTPs, full payer numbers or private signed URLs in logs or support messages.

Historical SSLCOMMERZ sandbox orders remain labelled as legacy tests in Admin. They do not appear as live purchases or unlock commercial downloads. Old gateway routes are removed. If you discover a real unfinished gateway payment despite the stated sandbox-only history, stop checkout and reconcile it manually before relying on the new flow.

## Incidents and rollback

If review, stock, or downloads malfunction, set `MANUAL_BKASH_ENABLED=false` and `COD_ENABLED=false` in both `render.yaml` and Render, then redeploy. Keep Admin and existing order pages running so claims and deliveries can be resolved. Capture the action, timestamp, request ID, network response and Render/Supabase logs with secrets hidden. Check the order, inventory events, database row, and private storage object before changing code. Re-run `npm run typecheck`, `npm test`, `npm run build` and relevant Playwright tests after a fix. Verify buyers cannot see others' addresses, approve a claim, or download before approval.

Use Supabase backups and a restore drill before public sales. Signed ebook links expire after 60 seconds, but a link already issued may remain usable until it expires even after sign-out. Changing the bKash receiving number affects new orders only; each existing order keeps its original receiving number.
