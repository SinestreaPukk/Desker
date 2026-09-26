"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Activity,
  Blocks,
  BotMessageSquare,
  Building,
  Check,
  ChevronsUpDown,
  History,
  LogOut,
  Menu,
  Plus,
  UsersRound,
  Workflow,
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
import { FeedbackButton } from "@/components/feedback-dialog";
import { HelpButton, HelpProvider } from "@/components/help/help-panel";
import { UsageTracker } from "@/components/usage-tracker";
import { useAdminLiveFeed, useIssues } from "@/hooks/use-admin-data";
import { cn, initialsOf } from "@/lib/utils";

export interface ProjectRef {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
}

export interface OrganizationRef {
  id: string;
  name: string;
  role: string;
}

interface NavItem {
  segment: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

const NAV_GROUPS: { title: string; items: readonly NavItem[] }[] = [
  {
    title: "Workspace",
    items: [
      { segment: "roster", label: "Roster", icon: UsersRound },
      { segment: "work", label: "Work", icon: Workflow },
      { segment: "inbox", label: "Inbox", icon: BotMessageSquare },
      { segment: "insights", label: "Insights", icon: Activity },
    ],
  },
  {
    title: "Configuration",
    items: [
      { segment: "integrations", label: "Integrations", icon: Blocks },
      { segment: "organization", label: "Organisation", icon: Building },
      { segment: "audit", label: "Audit log", icon: History },
    ],
  },
] as const;

export function AdminShell({
  email,
  name,
  project,
  projects,
  organizations,
  children,
}: {
  email: string;
  name: string | null;
  project: ProjectRef;
  projects: ProjectRef[];
  organizations: OrganizationRef[];
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
    <nav aria-label="Main" className="flex flex-col gap-3">
      {NAV_GROUPS.map((group, groupIdx) => (
        <div key={group.title} className="space-y-1">
          {groupIdx > 0 ? <div className="mb-2 border-t border-line/60" role="separator" /> : null}
          <div className="px-2 pb-1 pt-0.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            {group.title}
          </div>
          {group.items.map((item) => {
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
                  "relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-accent-soft font-semibold text-accent-soft-fg shadow-2xs before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-accent"
                    : "text-ink-muted hover:bg-surface hover:text-ink",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors duration-150",
                    active ? "text-accent-soft-fg" : "text-ink-subtle",
                  )}
                  aria-hidden
                />
                <span>{item.label}</span>
                {item.segment === "inbox" && openCount > 0 ? (
                  <span
                    className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-xs font-bold text-danger-fg tabular-nums shadow-2xs"
                    aria-label={`${openCount} open items`}
                  >
                    {openCount > 99 ? "99+" : openCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const projectSwitcher = (
    <ProjectSwitcher
      project={project}
      projects={projects}
      organizations={organizations}
      pathname={pathname}
    />
  );

  return (
    <HelpProvider project={project.slug}>
      <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Skip link: first tab stop on every admin page. */}
      <a
        href="#admin-main"
        className={cn(
          "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50",
          "focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-accent-fg",
        )}
      >
        Skip to content
      </a>

      {/* Mobile top bar */}
      {/* The same ground as the rail it stands in for. The nav links inside
          hover to bg-surface, which needs something quieter behind it. */}
      <header className="flex items-center justify-between border-b border-line bg-rail px-4 py-3 lg:hidden">
        <Link href={`${base}/roster`} className="flex items-center gap-2 font-semibold text-ink">
          <BrandMark />
          {BRAND.name}
        </Link>
        <div className="flex items-center gap-2">
          <HelpButton />
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
        <div id="mobile-nav" className="space-y-3 border-b border-line bg-rail p-3 lg:hidden">
          {projectSwitcher}
          {navLinks}
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-rail p-4 lg:flex">
        <Link
          href={`${base}/roster`}
          className="group mb-4 flex items-center justify-between px-1 text-base font-semibold tracking-tight text-ink"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg border border-line bg-surface shadow-2xs transition-colors group-hover:border-accent-line">
              <BrandMark className="size-4" />
            </span>
            <span className="font-semibold tracking-tight">{BRAND.name}</span>
          </div>
          <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            Workspace
          </span>
        </Link>

        <div className="mb-4">{projectSwitcher}</div>

        {navLinks}

        {/* The foot of the sidebar */}
        <div className="mt-auto space-y-2 border-t border-line pt-3">
          {/* Always the same spot, on every screen in the app. */}
          <HelpButton className="w-full justify-start hover:bg-surface" />
          <FeedbackButton project={project.slug} className="w-full justify-start hover:bg-surface" />
          <ThemeToggle className="w-full [&>button]:flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-lg border border-line/70 bg-surface/60 p-2 text-left transition-all",
                  "hover:border-line-strong hover:bg-surface hover:shadow-xs",
                )}
              >
                <span className="relative shrink-0">
                  <span
                    aria-hidden
                    className="flex size-8 items-center justify-center rounded-full border border-line bg-surface-3 text-xs font-semibold text-ink shadow-2xs"
                  >
                    {initialsOf(name || email) || "?"}
                  </span>
                  <span
                    className="absolute bottom-0 right-0 size-2.5 rounded-full bg-positive ring-2 ring-surface"
                    aria-hidden
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-ink leading-tight">
                    {name || email.split("@")[0]}
                  </span>
                  <span className="block truncate text-[11px] text-ink-muted leading-tight mt-0.5">
                    {email}
                  </span>
                </span>
                <ChevronsUpDown className="size-3.5 shrink-0 text-ink-subtle transition-colors group-hover:text-ink" aria-hidden />
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
        {process.env.NEXT_PUBLIC_ENVIRONMENT === "staging" ? (
          <p className="border-b border-warning-line bg-warning-soft px-4 py-1.5 text-center text-xs text-warning">
            Staging - demo data, reset without notice. Nothing here reaches real clients.
          </p>
        ) : null}
        {children}
      </main>
      <UsageTracker project={project.slug} />
      </div>
    </HelpProvider>
  );
}

function ProjectSwitcher({
  project,
  projects,
  organizations,
  pathname,
}: {
  project: ProjectRef;
  projects: ProjectRef[];
  organizations: OrganizationRef[];
  pathname: string;
}) {
  const [creating, setCreating] = React.useState(false);
  const organization = organizations.find((org) => org.id === project.organizationId);
  // Only this organisation's projects belong in the project list; the other
  // organisations sit in their own section and switching lands on their
  // first project.
  const ownProjects = projects.filter((entry) => entry.organizationId === project.organizationId);
  const others = organizations
    .filter((org) => org.id !== project.organizationId)
    .map((org) => ({ org, first: projects.find((entry) => entry.organizationId === org.id) }))
    .filter((entry) => entry.first);

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
            aria-label={`Switch project or organisation (${organization?.name ?? ""}: ${project.name})`}
            className={cn(
              "group flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface p-2 shadow-2xs",
              "text-left transition-all hover:border-line-strong hover:shadow-xs",
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-accent-line/60 bg-accent-soft text-accent-soft-fg shadow-2xs">
              <Building className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="meta block truncate text-[10px] leading-tight text-ink-muted">{organization?.name ?? "Project"}</span>
              <span className="block truncate text-sm font-semibold text-ink leading-tight mt-0.5 transition-colors group-hover:text-accent">
                {project.name}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-ink-subtle transition-colors group-hover:text-ink" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          {ownProjects.map((entry) => (
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
          {others.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Switch organisation</DropdownMenuLabel>
              {others.map(({ org, first }) => (
                <DropdownMenuItem key={org.id} asChild>
                  <Link href={`/p/${first!.slug}/${tab}`}>
                    <Building className="size-3.5 text-ink-subtle" aria-hidden />
                    <span className="truncate">{org.name}</span>
                    <span className="ml-auto text-xs text-ink-muted">{org.role}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <NewProjectDialog open={creating} onOpenChange={setCreating} project={project.slug} />
    </>
  );
}
