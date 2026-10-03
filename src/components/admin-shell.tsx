"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { BRAND } from "@/lib/site/brand";
import { BrandMark } from "@/components/brand-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, initialsOf } from "@/lib/shared/utils";

const NAV = [
  { segment: "agent", label: "Agent", also: "agents", tone: "lemon" },
  { segment: "integrations", label: "Integrations", also: "", tone: "sky" },
  { segment: "productivity", label: "Productivity", also: "", tone: "mint" },
] as const;

/** Three notes on a slim top bar: the whole app is one row of navigation. */
export function AdminShell({
  email,
  name,
  project,
  children,
}: {
  email: string;
  name: string | null;
  project: { slug: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/p/${project.slug}`;

  return (
    <div data-app className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-accent-fg"
      >
        Skip to content
      </a>

      <header className="material-bar sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4 sm:px-6">
          <Link href={`${base}/agent`} className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-ink" aria-label={`${BRAND.name} home`}>
            <BrandMark className="size-5" />
            <span className="hidden sm:inline">{BRAND.name}</span>
          </Link>

          <nav aria-label="Main" className="mx-auto flex items-center gap-1 sm:gap-1.5">
            {NAV.map((item) => {
              const href = `${base}/${item.segment}`;
              const active = pathname === href || pathname.startsWith(`${href}/`) || (item.also !== "" && pathname.startsWith(`${base}/${item.also}`));
              return (
                <Link
                  key={item.segment}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-semibold text-ink transition-[background-color,transform] duration-150 ease-out",
                    active ? "shadow-xs" : "text-ink-muted hover:bg-ink/[0.05] hover:text-ink",
                  )}
                  style={active ? { background: `var(--note-${item.tone})`, rotate: "-1deg" } : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Account"
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface-3 text-xs font-semibold text-ink transition-colors hover:border-line-strong"
              >
                {initialsOf(name || email) || "?"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="normal-case tracking-normal">{email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut({ callbackUrl: "/login" })}>
                <LogOut aria-hidden />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main id="main" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
