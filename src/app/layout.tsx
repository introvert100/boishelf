import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Shell } from "@/components/store";
import { viewer } from "@/lib/auth";
import { hasSupabase } from "@/lib/config";
import "./globals.css";
// Fontsource packages provide local font files; no browser request to Google Fonts.
export const metadata: Metadata = {
  title: {
    default: "Read and Rich — আপনার পরের প্রিয় বই",
    template: "%s · Read and Rich",
  },
  description:
    "বাংলা ও ইংরেজি ইবুক এবং ছাপা বই। Discover ebooks, printed books and bundles at Read and Rich.",
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
    <html lang={locale} data-scroll-behavior="smooth">
      <body>
        <Shell
          initialLocale={locale}
          viewer={await viewer()}
          configured={hasSupabase()}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
