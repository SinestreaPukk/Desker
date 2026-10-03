"use client";

import * as React from "react";
import { ArrowRight, Check, Eye, FileText, Hand, History, PenLine, ShieldCheck, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { CONTROL_LABELS, type ControlKind, type FirstRun } from "@/lib/agents/first-run";
import { cn } from "@/lib/shared/utils";

const CONTROL_ICON: Record<ControlKind, typeof Eye> = { sees: Eye, drafts: PenLine, approval: Hand, review: History };

type Decision = "waiting" | "editing" | "approved" | "rejected";

/**
 * One complete run of a first-run workflow on example data, stepped through
 * by the person watching: what it read, what it did, the decision that
 * waits for them - which they can actually make - and what is left behind.
 * Each step shows the control that applies at that moment. Nothing is sent:
 * it is labelled example data from the first line to the last.
 */
export function SampleRun({ run, footer }: { run: FirstRun; footer?: React.ReactNode }) {
  const [shown, setShown] = React.useState(1);
  const [decision, setDecision] = React.useState<Decision>("waiting");
  const [body, setBody] = React.useState(run.decision.body);
  const approvalAt = run.steps.findIndex((step) => step.control.kind === "approval");
  // The run cannot go past the decision until it is made - as in the product.
  const blocked = shown > approvalAt && (decision === "waiting" || decision === "editing");
  const finished = shown >= run.steps.length && !blocked;

  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        <Badge tone="warning">Example data</Badge>
        A real run, step by step, on made-up data. Nothing is sent and nothing changes.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        {/* What it starts from */}
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-surface p-3.5">
            <p className="eyebrow mb-1.5">{run.trigger.label}</p>
            <p className="text-sm text-ink">{run.trigger.text}</p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-3.5">
            <p className="eyebrow mb-1.5 flex items-center gap-1.5">
              <FileText className="size-3.5" aria-hidden />
              {run.material.label}
            </p>
            <ul className="space-y-1 text-sm text-ink">
              {run.material.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* The run */}
        <ol className="space-y-3" aria-live="polite">
          {run.steps.slice(0, shown).map((step, index) => {
            const Icon = CONTROL_ICON[step.control.kind];
            return (
              <li key={step.title} className="rounded-lg border border-line bg-surface p-3.5">
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-fg">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{step.title}</p>
                    <p className="mt-0.5 text-sm text-ink-muted">{step.body}</p>
                    <p className="mt-2 flex items-start gap-2 rounded-md border border-accent-line bg-accent-soft/50 px-2.5 py-2 text-xs text-ink">
                      <Icon className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                      <span>
                        <span className="font-semibold">{CONTROL_LABELS[step.control.kind]}:</span> {step.control.text}
                      </span>
                    </p>
                  </div>
                </div>
                {index === approvalAt ? (
                  <DecisionCard run={run} decision={decision} setDecision={setDecision} body={body} setBody={setBody} />
                ) : null}
              </li>
            );
          })}

          {finished && run.handoff ? (
            <li className="rounded-lg border border-warning-line bg-warning-soft/40 p-3.5">
              <p className="eyebrow mb-1 flex items-center gap-1.5">
                <UserRound className="size-3.5" aria-hidden />
                Meanwhile · {run.handoff.label}
              </p>
              <p className="text-sm text-ink">&ldquo;{run.handoff.text}&rdquo;</p>
              <p className="mt-2 text-sm font-medium text-ink">{run.handoff.reason}</p>
            </li>
          ) : null}
        </ol>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {finished ? (
          <p className="flex items-center gap-2 text-sm text-ink">
            <ShieldCheck className="size-4 text-accent" aria-hidden />
            That&apos;s the whole run: {run.result.charAt(0).toLowerCase() + run.result.slice(1)}
          </p>
        ) : blocked ? (
          <p className="text-sm text-ink-muted">It waits here until you decide - approve, edit or reject above.</p>
        ) : (
          <p className="text-sm text-ink-muted">
            Step {shown} of {run.steps.length}
          </p>
        )}
        {!finished && !blocked ? (
          <Button size="sm" onClick={() => setShown((value) => value + 1)}>
            Next step
            <ArrowRight aria-hidden />
          </Button>
        ) : null}
      </div>
      {finished ? footer : null}
    </div>
  );
}

function DecisionCard({
  run,
  decision,
  setDecision,
  body,
  setBody,
}: {
  run: FirstRun;
  decision: Decision;
  setDecision: (next: Decision) => void;
  body: string;
  setBody: (next: string) => void;
}) {
  const edited = body.trim() !== run.decision.body.trim();
  return (
    <div className="mt-3 rounded-lg border border-warning-line bg-surface-2/60 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">Needs you · {run.decision.label}</p>
        {decision === "approved" ? (
          <Badge tone="positive">Approved{edited ? " with your edit" : ""}</Badge>
        ) : decision === "rejected" ? (
          <Badge tone="danger">Rejected</Badge>
        ) : (
          <Badge tone="warning">Waiting for you</Badge>
        )}
      </div>
      <p className="mt-1.5 text-sm font-semibold text-ink">{run.decision.title}</p>
      {decision === "editing" ? (
        <Textarea
          aria-label="Edit before approving"
          className="mt-2"
          rows={7}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      ) : (
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink">{body}</p>
      )}
      <p className="mt-2 text-xs text-ink-muted">Based on {run.decision.source}</p>

      {decision === "approved" || decision === "rejected" ? (
        <p className={cn("mt-3 text-sm", decision === "approved" ? "text-positive" : "text-ink")}>
          {decision === "approved"
            ? `${run.decision.onApprove} This is example data, so nothing was sent or changed.`
            : "Nothing went out. In a real run, the reason you give can become a rule it follows from then on."}{" "}
          <button type="button" className="font-medium text-accent hover:underline" onClick={() => setDecision("waiting")}>
            Decide again
          </button>
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setDecision("approved")}>
            <Check aria-hidden />
            {decision === "editing" ? "Approve with edit" : "Approve"}
          </Button>
          {decision === "editing" ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setBody(run.decision.body);
                setDecision("waiting");
              }}
            >
              Undo edit
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setDecision("editing")}>
              <PenLine aria-hidden />
              Edit first
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setDecision("rejected")}>
            <X aria-hidden />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
