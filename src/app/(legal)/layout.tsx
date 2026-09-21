import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { BrandMark } from "@/components/brand-logo";

/** Public, plain, readable: the legal pages. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
          <BrandMark />
          {BRAND.name}
        </Link>
        <nav className="flex gap-4 text-sm text-ink-muted">
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6">
        <article className="space-y-6 text-[0.9375rem] leading-relaxed text-ink [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:text-ink-muted [&_li]:text-ink-muted [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </article>
      </main>
    </div>
  );
}
