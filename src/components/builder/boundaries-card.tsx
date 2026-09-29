"use client";

import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { useScope } from "@/hooks/use-work-data";
import { describeBoundaries } from "@/lib/work/boundaries";

/**
 * "It can / It can't", on the agent's page whatever section is open: the
 * answer to "what will this thing do without me?" should never be a setting
 * the owner has to go and find. Read from the scope the runner enforces.
 */
export function BoundariesCard({
  agentId,
  escalationRule,
  onEdit,
}: {
  agentId: string;
  /** Every run is told to follow it, so it belongs with the limits. */
  escalationRule: string | null;
  onEdit: () => void;
}) {
  const scope = useScope(agentId);
  if (!scope.data) return null;
  const { can, cannot } = describeBoundaries(scope.data);

  return (
    <Note tone="mint" aria-labelledby="boundaries-title" className="px-4 py-3.5 text-note-ink">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 shrink-0 text-accent" aria-hidden />
        <h2 id="boundaries-title" className="flex-1 text-sm font-semibold text-ink">
          What it does on its own
        </h2>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Change
        </Button>
      </div>
      <div className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <List title="It can" items={can} tone="can" />
        <List title="It can't" items={cannot} tone="cannot" />
      </div>
      {escalationRule?.trim() ? (
        <p className="mt-3 border-t border-line pt-2.5 text-xs text-ink-muted">
          <span className="font-medium text-ink">It stops and asks you when:</span> {escalationRule.trim()}
        </p>
      ) : null}
    </Note>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: "can" | "cannot" }) {
  const Icon = tone === "can" ? Check : X;
  return (
    <div>
      <h3 className="eyebrow mb-1.5">{title}</h3>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink">
            <Icon
              className={tone === "can" ? "mt-0.5 size-3.5 shrink-0 text-positive" : "mt-0.5 size-3.5 shrink-0 text-danger"}
              aria-hidden
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
