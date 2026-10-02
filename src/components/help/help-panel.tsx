"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, CircleHelp, Compass, ExternalLink, ListChecks, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Markdown } from "@/components/markdown";
import { EmptyState } from "@/components/ui/states";
import { GUIDES, guideBySlug, helpTopic, searchGuides, type HelpTopic } from "@/lib/guides";
import { CHECKLIST_REOPEN_EVENT, showChecklist } from "@/components/help/checklist-state";
import { openTour } from "@/components/tour/tour";
import { cn } from "@/lib/utils";

interface HelpTarget {
  slug: string;
  section?: string | null;
}

interface HelpContextValue {
  /** Open the panel, optionally at one guide and one heading inside it. */
  open: (target?: HelpTarget | null) => void;
  /** Open the panel at the guide a named control is documented in. */
  openTopic: (topic: HelpTopic) => void;
  close: () => void;
}

const HelpContext = React.createContext<HelpContextValue | null>(null);

export function useHelp(): HelpContextValue {
  const context = React.useContext(HelpContext);
  if (!context) {
    // Outside the admin shell there is no panel to open; the contextual links
    // fall back to the public guide pages rather than throwing.
    return { open: () => {}, openTopic: () => {}, close: () => {} };
  }
  return context;
}

/**
 * The help panel, mounted once by the admin shell.
 *
 * One source for the guides (lib/guides.ts), read here and on the public
 * /guides pages, so nothing is written twice. The panel is searchable and
 * deep-linkable: a "?" beside a control opens the guide at that heading
 * rather than at a homepage the owner then has to search from scratch.
 */
export function HelpProvider({
  project,
  children,
}: {
  project: string;
  children: React.ReactNode;
}) {
  const [target, setTarget] = React.useState<HelpTarget | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  const value = React.useMemo<HelpContextValue>(
    () => ({
      open: (next) => {
        setTarget(next ?? null);
        setIsOpen(true);
      },
      openTopic: (topic) => {
        setTarget(helpTopic(topic));
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }),
    [],
  );

  // "?" opens help from anywhere that is not a text field, the way every
  // documentation-heavy product does it.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey) return;
      const node = event.target as HTMLElement | null;
      const tag = node?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || node?.isContentEditable) return;
      event.preventDefault();
      setTarget(null);
      setIsOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <HelpContext.Provider value={value}>
      {children}
      <HelpDialog
        project={project}
        open={isOpen}
        target={target}
        onOpenChange={setIsOpen}
        onTarget={setTarget}
      />
    </HelpContext.Provider>
  );
}

function HelpDialog({
  project,
  open,
  target,
  onOpenChange,
  onTarget,
}: {
  project: string;
  open: boolean;
  target: HelpTarget | null;
  onOpenChange: (open: boolean) => void;
  onTarget: (target: HelpTarget | null) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const guide = target ? guideBySlug(target.slug) : null;
  const guides = GUIDES;
  const results = React.useMemo(() => searchGuides(query, guides), [query, guides]);

  // Opening at a heading should land on that heading, not at the top of a
  // page the reader has to scan.
  React.useEffect(() => {
    if (!open || !guide || !target?.section) return;
    const handle = window.setTimeout(() => {
      const heading = bodyRef.current?.querySelector(`#${CSS.escape(target.section!)}`);
      heading?.scrollIntoView({ block: "start" });
    }, 60);
    return () => window.clearTimeout(handle);
  }, [open, guide, target?.section]);

  function reset() {
    onTarget(null);
    setQuery("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        {guide ? (
          <>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => onTarget(null)}>
                <ArrowLeft aria-hidden />
                All guides
              </Button>
              <span className="ml-auto text-xs text-ink-muted">{guide.minutes} min read</span>
            </div>
            <DialogTitle className="mt-2">{guide.title}</DialogTitle>
            <DialogDescription>{guide.summary}</DialogDescription>
            <div ref={bodyRef} className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              <Markdown text={guide.body} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
              <Link
                href={`/guides/${guide.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                Open as a page
              </Link>
              <span className="text-xs text-ink-subtle">Press ? anywhere to open help</span>
            </div>
          </>
        ) : (
          <>
            <DialogTitle>Help</DialogTitle>
            <DialogDescription>
              Short answers to one thing at a time. Every guide is a two-minute read.
            </DialogDescription>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                openTour();
              }}
              className="mt-4 flex w-full items-center gap-3 rounded-lg border border-accent-line bg-accent-soft/40 px-3.5 py-3 text-left hover:bg-accent-soft"
            >
              <Compass className="size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">Take the tour</span>
                <span className="block text-xs text-ink-muted">Where to press to get set up, and what makes Desker different.</span>
              </span>
            </button>

            <div className="relative mt-4">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
                aria-hidden
              />
              <label htmlFor="help-search" className="sr-only">
                Search the guides
              </label>
              <Input
                id="help-search"
                autoFocus
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search - approvals, context, webhook…"
                className="pl-9"
              />
            </div>

            <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {query.trim() ? (
                results.length > 0 ? (
                  results.map((match) => (
                    <button
                      key={`${match.guide.slug}-${match.section?.id ?? "top"}`}
                      type="button"
                      onClick={() =>
                        onTarget({ slug: match.guide.slug, section: match.section?.id ?? null })
                      }
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-lg border border-line bg-surface px-3 py-2.5 text-left",
                        "transition-colors hover:border-accent-line hover:bg-accent-soft/40",
                      )}
                    >
                      <span className="text-sm font-medium text-ink">
                        {match.guide.title}
                        {match.section ? (
                          <span className="text-ink-muted"> · {match.section.heading}</span>
                        ) : null}
                      </span>
                      <span className="line-clamp-2 text-xs text-ink-muted">{match.snippet}</span>
                    </button>
                  ))
                ) : (
                  <EmptyState
                    icon={Search}
                    title="Nothing matches that"
                    description="Try a word from the screen you are on - approvals, context, digest, webhook, tokens."
                  />
                )
              ) : (
                <>
                  {guides.map((entry) => (
                    <button
                      key={entry.slug}
                      type="button"
                      onClick={() => onTarget({ slug: entry.slug })}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left",
                        "transition-colors hover:border-accent-line hover:bg-accent-soft/40",
                      )}
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-muted [&_svg]:size-3.5"
                      >
                        <BookOpen />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">{entry.title}</span>
                        <span className="block text-xs text-ink-muted">{entry.summary}</span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-subtle">{entry.minutes} min</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      showChecklist();
                      onOpenChange(false);
                      reset();
                      router.push(`/p/${project}/roster`);
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border border-dashed border-line px-3 py-2.5 text-left",
                      "transition-colors hover:border-accent-line hover:bg-accent-soft/40",
                    )}
                  >
                    <span
                      aria-hidden
                      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-muted [&_svg]:size-3.5"
                    >
                      <ListChecks />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">
                        Setting-up checklist
                      </span>
                      <span className="block text-xs text-ink-muted">
                        The four things that turn a new workspace into a working one.
                      </span>
                    </span>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The "?" that is always in the same place in the navigation. */
export function HelpButton({ className }: { className?: string }) {
  const help = useHelp();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={() => help.open()}
      aria-keyshortcuts="?"
    >
      <CircleHelp aria-hidden />
      Help
    </Button>
  );
}

/**
 * A "?" beside a control that is not self-explanatory, opening the guide at
 * the heading that explains it.
 */
export function HelpLink({
  topic,
  label = "What is this?",
  className,
}: {
  topic: HelpTopic;
  label?: string;
  className?: string;
}) {
  const help = useHelp();
  return (
    <button
      type="button"
      onClick={() => help.openTopic(topic)}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm text-xs text-ink-subtle transition-colors",
        "hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      <CircleHelp className="size-3.5" aria-hidden />
    </button>
  );
}

export { CHECKLIST_REOPEN_EVENT };
