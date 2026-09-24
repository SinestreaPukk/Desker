import Link from "next/link";
import { BrandMark } from "@/components/brand-logo";
import { SITE, TEMPLATES } from "@/lib/content";
import { GLASS_BUTTON_SM } from "@/components/marketing/glass-button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteMenu, SiteNav } from "@/components/marketing/site-nav";

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
      <SiteHeader>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="focus-current inline-flex min-h-[44px] items-center gap-2 text-lg font-semibold tracking-tight text-current">
            <BrandMark className="[[data-clear]_&]:bg-current" />
            {SITE.company.name}
          </Link>
          <SiteNav items={SITE.nav} />
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Full strength, not /75: on the sky the dimmed white fell under 4.5:1. */}
            <Link
              href="/login"
              className="focus-current hidden min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-current underline-offset-4 hover:underline md:inline-flex"
            >
              Sign in
            </Link>
            <Link href={SITE.navCta.href} className={GLASS_BUTTON_SM}>
              {SITE.navCta.label}
            </Link>
            <SiteMenu items={SITE.nav} signIn={{ label: "Sign in", href: "/login" }} />
          </div>
        </div>
      </SiteHeader>

      <main id="site-main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
              <BrandMark />
              {SITE.company.name}
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">{SITE.footer.blurb}</p>
            <p className="mt-3 text-sm text-ink-muted">
              {SITE.company.location} ·{" "}
              <a href={`mailto:${SITE.company.email}`} className="hover:text-ink">
                {SITE.company.email}
              </a>
            </p>
            {/* TODO: social profiles - listed in content/site.json once they exist. */}
            {SITE.footer.social.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-4">
                {SITE.footer.social.map((item) => (
                  <li key={item.href}>
                    <a href={item.href} rel="me noopener" className="text-sm font-medium text-ink-muted hover:text-ink">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <FooterColumn heading={SITE.footer.columns[0]!.heading} links={SITE.footer.columns[0]!.links} />
          <FooterColumn
            heading={SITE.footer.rolesHeading}
            links={TEMPLATES.map((role) => ({ label: role.name, href: `/showcase#${role.id}` }))}
          />
          {SITE.footer.columns.slice(1).map((column) => (
            <FooterColumn key={column.heading} heading={column.heading} links={column.links} />
          ))}
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-ink-muted sm:px-6">
            {SITE.footer.legal.replace("{year}", String(year)).replace("{company}", SITE.company.legalName)}
          </p>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({ heading, links }: { heading: string; links: readonly { label: string; href: string }[] }) {
  return (
    <div>
      <h2 className="eyebrow">{heading}</h2>
      <ul className="mt-3 space-y-2">
        {links.map((item) => (
          <li key={item.href + item.label}>
            <Link href={item.href} className="text-sm text-ink-muted hover:text-ink">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
