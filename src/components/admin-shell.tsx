"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Blocks, Bot, ChevronsUpDown, FileText, LogOut, MessageCircle, Rocket, Shield, UserRound } from "lucide-react";
import { BRAND } from "@/lib/site/brand";
import { BrandMark } from "@/components/brand-logo";
import { ChatHistory } from "@/components/chat/chat-history";
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
  { segment: "chat", label: "Chat", icon: MessageCircle, also: "", tone: "sky" },
  { segment: "agent", label: "Agent", icon: Bot, also: "agents", tone: "lemon" },
  { segment: "integrations", label: "Integrations", icon: Blocks, also: "", tone: "mint" },
  { segment: "productivity", label: "Productivity", icon: Rocket, also: "", tone: "lilac" },
] as const;

/**
 * The frame of the app: a sidebar on a computer, a bar along the bottom on a
 * phone. The same four places in both, the one you are in marked as a note.
 */
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
  const isActive = (item: (typeof NAV)[number]) => {
    const href = `${base}/${item.segment}`;
    return pathname === href || pathname.startsWith(`${href}/`) || (item.also !== "" && pathname.startsWith(`${base}/${item.also}`));
  };

  const account = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="group flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-ink/[0.05]" aria-label="Account">
          <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-3 text-xs font-semibold text-ink">
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
          <Link href={`${base}/account`}>
            <UserRound aria-hidden />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/privacy" target="_blank">
            <Shield aria-hidden />
            Privacy policy
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/terms" target="_blank">
            <FileText aria-hidden />
            Terms of use
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut({ callbackUrl: "/login" })}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div data-app className="flex min-h-dvh flex-col lg:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-accent-fg"
      >
        Skip to content
      </a>

      {/* Phone: a slim top bar with the account, the places along the bottom. */}
      <header className="material-bar sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line px-4 lg:hidden">
        <Link href={`${base}/chat`} className="flex items-center gap-2 font-semibold tracking-tight text-ink">
          <BrandMark className="size-5" />
          {BRAND.name}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Account" className="flex size-11 items-center justify-center rounded-full border border-line bg-surface-3 text-xs font-semibold text-ink">
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
      </header>

      {/* Computer: the sidebar stays put while the page scrolls. */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line/70 bg-rail px-3 py-4 lg:flex">
        <Link href={`${base}/chat`} className="mb-6 flex items-center gap-2.5 px-3 text-base font-semibold tracking-tight text-ink">
          <BrandMark className="size-5" />
          {BRAND.name}
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.segment}
                href={`${base}/${item.segment}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-semibold transition-[background-color,transform] duration-150 ease-out",
                  active ? "text-ink shadow-xs" : "text-ink-muted hover:bg-ink/[0.05] hover:text-ink",
                )}
                style={active ? { background: `var(--note-${item.tone})`, rotate: "-0.8deg" } : undefined}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-ink" : "text-accent")} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <React.Suspense fallback={<div className="flex-1" />}>
          <ChatHistory project={project.slug} />
        </React.Suspense>
        <div className="pt-3">{account}</div>
      </aside>

      <main id="main" className="min-w-0 flex-1 pb-16 lg:pb-0">
        {children}
      </main>

      <nav aria-label="Main" className="material-bar fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.segment}
              href={`${base}/${item.segment}`}
              aria-current={active ? "page" : undefined}
              className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold", active ? "text-ink" : "text-ink-muted")}
            >
              <span className="flex h-7 w-12 items-center justify-center rounded-md" style={active ? { background: `var(--note-${item.tone})` } : undefined}>
                <Icon className="size-5" aria-hidden />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
