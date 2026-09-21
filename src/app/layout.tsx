import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { SITE } from "@/lib/content";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// The public site's display face. Declared here so the token resolves
// everywhere, but a browser only fetches it where a headline uses it.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz"],
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaff" },
    { media: "(prefers-color-scheme: dark)", color: "#141319" },
  ],
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
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
