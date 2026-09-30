import type { Metadata, Viewport } from "next";
import { Caveat, Geist, Geist_Mono, Quicksand } from "next/font/google";
import { BRAND, TOKEN_HEX } from "@/lib/brand";
import { SITE } from "@/lib/content";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// The public site's text face: rounded and friendly, everywhere on the public
// pages except the handwritten title.
const quicksand = Quicksand({
  variable: "--font-quicksand-face",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
// The hand: the landing page's title and the scribbles on its sticky notes.
const hand = Caveat({
  variable: "--font-hand-face",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.company.siteUrl),
  title: {
    default: `${BRAND.name} — ${SITE.company.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: SITE.company.description,
  openGraph: { siteName: BRAND.name, type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Do not block pinch-zoom; capping it fails WCAG 1.4.4.
  themeColor: TOKEN_HEX.paper,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      // next-themes writes the class before paint; suppress the expected
      // server/client attribute mismatch on <html> only.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${hand.variable} ${quicksand.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
