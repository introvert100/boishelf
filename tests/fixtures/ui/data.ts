import { demoBooks } from "../../../src/lib/demo";
import type { Bundle, Order, ReviewClaim } from "../../../src/lib/types";

export const fixtureUser = { id: "11111111-1111-4111-8111-111111111111", email: "fixture@gmail.com",
  email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {}, aud: "authenticated", created_at: "2026-01-01T00:00:00Z" };
export const books = [
  { ...demoBooks[0], title_en: "Ebook Only", title_bn: "শুধু ইবুক", is_demo: false, published: true,
    formats: ["PDF"], cover_path: null, print_price_paisa: null },
  { ...demoBooks[1], title_en: "Print Only", title_bn: "শুধু ছাপা", is_demo: false, published: true,
    formats: [], cover_path: null, print_price_paisa: 20000, print_on_hand: 3, print_reserved: 0 },
  { ...demoBooks[2], title_en: "Draft Book", title_bn: "খসড়া বই", is_demo: false, published: false,
    formats: [], cover_path: null, print_price_paisa: null },
  { ...demoBooks[3], title_en: "Both Editions", title_bn: "দুই সংস্করণ", is_demo: false, published: true,
    formats: ["PDF"], cover_path: null, print_price_paisa: 25000, print_on_hand: 4, print_reserved: 0 },
];
export const mixed: Bundle = { id: "22222222-2222-4222-8222-222222222222", slug: "mixed-pair", kind: "mixed",
  title_en: "Mixed Pair", title_bn: "মিশ্র জোড়া", description_en: "One ebook and one printed book.",
  description_bn: "একটি ইবুক ও একটি ছাপা বই।", price_paisa: 30000, published: true, archived_at: null,
  members: [{ ...books[0], bundle_format: "ebook" }, { ...books[1], bundle_format: "physical" }] };
export const printedPair: Bundle = { ...mixed, id: "23232323-2323-4232-8232-232323232323", slug: "printed-pair", kind: "physical",
  title_en: "Printed Pair", title_bn: "ছাপা জোড়া", description_en: "Two printed books at one price.",
  members: [{...books[1], bundle_format: "physical"}, {...books[3], bundle_format: "physical"}] };
export const ebookPair: Bundle = { ...mixed, id: "24242424-2424-4242-8242-242424242424", slug: "ebook-pair", kind: "ebook",
  title_en: "Ebook Pair", title_bn: "ইবুক জোড়া", description_en: "Two ebooks at one price.",
  members: [{...books[0], bundle_format: "ebook"}, {...books[3], bundle_format: "ebook"}] };

export const pendingOrder: Order = { id: "45454545-4545-4454-8454-454545454545", user_id: fixtureUser.id,
  book_id: books[0].id, book_title: "Ebook Pair", amount_paisa: 30000, mode: "live",
  order_kind: "ebook_bundle", payment_method: "bkash_manual", manual_receive_number: "01712345678",
  status: "pending", tran_id: "RR-FIXTURE", created_at: "2026-10-20T10:00:00Z" };
export const submittedClaim: ReviewClaim = { id: "56565656-5656-4565-8565-565656565656",
  order_id: pendingOrder.id, transaction_id: "FIXTURE123", sender_last4: "1234", status: "submitted",
  rejection_reason: null, submitted_at: "2026-10-20T10:01:00Z", decided_at: null,
  order: { ...pendingOrder, status: "review" }, customerEmail: "customer@gmail.com" };
