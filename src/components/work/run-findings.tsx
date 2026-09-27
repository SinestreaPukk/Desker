"use client";

import * as React from "react";
import { ExternalLink, Globe, Search } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ActionItemDto } from "@/lib/work/serialize";
import { safeHttpUrl } from "@/lib/utils";

type Finding = ActionItemDto["findings"][number];

/**
 * A run's research as a shelf of cards: what each search turned up, in one
 * line, with the full write-up and its sources a click away. Agents often
 * repeat a search when a run retries; only the latest answer to each is kept.
 */
export function RunFindings({ findings }: { findings: Finding[] }) {
  const latest = new Map<string, Finding>();
  for (const finding of findings) latest.set(finding.query.trim().toLowerCase(), finding);
  const unique = [...latest.values()];

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {unique.map((finding, index) => (
        <li key={index}>
          <FindingCard finding={finding} />
        </li>
      ))}
    </ul>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const { title, gist } = outline(finding);
  const domains = [...new Set(finding.sources.map((source) => domainOf(source.url)).filter(Boolean))];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex h-full w-full flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-accent-line hover:bg-accent-soft/20"
        >
          <span className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-accent-line/70 bg-accent-soft text-accent-soft-fg">
              <Search className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="line-clamp-2 font-medium text-ink">{title}</span>
              {gist ? <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">{gist}</span> : null}
            </span>
          </span>
          <span className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-ink-subtle">
            <Globe className="size-3 shrink-0" aria-hidden />
            <span className="truncate">
              {finding.sources.length} source{finding.sources.length === 1 ? "" : "s"}
              {domains.length > 0 ? ` · ${domains.slice(0, 2).join(", ")}${domains.length > 2 ? ` +${domains.length - 2}` : ""}` : ""}
            </span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Searched for &ldquo;{finding.query}&rdquo;</DialogDescription>
        <Markdown text={stripLeadingHeading(finding.findings)} className="mt-4" />
        {finding.sources.length > 0 ? (
          <section className="mt-6 border-t border-line pt-4">
            <h3 className="eyebrow mb-2">Sources</h3>
            <ol className="space-y-2 text-sm">
              {finding.sources.map((source, i) => {
                const href = safeHttpUrl(source.url);
                return (
                  <li key={i} className="flex gap-2">
                    <span className="w-6 shrink-0 font-mono text-xs leading-5 text-ink-subtle">[{i + 1}]</span>
                    <span className="min-w-0">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          {source.title}
                          <ExternalLink className="size-3 shrink-0" aria-hidden />
                        </a>
                      ) : (
                        <span className="text-ink">{source.title}</span>
                      )}
                      <span className="block text-xs text-ink-subtle">
                        {domainOf(source.url) || "Not a web link, so not linked"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** The write-up's own heading when it has one (searches read like keywords), and its first sentence. */
function outline(finding: Finding): { title: string; gist: string } {
  const lines = finding.findings.split("\n").map((line) => line.trim()).filter(Boolean);
  const heading = lines[0] && /^#{1,4}\s+(.*)$/.exec(lines[0])?.[1];
  // Skip sub-headings, including the all-bold lines agents use as them.
  const body = lines.find((line) => !/^#{1,4}\s/.test(line) && !/^\*\*[^*]+\*\*:?$/.test(line)) ?? "";
  return { title: plain(heading || finding.query), gist: plain(body.replace(/^[-*]\s+|^\d+\.\s+/, "")) };
}

function stripLeadingHeading(text: string): string {
  return text.replace(/^\s*#{1,4}\s+.*\n/, "");
}

/** Markdown down to words, for a one-line preview. */
function plain(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s*\[\d+(?:,\s*\d+)*\]/g, "")
    .trim();
}

function domainOf(url: string): string {
  const href = safeHttpUrl(url);
  if (!href) return "";
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
