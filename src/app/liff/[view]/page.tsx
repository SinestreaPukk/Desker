"use client";

import * as React from "react";
import { useParams } from "next/navigation";

declare global {
  interface Window {
    liff?: { init(o: { liffId: string }): Promise<void>; isLoggedIn(): boolean; login(): void; getIDToken(): string | null };
  }
}

type Budget = { currency: string; spendMinor: number; budgetMinor: number | null; insights: string[]; bills: { id: string; payee: string; amountMinor: number; dueAt: string; risk: string }[] };
type Digest = { title: string; body: string };

const money = (minor: number, cur: string) => `${Math.round(minor / 100).toLocaleString("en-US")} ${cur}`;

/** The LINE mini-app: a budget snapshot and the weekly digest, same data as the web, read through the LINE ID token. */
export default function LiffView() {
  const { view } = useParams<{ view: string }>();
  const [data, setData] = React.useState<Budget | Digest | null>(null);
  const [failure, setError] = React.useState<string | null>(null);
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const error = liffId ? failure : "LIFF isn't set up on this server yet.";

  React.useEffect(() => {
    if (!liffId) return;
    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    script.onload = async () => {
      try {
        await window.liff!.init({ liffId });
        if (!window.liff!.isLoggedIn()) return window.liff!.login();
        const r = await fetch(`/api/liff/${view}`, { headers: { authorization: `Bearer ${window.liff!.getIDToken()}` } });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Couldn't load.");
        setData(body);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load.");
      }
    };
    document.body.appendChild(script);
    return () => script.remove();
  }, [view, liffId]);

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-paper px-4 py-6 text-ink">
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : !data ? <p className="text-sm text-ink-muted">Loading…</p> : view === "digest" ? <DigestCard d={data as Digest} /> : <BudgetCard d={data as Budget} />}
    </main>
  );
}

function BudgetCard({ d }: { d: Budget }) {
  const pct = d.budgetMinor ? Math.min(100, Math.round((d.spendMinor / d.budgetMinor) * 100)) : 0;
  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs text-ink-muted">This month</p>
        <p className="text-xl font-semibold tabular-nums">{money(d.spendMinor, d.currency)}</p>
        {d.budgetMinor ? <p className="text-sm text-ink-muted">of {money(d.budgetMinor, d.currency)} · {pct}%</p> : null}
      </header>
      {d.budgetMinor ? <div className="h-2 rounded-sm bg-surface-3"><div className="h-2 rounded-sm bg-accent" style={{ width: `${Math.max(pct, 2)}%` }} /></div> : null}
      {d.insights.length ? <ul className="space-y-1.5 text-sm">{d.insights.map((i) => <li key={i}>{i}</li>)}</ul> : null}
      {d.bills.length ? (
        <section>
          <h2 className="mb-1 text-sm font-semibold">Bills</h2>
          <ul className="divide-y divide-line/70 text-sm">{d.bills.map((b) => <li key={b.id} className="flex justify-between py-2"><span>{b.payee}<span className="block text-xs text-ink-muted">{b.risk === "overdue" ? "Overdue · " : "Due "}{new Date(b.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></span><span className="tabular-nums">{money(b.amountMinor, d.currency)}</span></li>)}</ul>
        </section>
      ) : null}
    </div>
  );
}

function DigestCard({ d }: { d: Digest }) {
  return (
    <article className="space-y-3">
      <h1 className="text-xl font-semibold">{d.title}</h1>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{d.body}</p>
    </article>
  );
}
