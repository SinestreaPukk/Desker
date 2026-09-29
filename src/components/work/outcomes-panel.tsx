"use client";

import * as React from "react";
import { Panel } from "@/components/ui/panel";
import { SectionTab } from "@/components/ui/section-tab";
import { humanDuration } from "@/lib/insight-copy";
import type { AnalyticsResponse } from "@/hooks/use-admin-data";
import { cn } from "@/lib/utils";

type Outcomes = AnalyticsResponse["outcomes"];
type Row = Outcomes["overall"];

const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);
const wait = (ms: number | null) => (ms === null ? "—" : humanDuration(ms));

function Figure({ label, value, line, warn }: { label: string; value: string; line: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className={cn("mt-1.5 text-xl font-bold tabular-nums", warn ? "text-danger" : "text-ink")}>{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{line}</p>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-muted">
            {head.map((cell, index) => (
              <th key={cell} scope="col" className={cn("px-4 py-2 font-medium", index > 0 && "text-right")}>
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[0])} className="border-b border-line/60 last:border-b-0">
              {row.map((cell, index) => (
                <td key={index} className={cn("px-4 py-2.5 text-ink", index > 0 && "text-right tabular-nums")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cells = (row: Row) => [
  row.runs,
  `${row.approvedAsIs} / ${row.approvedEdited} / ${row.rejected}`,
  pct(row.reworkRate),
  pct(row.failureRate),
  wait(row.approvalMedianMs),
];
const HEAD = ["Runs", "Approved / edited / rejected", "Rework", "Failed", "Approval time"];

/**
 * What is working and what is not - the numbers that should decide the next
 * thing to build, rather than a guess: how long you take to approve, how
 * often work is redone or fails, and how each agent, role and hand-off does.
 */
export function OutcomesPanel({ outcomes }: { outcomes: Outcomes }) {
  const { overall } = outcomes;
  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2>
          <SectionTab>What&apos;s working</SectionTab>
        </h2>
        <p className="mt-0.5 max-w-2xl text-sm text-ink-muted">
          How often work goes out as written, how often it has to be redone or fails, and how long it waits for you - by
          agent, by role and by hand-off.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure label="Approval time" value={wait(overall.approvalMedianMs)} line="Median wait in Needs you" />
        <Figure
          label="Rework rate"
          value={pct(overall.reworkRate)}
          line={`${overall.approvedEdited} edited · ${overall.rejected} rejected`}
          warn={(overall.reworkRate ?? 0) >= 0.4}
        />
        <Figure
          label="Failure rate"
          value={pct(overall.failureRate)}
          line={`${overall.failed} of ${overall.done + overall.failed} finished runs`}
          warn={(overall.failureRate ?? 0) >= 0.2}
        />
        <Figure label="Corrections saved" value={String(outcomes.corrections)} line="Rules kept from edits and rejections" />
      </div>

      {outcomes.byRole.length > 0 ? (
        <Panel className="overflow-hidden">
          <h3 className="px-4 pt-3 text-sm font-semibold text-ink">By role</h3>
          <Table
            head={["Role", "Agents", "Days used", ...HEAD]}
            rows={outcomes.byRole.map((row) => [row.roleName, row.agents, row.activeDays, ...cells(row)])}
          />
        </Panel>
      ) : null}

      {outcomes.byAgent.length > 0 ? (
        <Panel className="overflow-hidden">
          <h3 className="px-4 pt-3 text-sm font-semibold text-ink">By agent</h3>
          <Table head={["Agent", ...HEAD]} rows={outcomes.byAgent.map((row) => [`${row.name} · ${row.role}`, ...cells(row)])} />
        </Panel>
      ) : null}

      {outcomes.byHandoff.length > 0 ? (
        <Panel className="overflow-hidden">
          <h3 className="px-4 pt-3 text-sm font-semibold text-ink">Hand-offs, most reworked first</h3>
          <Table head={["From → to", ...HEAD]} rows={outcomes.byHandoff.map((row) => [`${row.from} → ${row.to}`, ...cells(row)])} />
        </Panel>
      ) : null}
    </section>
  );
}
