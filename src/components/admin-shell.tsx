"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Activity,
  BellDot,
  Blocks,
  BotMessageSquare,
  Building,
  Check,
  ChevronsUpDown,
  History,
  LogOut,
  Menu,
  MessagesSquare,
  Newspaper,
  Plus,
  Route,
  UserRound,
  UsersRound,
  Workflow,
  X,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
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
import { NewProjectDialog } from "@/components/new-project-dialog";
import { NewSpaceDialog } from "@/components/new-space-dialog";
import { SpaceKindProvider } from "@/components/space-kind";
import type { SpaceKind } from "@/lib/space";
import { FeedbackButton } from "@/components/feedback-dialog";
import { HelpButton, HelpProvider } from "@/components/help/help-panel";
import { UsageTracker } from "@/components/usage-tracker";
import { useAdminLiveFeed, useIssues } from "@/hooks/use-admin-data";
import { useActionItems, useSuggestions } from "@/hooks/use-work-data";
import { waitingCount as waitingCount_ } from "@/lib/needs-you";
import { cn, initialsOf } from "@/lib/utils";

interface ProjectRef {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
}

interface OrganizationRef {
  id: string;
  name: string;
  role: string;
  kind: SpaceKind;
}

interface NavItem {
  segment: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

/** A personal space has no organisation to manage: its settings are "Your space". */
function navGroups(kind: SpaceKind): { title: string; items: readonly NavItem[] }[] {
  if (kind === "business") return NAV_GROUPS;
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.segment !== "conversations").map((item) =>
      item.segment === "organization" ? { ...item, label: "Your space", icon: UserRound } : item.segment === "team" ? { ...item, label: "Chat" } : item,
    ),
  }));
}

const NAV_GROUPS: { title: string; items: readonly NavItem[] }[] = [
  {
    title: "Workspace",
    items: [
      { segment: "needs-you", label: "Needs you", icon: BellDot },
      { segment: "roster", label: "Roster", icon: UsersRound },
      { segment: "team", label: "Team", icon: MessagesSquare },
      { segment: "work", label: "Work", icon: Workflow },
      { segment: "workflows", label: "Workflows", icon: Route },
      { segment: "conversations", label: "Conversations", icon: BotMessageSquare },
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
  kind,
  projects,
  organizations,
  children,
}: {
  email: string;
  name: string | null;
  project: ProjectRef;
  kind: SpaceKind;
  projects: ProjectRef[];
  organizations: OrganizationRef[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // One subscription for the whole admin app.
  useAdminLiveFeed();

  // Everything that waits on a person, counted once, beside Needs you: the
  // same three sources the queue lists.
  const { data: openIssues } = useIssues({ status: "open", project: project.slug });
  const waiting = useActionItems({ project: project.slug, status: "needs_approval", view: "list" }, { refetchInterval: 15_000 });
  const suggestions = useSuggestions({ project: project.slug });
  const waitingCount = waitingCount_({
    approvals: waiting.data?.length ?? 0,
    openIssues: openIssues?.length ?? 0,
    pendingSuggestions: (suggestions.data ?? []).filter((suggestion) => suggestion.pending).length,
  });

  const base = `/p/${project.slug}`;

  const navLinks = (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {navGroups(kind).map((group) => (
        <div key={group.title} className="space-y-0.5">
          <div className="px-3 pb-1 text-xs font-semibold text-ink-muted">{group.title}</div>
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
                // A filled pill, once: the selection is its own mark, no bar beside it.
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                  active ? "bg-accent-soft text-accent-soft-fg" : "text-ink hover:bg-ink/[0.05]",
                )}
              >
                <Icon
                  className={cn("size-4 shrink-0", active ? "text-accent-soft-fg" : "text-accent")}
                  aria-hidden
                />
                <span>{item.label}</span>
                {/* Mail-style counts: the accent for what waits on the owner, quiet grey for the rest. */}
                {item.segment === "needs-you" && waitingCount > 0 ? (
                  <span
                    className="ml-auto min-w-5 rounded-full bg-accent-soft px-1.5 text-center text-xs font-semibold leading-5 text-accent-soft-fg tabular-nums ring-1 ring-inset ring-accent-line"
                    aria-label={`${waitingCount} waiting for you`}
                  >
                    {waitingCount > 99 ? "99+" : waitingCount}
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
    <SpaceKindProvider kind={kind}>
    <HelpProvider project={project.slug}>
      <div data-app className="flex min-h-dvh flex-col lg:flex-row">
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
      <header className="material-bar sticky top-0 z-30 flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
        <Link href={`${base}/roster`} className="flex items-center gap-2 font-semibold text-ink">
          <BrandMark />
          {BRAND.name}
        </Link>
        <div className="flex items-center gap-2">
          <HelpButton />
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
      {/* The sidebar stays put while the page scrolls, like a native source list. */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r border-line/70 bg-rail px-3 py-4 lg:flex">
        <Link
          href={`${base}/roster`}
          className="mb-4 flex items-center gap-2.5 px-3 text-base font-semibold tracking-tight text-ink"
        >
          <BrandMark className="size-5" />
          {BRAND.name}
        </Link>

        <div className="mb-4">{projectSwitcher}</div>

        {navLinks}

        {/* The foot of the sidebar */}
        <div className="mt-auto space-y-1 pt-3">
          {/* Always the same spot, on every screen in the app. */}
          <HelpButton className="w-full justify-start hover:bg-surface" />
          <FeedbackButton project={project.slug} className="w-full justify-start hover:bg-surface" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="group flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-ink/[0.05]"
              >
                <span className="relative shrink-0">
                  <span
                    aria-hidden
                    className="flex size-8 items-center justify-center rounded-full border border-line bg-surface-3 text-xs font-semibold text-ink"
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
                  <span className="block truncate text-meta text-ink-muted leading-tight mt-0.5">
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
        {/* The desk behind every page: a few notes just out of focus at the
            top, the same ground as the public site, quiet enough to read on. */}
        <div aria-hidden className="soft-notes soft-notes-quiet pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 overflow-hidden">
          <span className="absolute -left-16 -top-10 h-64 w-80 rounded-panel bg-note-lemon" style={{ rotate: "-8deg" }} />
          <span className="absolute right-[8%] -top-16 h-72 w-96 rounded-panel bg-note-sky" style={{ rotate: "7deg" }} />
          <span className="absolute left-[42%] top-24 h-48 w-72 rounded-panel bg-note-lilac" style={{ rotate: "-4deg" }} />
        </div>
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
    </SpaceKindProvider>
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
  const [addingSpace, setAddingSpace] = React.useState<SpaceKind | null>(null);
  const organization = organizations.find((org) => org.id === project.organizationId);
  const SpaceIcon = organization?.kind === "personal" ? UserRound : Building;
  // "Both" can be chosen after sign-up too: offer whichever kind is missing.
  const missingKind: SpaceKind | null = !organizations.some((org) => org.kind === "personal" && org.role === "owner")
    ? "personal"
    : !organizations.some((org) => org.kind === "business")
      ? "business"
      : null;
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
    const match = pathname.match(/^\/p\/[^/]+\/(roster|needs-you|work|conversations|insights|agents)/);
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
            aria-label={`Switch project or space (${organization?.name ?? ""}: ${project.name})`}
            className="group flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-ink/[0.05]"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-fg">
              <SpaceIcon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink leading-tight">{project.name}</span>
              <span className="mt-0.5 block truncate text-xs leading-tight text-ink-muted">{organization?.name ?? ""}</span>
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
              <DropdownMenuLabel>Switch space</DropdownMenuLabel>
              {others.map(({ org, first }) => {
                const Icon = org.kind === "personal" ? UserRound : Building;
                return (
                  <DropdownMenuItem key={org.id} asChild>
                    <Link href={`/p/${first!.slug}/${tab}`}>
                      <Icon className="size-3.5 text-ink-subtle" aria-hidden />
                      <span className="truncate">{org.name}</span>
                      <span className="ml-auto text-xs text-ink-muted">{org.kind === "personal" ? "Personal" : org.role}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </>
          ) : null}
          {missingKind ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setAddingSpace(missingKind)}>
                {missingKind === "personal" ? <UserRound aria-hidden /> : <Building aria-hidden />}
                {missingKind === "personal" ? "Add a personal space" : "Add a business"}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <NewProjectDialog open={creating} onOpenChange={setCreating} project={project.slug} />
      <NewSpaceDialog
        kind={addingSpace ?? "personal"}
        open={addingSpace !== null}
        onOpenChange={(open) => !open && setAddingSpace(null)}
      />
    </>
  );
}
