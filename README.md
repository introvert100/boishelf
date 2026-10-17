# Read and Rich

A Bangla-first bookstore for PDF/EPUB ebooks and printed books in Bangladesh. Ebooks use owner-verified bKash. Printed books use cash on delivery (COD) or owner-verified bKash. Neither a transaction ID nor an unverified COD order unlocks downloads.

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
- `/admin` for the explicitly configured owner: draft/publish books, upload cover/PDF/EPUB files, set public PDF previews, archive or delete books, inspect orders and publish the owner's policy text.
- Manual bKash orders, transaction-ID claims, owner review and atomic/idempotent fulfillment. A buyer's claim never unlocks a book by itself.
- Printed-book inventory, a cart with Bangladesh delivery address and zone fees, COD, manual courier tracking, and separate ebook/printed bundles. Stock is reserved atomically; order items and prices are snapshotted.
- Historical sandbox orders remain records, but only live entitlements unlock customer downloads.
- Render Blueprint, GitHub CI, optional scheduled production health checks, and structured server error logs.

## Add a book

Supabase Free cannot hold a single 100 MB ebook; its limit is 50 MB per file. Apply `supabase/migrations/20261007180000_ebook_limit_50mb.sql` before testing books over 30 MB. Separate sample PDFs remain limited to 30 MB.

Sign in with the Gmail address configured as `ADMIN_EMAIL`, then open `/admin` and choose **Add a book**. Enter both language versions, a lowercase URL slug such as `amar-boi`, and a price in BDT. The form points to any field that needs correction. Choose **Save as draft** before uploading files.

The saved book shows separate controls for a cover image (PNG/JPG/WebP, up to 5 MB), PDF (up to 50 MB), and EPUB (up to 50 MB). Choosing a cover opens a crop window. PDF/EPUB files upload directly to private Supabase Storage in resumable chunks; Read and Rich confirms the saved book record before reporting success. Set the private `ebooks` bucket file-size limit to at least 50 MB. Upload either PDF or EPUB for an ebook. For a printed edition, set its separate price and on-hand stock after saving the draft. A printed-only book needs no ebook file and may have an ebook price of 0. A real published book needs a cover. Then select **Published** and save again. A sample checkbox marks a book as non-purchasable; use **Create test PDF** only for an original test file. File replacement keeps the previous private object for rollback as described in [operations](docs/OPERATIONS.md).

Unfinished new-book details are saved only in this browser for the signed-in owner. After a refresh, choose **Restore draft** or **Discard draft**. Saving the book clears that browser draft.

After uploading a paid PDF, choose **Inspect PDF and choose preview** beside its filename. The private viewer shows the page count and lets you move through the PDF; choose the last free page and save. Visitors receive pages 1 through your choice, while the paid PDF's final page stays private. A one-page paid PDF cannot have a free preview. You can also enter a count in **Preview pages**; 0 disables it. For an EPUB-only book, choose **Read EPUB chapters** to inspect its text, then upload a separate sample PDF in the Preview section. You can upload the sample with 0 pages, inspect it, and select the pages to share. EPUB chapters have no fixed PDF page numbers, so an EPUB alone does not generate a public preview. The public book page opens only the generated PDF excerpt; the private ebook still requires a purchase. Success toasts appear after server-confirmed saves, uploads, preview changes and policy updates.

To remove a book, choose its trash button and read the confirmation. Books with any order move to **Archived** and disappear from the shop; existing buyers keep downloads. Restore an archived book as a draft from the **Archived** tab. Books without orders are permanently removed and their private files are queued for cleanup. If cleanup remains, use **Retry cleanup** in admin.

## Printed books and bundles

In `/admin` → **Print, bundles & delivery**, set Dhaka and outside-Dhaka delivery fees. Create a **Printed only** or **Ebooks only** bundle with at least two different books and one total price. All books in a bundle must use that one format. Every book remains visible; unavailable choices explain whether it needs publishing, an ebook file, or a printed edition. Printed bundles use normal stock and delivery checkout. Ebook bundles use verified bKash and unlock downloads after approval. Order contents, editions, and prices stay fixed when a bundle changes. Old combined offers cannot be sold; edit them to choose one format and select compatible books, or archive them. Publish your final Shipping policy in both languages alongside Privacy, Terms, Refund, and Copyright.

Successful Gmail sign-in always opens the storefront homepage. My Library remains available from the header. Page navigation shows a progress indicator and loading skeleton while the next route loads; links to sections on the same page scroll directly.

`npm run test:e2e:ui` runs desktop/mobile login, library, navigation, and single-format bundle journeys against an isolated fixture app with synthetic auth responses. It never sends real email or contacts the production database. `npm run test:e2e` runs the production-build storefront/security journeys.

For a printed order, enter its delivery target, courier, and tracking number in Commerce. Mark COD paid only after receiving the cash. Review bKash claims separately in **Orders**. Buyer status and tracking appear in **My Orders**; no courier API or order-update email is sent. Existing admin browser drafts, historical database identifiers, and order references remain unchanged by the rebrand.

## Checks

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` executes security and database tests against an isolated PGlite instance, including RLS and manual-approval settlement. These fixtures do not prove your hosted Supabase configuration. Browser checks use the unconfigured sample catalogue; a real bKash transfer must be tested separately after the business account is ready.

## Launch status

Checkout is disabled by default. Apply `supabase/migrations/20261013000000_read_and_rich_commerce.sql` **before** deploying the new app. Configure eligible payment and delivery arrangements, policies, fees, and real stock, then follow [DEPLOYMENT.md](docs/DEPLOYMENT.md). Manual order review, returns, refunds, and rollback are in [OPERATIONS.md](docs/OPERATIONS.md).

Live integration tests require your Supabase project, Brevo SMTP account, Cloudflare Turnstile site and eligible bKash business account. A displayed number does not verify a payment automatically. Customers wait for owner approval before downloading.
