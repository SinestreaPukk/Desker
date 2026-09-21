import Link from "next/link";
import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SITE } from "@/lib/content";

/**
 * The public shell: what a stranger sees. Same tokens and components as the
 * product, so the first impression matches the tool.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <a
        href="#site-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-3 focus:py-2 focus:shadow-md"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight text-ink">
            <BrandMark />
            {SITE.company.name}
          </Link>
          <nav aria-label="Site" className="hidden items-center gap-6 md:flex">
            {SITE.nav.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-ink-muted transition-colors hover:text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="site-main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight text-ink">
              <BrandMark />
              {SITE.company.name}
            </Link>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted">{SITE.footer.blurb}</p>
            <p className="mt-3 text-sm text-ink-subtle">
              {SITE.company.location} ·{" "}
              <a href={`mailto:${SITE.company.email}`} className="hover:text-ink">
                {SITE.company.email}
              </a>
            </p>
          </div>
          {SITE.footer.columns.map((column) => (
            <div key={column.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{column.heading}</h2>
              <ul className="mt-3 space-y-2">
                {column.links.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-ink-muted hover:text-ink">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-ink-subtle sm:px-6">
            {SITE.footer.legal.replace("{year}", String(year)).replace("{company}", SITE.company.legalName)}
          </p>
        </div>
      </footer>
    </div>
  );
}
