# Read and Rich order operations

## Set the receiving number

Open `/admin` → **Payments**, enter your eligible 11-digit business bKash number and save. A success toast confirms the server saved it; refresh to check. This overrides the original Render number for new orders only. Pending and retried orders keep their original number: reconcile against that number and keep access to the previous account until those orders are resolved. Saving a number does not enable checkout or approve a payment. Use the payment switches and business/courier confirmations below the number form, then save. The availability status lists missing requirements. Policies, number, stock and delivery checks still apply. Saved controls take effect without a Render redeploy.

## Prepare bundle books

Open **Admin → Bundles**. It starts with **Ebooks only (PDF / EPUB)**: select 2–10 published books with ebook files, enter the bundle details/price, and save. Ebook bundles do not need printed stock or delivery fees. Choose **Printed only** for a printed bundle. Every book stays visible with its editions and any blocking reason. Use its setup button to add the missing edition or publish the book, then choose **Return to bundle**. Entries and selections survive switching sections or preparing another book. Stock is checked again at checkout; draft, archived and sample books cannot be sold in bundles. Delivery fees and the fulfillment queue live separately under **Printed & delivery**.

## Review an order

Open `/admin` → **Orders**. For every submitted claim, independently check the **receiving number, exact amount, bKash transaction ID, sender last four digits and order reference when present** against your bKash app or statement. A buyer-entered ID or screenshot is not payment proof. If the transfer matches, choose **Verified — approve**; this atomically marks the order paid and grants one live entitlement. If it does not match, enter a specific reason and reject the claim. The buyer sees that reason and can submit corrected details. Do not approve uncertain or duplicated transfers.

Customers can refresh `/orders/<id>` to see pending, under-review, rejected or paid status. The store does not receive automatic bKash callbacks or poll a payment API. It will never unlock a book solely because a transaction ID was entered. Ebook bundle approval unlocks each included title; printed-order approval marks payment paid but grants no ebook entitlement. Check the queue regularly and respond through your published support address when a payment is disputed.

## Delivery districts

Open **Admin → Printed & delivery → Delivery fees**. Initially only **Dhaka** is offered, at the previously saved Dhaka fee (50 BDT on a new installation). Pick a district, click **Add district**, enter its fee in BDT, then **Save delivery fees**. Enter 0 for free delivery. Remove a district and save to stop new orders there; removing all districts closes printed checkout. Buyers select only saved districts and see the full total before confirming. A changed fee requires them to refresh/review the updated total. Existing orders retain their fees, addresses, and totals; refunds and fulfillment continue normally.

## Printed orders and cash on delivery

New bundles contain printed books only or ebooks only. Combined offers cannot be purchased. Historical combined orders, if any, remain in the delivery queue with their original snapshots and payment/download rules so the owner can fulfill or refund them. Do not delete those records to remove the old offer type. Independently purchased ebook access remains valid after another order is refunded.

Open `/admin` → **Printed & delivery** to see the private address and saved item/price snapshot. Enter a delivery target for each order. Book a COD-capable courier manually, enter its name and tracking number, then mark the order shipped. The buyer sees progress in **My Orders**; no email or courier API is sent. Stock is reserved when ordered and remains reserved until dispatch or pre-dispatch cancellation. Dispatch consumes it. Cancel a pending order before dispatch to release stock; a paid bKash order cancelled before dispatch requires a manual refund. After a return, inspect the books and adjust on-hand stock with a recorded reason before selling them again.

Mark COD **paid only after** the courier delivers and you actually receive the cash. If a buyer says they sent bKash money before cancellation, reconcile it first. Returns and refunds need an explicit admin action; keep the courier and refund references in your own records. Do not put private addresses, PINs, OTPs, or signed download links into logs or support screenshots.

## Refunds and records

Refunds are manual. Check your published refund policy, send any approved refund through bKash, keep its reference, and record the outcome through a reviewed privileged database operation that marks the order refunded and revokes the matching entitlement. Do not alter the order before the money movement is confirmed. A previously downloaded ebook cannot be recalled. Preserve order and claim audit history for reconciliation; never put bKash PINs, OTPs, full payer numbers or private signed URLs in logs or support messages.

Historical SSLCOMMERZ sandbox orders remain labelled as legacy tests in Admin. They do not appear as live purchases or unlock commercial downloads. Old gateway routes are removed. If you discover a real unfinished gateway payment despite the stated sandbox-only history, stop checkout and reconcile it manually before relying on the new flow.

## Incidents and rollback

If review, stock, or downloads malfunction, turn off both switches in **Admin → Payments** and save. If Admin is unavailable, use the privileged SQL Editor: `update public.payment_settings set bkash_enabled=false,cod_enabled=false where id='default';`. Keep Admin and existing order pages running so claims and deliveries can be resolved. Capture the action, timestamp, request ID, network response and Render/Supabase logs with secrets hidden. Check the order, inventory events, database row, and private storage object before changing code. Re-run `npm run typecheck`, `npm test`, `npm run build` and relevant Playwright tests after a fix. Verify buyers cannot see others' addresses, approve a claim, or download before approval.

Use Supabase backups and a restore drill before public sales. Signed ebook links expire after 60 seconds, but a link already issued may remain usable until it expires even after sign-out. Changing the bKash receiving number affects new orders only; each existing order keeps its original receiving number.
