"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ChartNoAxesColumn,
  Check,
  ChevronsUpDown,
  Briefcase,
  Inbox,
  Plug,
  LogOut,
  Menu,
  Plus,
  Users,
  X,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { useAdminLiveFeed, useIssues } from "@/hooks/use-admin-data";
import { cn, initialsOf } from "@/lib/utils";

export interface ProjectRef {
  id: string;
  name: string;
  slug: string;
}

/** Section, not page: every nav item is a tab of the same workspace. */
const NAV = [
  { segment: "roster", label: "Roster", icon: Users },
  { segment: "work", label: "Work", icon: Briefcase },
  { segment: "inbox", label: "Inbox", icon: Inbox },
  { segment: "insights", label: "Insights", icon: ChartNoAxesColumn },
  { segment: "integrations", label: "Integrations", icon: Plug },
] as const;

export function AdminShell({
  email,
  name,
  project,
  projects,
  children,
}: {
  email: string;
  name: string | null;
  project: ProjectRef;
  projects: ProjectRef[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // One subscription for the whole admin app.
  useAdminLiveFeed();

  const { data: openIssues } = useIssues({ status: "open", project: project.slug });
  const openCount = openIssues?.length ?? 0;

  const base = `/p/${project.slug}`;

  const navLinks = (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const href = `${base}/${item.segment}`;
        // The builder lives under /agents but belongs to the roster tab, so the
        // highlight does not disappear when you open an agent.
        const active =
          pathname === href ||
          pathname.startsWith(`${href}/`) ||
          (item.segment === "roster" && pathname.startsWith(`${base}/agents`));
        return (
          <Link
            key={item.segment}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={() => setMobileNavOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent-soft text-accent-soft-fg"
                : "text-ink-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
            {item.segment === "inbox" && openCount > 0 ? (
              <span
                className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-[0.625rem] font-semibold text-white tabular-nums"
                aria-label={`${openCount} open items`}
              >
                {openCount > 99 ? "99+" : openCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const projectSwitcher = (
    <ProjectSwitcher project={project} projects={projects} pathname={pathname} />
  );

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Skip link: first tab stop on every admin page. */}
      <a
        href="#admin-main"
        className={cn(
          "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50",
          "focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-accent-fg",
        )}
      >
        Skip to content
      </a>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Link href={`${base}/roster`} className="flex items-center gap-2 font-semibold text-ink">
          <BrandMark />
          {BRAND.name}
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
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
        </div>
      </header>

      {mobileNavOpen ? (
        <div id="mobile-nav" className="space-y-3 border-b border-line bg-surface p-3 lg:hidden">
          {projectSwitcher}
          {navLinks}
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface p-4 lg:flex">
        <Link
          href={`${base}/roster`}
          className="mb-4 flex items-center gap-2 px-1 text-[0.9375rem] font-semibold tracking-tight text-ink"
        >
          <BrandMark />
          {BRAND.name}
        </Link>

        <div className="mb-4">{projectSwitcher}</div>

        {navLinks}

        <div className="mt-auto space-y-3 pt-4">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                  "hover:bg-surface-2",
                )}
              >
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-[0.625rem] font-semibold text-ink-muted"
                >
                  {initialsOf(name || email) || "?"}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink">
                  {name || email}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="normal-case tracking-normal">
                {email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut({ callbackUrl: "/login" })}>
                <LogOut aria-hidden />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main id="admin-main" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}

function ProjectSwitcher({
  project,
  projects,
  pathname,
}: {
  project: ProjectRef;
  projects: ProjectRef[];
  pathname: string;
}) {
  const [creating, setCreating] = React.useState(false);

  /**
   * Switching keeps you on the same tab rather than dumping you on the roster -
   * comparing two projects' inboxes is the obvious reason to switch at all.
   */
  const tab = React.useMemo(() => {
    const match = pathname.match(/^\/p\/[^/]+\/(roster|inbox|insights|agents)/);
    const segment = match?.[1];
    // Detail routes (a specific conversation or agent) do not exist in the
    // other project, so fall back to that section's index.
    return segment === "agents" ? "roster" : (segment ?? "roster");
  }, [pathname]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-2",
              "text-left transition-colors hover:bg-surface-3",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="meta block">Project</span>
              <span className="block truncate text-[0.8125rem] font-medium text-ink">
                {project.name}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          {projects.map((entry) => (
            <DropdownMenuItem key={entry.id} asChild>
              <Link href={`/p/${entry.slug}/${tab}`}>
                <Check
                  className={cn(
                    "size-3.5",
                    entry.id === project.id ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
                <span className="truncate">{entry.name}</span>
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(event) => {
            event.preventDefault();
            setCreating(true);
          }}>
            <Plus aria-hidden />
            New project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewProjectDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
