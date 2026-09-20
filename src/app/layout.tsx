import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description:
    "Build AI employees with a role, a personality, and your company's context, then put them in front of real clients.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
