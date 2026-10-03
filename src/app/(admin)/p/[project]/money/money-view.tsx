"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { api, errorMessage } from "@/lib/shared/api-client";
import { Page, PageBody, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { ErrorState, LoadingRows } from "@/components/ui/states";
import type { MoneyInsights } from "@/lib/life/money-insights";

type Dto = MoneyInsights & {
  budgetMinor: number | null;
  recent: { id: string; kind: string; payee: string; amountMinor: number; category: string | null; occurredAt: string; status: string | null; source: string }[];
};

const baht = (minor: number, cur: string) => `${Math.round(minor / 100).toLocaleString("en-US")} ${cur}`;
const monthName = (id: string) => new Date(`${id}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short" });

/** Six months of spending as bars; the budget is a dashed line. Values are labelled, so colour is never the only cue. */
function Trend({ data, budget, cur }: { data: Dto["trend"]; budget: number | null; cur: string }) {
  const max = Math.max(1, budget ?? 0, ...data.map((d) => d.spendMinor));
  return (
    <div role="img" aria-label={`Monthly spending, ${data.map((d) => `${monthName(d.month)} ${baht(d.spendMinor, cur)}`).join(", ")}`} className="relative flex h-44 items-end gap-3">
      {budget ? <div className="absolute inset-x-0 border-t border-dashed border-ink-subtle" style={{ bottom: `${(budget / max) * 100}%` }} aria-hidden /> : null}
      {data.map((d) => (
        <div key={d.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs tabular-nums text-ink-muted">{d.spendMinor ? Math.round(d.spendMinor / 100_00) / 10 + "k" : ""}</span>
          <div className="w-full rounded-t-sm bg-accent" style={{ height: `${(d.spendMinor / max) * 80}%` }} />
          <span className="text-xs text-ink-muted">{monthName(d.month)}</span>
        </div>
      ))}
    </div>
  );
}

export function MoneyView({ project }: { project: string }) {
  const client = useQueryClient();
  const key = ["life-money", project];
  const data = useQuery({ queryKey: key, queryFn: () => api<Dto>(`/api/life/money?project=${encodeURIComponent(project)}`) });
  const input = React.useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      const form = new FormData();
      form.set("project", project);
      for (const f of files) form.append("files", f);
      const response = await fetch("/api/life/money", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? "Upload failed.");
      return body as { results: { file: string; added: number; duplicates: number; error?: string }[] };
    },
    onSuccess: ({ results }) => {
      const added = results.reduce((s, r) => s + r.added, 0);
      const failed = results.filter((r) => r.error);
      toast.success(`${added} added`, { description: failed.length ? `${failed.length} file${failed.length > 1 ? "s" : ""} couldn't be read: ${failed[0]!.error}` : undefined });
      void client.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const paid = useMutation({
    mutationFn: (id: string) => api("/api/life/money", { method: "PATCH", body: JSON.stringify({ project, id }) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Page>
      <PageHeader
        title="Money"
        description="Add your bank slips, receipts and bills. They become entries here, worked out in code, with the trend, odd charges and bills at risk."
        actions={
          <>
            <input ref={input} type="file" multiple accept="image/*,.pdf,.csv" className="sr-only" aria-label="Choose slips, bills or statements" onChange={(e) => e.target.files?.length && upload.mutate(e.target.files)} />
            <Button onClick={() => input.current?.click()} disabled={upload.isPending}>
              <ImagePlus aria-hidden />
              {upload.isPending ? "Reading…" : "Add slips or bills"}
            </Button>
          </>
        }
      />
      <PageBody>
        {data.isLoading ? <LoadingRows count={4} /> : data.error ? <ErrorState message={errorMessage(data.error)} onRetry={() => void data.refetch()} /> : data.data ? <Body d={data.data} onPaid={(id) => paid.mutate(id)} /> : null}
      </PageBody>
    </Page>
  );
}

function Body({ d, onPaid }: { d: Dto; onPaid: (id: string) => void }) {
  const empty = d.recent.length === 0;
  if (empty) return <p className="py-10 text-sm text-ink-muted">Nothing here yet. Add a few transfer slips, receipts or a bank CSV to begin.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {d.insights.length > 0 && (
        <Panel className="lg:col-span-2">
          <PanelHeader><PanelTitle>What stands out</PanelTitle></PanelHeader>
          <PanelBody><ul className="space-y-1.5 text-sm text-ink">{d.insights.map((line) => <li key={line}>{line}</li>)}</ul></PanelBody>
        </Panel>
      )}
      <Panel>
        <PanelHeader><PanelTitle>Spending, 6 months</PanelTitle>{d.budgetMinor ? <PanelDescription>Dashed line: your {baht(d.budgetMinor, d.currency)} budget</PanelDescription> : null}</PanelHeader>
        <PanelBody><Trend data={d.trend} budget={d.budgetMinor} cur={d.currency} /></PanelBody>
      </Panel>
      <Panel>
        <PanelHeader><PanelTitle>This month by category</PanelTitle></PanelHeader>
        <PanelBody>
          <ul className="space-y-2.5">
            {d.categories.slice(0, 6).map((c) => (
              <li key={c.category}>
                <div className="flex justify-between text-sm"><span className="text-ink">{c.category}</span><span className="tabular-nums text-ink-muted">{baht(c.minor, d.currency)} · {Math.round(c.share * 100)}%</span></div>
                <div className="mt-1 h-2 rounded-sm bg-surface-3"><div className="h-2 rounded-sm bg-accent" style={{ width: `${c.share * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader><PanelTitle>Bills</PanelTitle><PanelDescription>Marking paid only updates this list. Nothing is paid from here.</PanelDescription></PanelHeader>
        <PanelBody>
          {d.bills.length === 0 ? <p className="text-sm text-ink-muted">No unpaid bills.</p> : (
            <ul className="divide-y divide-line/70">
              {d.bills.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0"><span className="block truncate text-ink">{b.payee}</span><span className="text-xs text-ink-muted">{b.risk === "overdue" ? "Overdue · " : b.risk === "soon" ? "Due soon · " : "Due "}{new Date(b.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></span>
                  <span className="flex items-center gap-2"><span className="tabular-nums">{baht(b.amountMinor, d.currency)}</span><Button size="sm" variant="secondary" onClick={() => onPaid(b.id)}>Paid</Button></span>
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader><PanelTitle>Odd charges</PanelTitle></PanelHeader>
        <PanelBody>
          {d.anomalies.length === 0 ? <p className="text-sm text-ink-muted">Nothing unusual this month.</p> : <ul className="space-y-2 text-sm">{d.anomalies.map((a) => <li key={a.id}><span className="text-ink">{a.payee} · {baht(a.amountMinor, d.currency)}</span><span className="block text-xs text-ink-muted">{a.reason}</span></li>)}</ul>}
        </PanelBody>
      </Panel>
    </div>
  );
}
