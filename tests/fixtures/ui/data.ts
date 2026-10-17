import { demoBooks } from "../../../src/lib/demo";
import type { Bundle } from "../../../src/lib/types";

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
];
export const mixed: Bundle = { id: "22222222-2222-4222-8222-222222222222", slug: "mixed-pair", kind: "mixed",
  title_en: "Mixed Pair", title_bn: "মিশ্র জোড়া", description_en: "One ebook and one printed book.",
  description_bn: "একটি ইবুক ও একটি ছাপা বই।", price_paisa: 30000, published: true, archived_at: null,
  members: [{ ...books[0], bundle_format: "ebook" }, { ...books[1], bundle_format: "physical" }] };
