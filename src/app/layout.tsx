import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Shell } from "@/components/store";
import { viewer } from "@/lib/auth";
import { hasSupabase, paymentMode } from "@/lib/config";
import "./globals.css";
// Fontsource packages provide local font files; no browser request to Google Fonts.
export const metadata: Metadata = {
  title: {
    default: "BoiShelf — আপনার পরের প্রিয় বই",
    template: "%s · BoiShelf",
  },
  description:
    "বাংলা ও ইংরেজি ইবুকের ছোট্ট একটি জগৎ। Discover PDF and EPUB ebooks on BoiShelf.",
  icons: { icon: "/favicon.svg" },
};
export const dynamic = "force-dynamic";
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await cookies()).get("locale")?.value === "en" ? "en" : "bn";
  return (
    <html lang={locale}>
      <body>
        <Shell
          initialLocale={locale}
          viewer={await viewer()}
          configured={hasSupabase()}
          sandbox={paymentMode() === "sandbox"}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
