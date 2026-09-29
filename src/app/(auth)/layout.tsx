import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { BrandMark } from "@/components/brand-logo";
import { SITE } from "@/lib/content";
import { SoftNotes } from "@/components/marketing/desk-notes";

/**
 * The last step of the walk in from the landing page.
 *
 * It stands on the same desk as the public site - soft notes behind, the form
 * on a note, a handwritten title - and it keeps the way back out: someone who clicked
 * "Get started" to see what this costs should not have to use the browser's
 * back button to read the pricing.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-site data-auth className="relative flex min-h-dvh flex-col overflow-hidden bg-paper font-site">
      <SoftNotes preset="header" />
      <header className="relative flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-ink"
        >
          <BrandMark />
          {BRAND.name}
        </Link>
        <nav aria-label="Site" className="flex items-center gap-5">
          {SITE.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden text-sm text-ink-muted transition-colors hover:text-ink sm:inline"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="relative px-4 py-6 text-center text-xs text-ink-muted sm:px-6">
        <Link href="/terms" className="hover:text-ink">Terms</Link>
        <span className="px-2" aria-hidden>·</span>
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        <span className="px-2" aria-hidden>·</span>
        <Link href="/contact" className="hover:text-ink">Contact</Link>
      </footer>
    </div>
  );
}
