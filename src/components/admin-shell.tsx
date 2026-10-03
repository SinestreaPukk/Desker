"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Blocks, Bot, ChevronsUpDown, LogOut, Menu, Newspaper, Rocket, X } from "lucide-react";
import { BRAND } from "@/lib/site/brand";
import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, initialsOf } from "@/lib/shared/utils";

interface ProjectRef {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
}

interface NavItem {
  segment: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Other path prefixes that keep this item highlighted. */
  alsoActive?: string;
}

const NAV: readonly NavItem[] = [
  { segment: "agent", label: "Agent", icon: Bot, alsoActive: "agents" },
  { segment: "integrations", label: "Integrations", icon: Blocks },
  { segment: "productivity", label: "Productivity", icon: Rocket },
];

export function AdminShell({
  email,
  name,
  project,
  children,
}: {
  email: string;
  name: string | null;
  project: ProjectRef;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const base = `/p/${project.slug}`;

  const navLinks = (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const Icon = item.icon;
        const href = `${base}/${item.segment}`;
        const active =
          pathname === href ||
          pathname.startsWith(`${href}/`) ||
          (item.alsoActive ? pathname.startsWith(`${base}/${item.alsoActive}`) : false);
        return (
          <Link
            key={item.segment}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={() => setMobileNavOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              active ? "bg-accent-soft text-accent-soft-fg" : "text-ink hover:bg-ink/[0.05]",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active ? "text-accent-soft-fg" : "text-accent")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div data-app className="flex min-h-dvh flex-col lg:flex-row">
      <a
        href="#admin-main"
        className={cn(
          "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50",
          "focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-accent-fg",
        )}
      >
        Skip to content
      </a>

      <header className="material-bar sticky top-0 z-30 flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
        <Link href={`${base}/agent`} className="flex items-center gap-2 font-semibold text-ink">
          <BrandMark />
          {BRAND.name}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-nav"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? <X aria-hidden /> : <Menu aria-hidden />}
        </Button>
      </header>

      {mobileNavOpen ? (
        <div id="mobile-nav" className="space-y-3 border-b border-line bg-rail p-3 lg:hidden">
          {navLinks}
          <div className="border-t border-line pt-3">
            <p className="truncate px-3 pb-1 text-meta text-ink-muted">{email}</p>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink hover:bg-ink/[0.05]"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      ) : null}

      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r border-line/70 bg-rail px-3 py-4 lg:flex">
        <Link href={`${base}/agent`} className="mb-6 flex items-center gap-2.5 px-3 text-base font-semibold tracking-tight text-ink">
          <BrandMark className="size-5" />
          {BRAND.name}
        </Link>

        {navLinks}

        <div className="mt-auto pt-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="group flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-ink/[0.05]">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-3 text-xs font-semibold text-ink"
                >
                  {initialsOf(name || email) || "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold leading-tight text-ink">{name || email.split("@")[0]}</span>
                  <span className="mt-0.5 block truncate text-meta leading-tight text-ink-muted">{email}</span>
                </span>
                <ChevronsUpDown className="size-3.5 shrink-0 text-ink-subtle transition-colors group-hover:text-ink" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="normal-case tracking-normal">{email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/blog">
                  <Newspaper aria-hidden />
                  Blog & Updates
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void signOut({ callbackUrl: "/login" })}>
                <LogOut aria-hidden />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main id="admin-main" className="relative isolate min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
