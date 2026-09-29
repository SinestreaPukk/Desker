"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { api } from "@/lib/api-client";
import type { ActivityDto } from "@/app/api/activity/route";
import { cn } from "@/lib/utils";

/**
 * The week in the numbers that decide whether an owner trusts the staff:
 * what got done, what went out and on whose say-so, what is waiting for them.
 * First thing on the Roster, one line tall, with the Audit log behind it.
 */
export function ActivityStrip({ project }: { project: string }) {
  const query = useQuery({
    queryKey: ["activity", project],
    queryFn: () => api<ActivityDto>(`/api/activity?project=${encodeURIComponent(project)}`),
    refetchInterval: 30_000,
  });
  const a = query.data;
  // A new workspace has nothing to report; the setup checklist speaks instead.
  if (!a || a.done + a.sentApproved + a.sentOnItsOwn + a.waiting + a.escalated === 0) return null;

  const figures: { value: number; label: string; href?: string; attention?: boolean }[] = [
    { value: a.done, label: a.done === 1 ? "task done" : "tasks done" },
    { value: a.sentApproved, label: "sent after you approved" },
    { value: a.sentOnItsOwn, label: "sent on its own" },
    { value: a.waiting, label: "waiting for you", href: `/p/${project}/needs-you`, attention: a.waiting > 0 },
    ...(a.escalated > 0 ? [{ value: a.escalated, label: "asked for a person", attention: true }] : []),
  ];

  return (
    <section
      aria-label={`Last ${a.days} days`}
      className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-line bg-surface px-4 py-3"
    >
      <p className="eyebrow w-full sm:w-auto">Last {a.days} days</p>
      <ul className="flex flex-1 flex-wrap gap-x-6 gap-y-2">
        {figures.map((figure) => {
          const body = (
            <>
              <span
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  figure.attention ? "text-warning" : "text-ink",
                )}
              >
                {figure.value}
              </span>{" "}
              <span className="text-sm text-ink-muted">{figure.label}</span>
            </>
          );
          return (
            <li key={figure.label}>
              {figure.href ? (
                <Link href={figure.href} className="rounded-sm hover:underline">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
      <Link
        href={`/p/${project}/audit`}
        className="inline-flex items-center gap-0.5 text-sm font-medium text-accent hover:underline"
      >
        Audit log
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
