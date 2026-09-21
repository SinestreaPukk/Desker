"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Inbox, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Switch } from "@/components/ui/switch";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { ThemeToggle } from "@/components/theme-toggle";

const COLOR_PAIRS: { fg: string; bg: string; use: string; min: number }[] = [
  { fg: "--ink", bg: "--paper", use: "Body text on the page", min: 4.5 },
  { fg: "--ink", bg: "--surface", use: "Body text on a panel", min: 4.5 },
  { fg: "--ink-muted", bg: "--surface", use: "Secondary text", min: 4.5 },
  { fg: "--ink-subtle", bg: "--surface", use: "Metadata (large / uppercase)", min: 3 },
  { fg: "--accent-fg", bg: "--accent", use: "Primary button label", min: 4.5 },
  { fg: "--accent-soft-fg", bg: "--accent-soft", use: "Accent badge", min: 4.5 },
  { fg: "--positive", bg: "--positive-soft", use: "Positive badge", min: 4.5 },
  { fg: "--warning", bg: "--warning-soft", use: "Warning badge", min: 4.5 },
  { fg: "--danger", bg: "--danger-soft", use: "Danger badge", min: 4.5 },
  { fg: "--accent", bg: "--surface", use: "Links", min: 4.5 },
  // The landing page's stage: identical in both themes.
  { fg: "--stage-ink", bg: "--stage", use: "Stage: headline and body", min: 4.5 },
  { fg: "--stage-muted", bg: "--stage", use: "Stage: sub-line, labels", min: 4.5 },
  { fg: "--glow-text-a", bg: "--stage", use: "Stage: gradient word, light stop (72px+)", min: 3 },
  { fg: "--glow-text-b", bg: "--stage", use: "Stage: gradient word, dark stop (72px+)", min: 3 },
];

const TYPE = [
  { cls: "text-xs", name: "xs · 12px", use: "Badges, metadata, helper lines" },
  { cls: "text-sm", name: "sm · 13px", use: "UI body: forms, lists, tables" },
  { cls: "text-base", name: "base · 15px", use: "Reading: transcripts, drafts, marketing body" },
  { cls: "text-lg", name: "lg · 18px", use: "Section and panel titles" },
  { cls: "text-xl", name: "xl · 24px", use: "Page titles" },
  { cls: "text-display", name: "display · 44px", use: "Public site section headings" },
  { cls: "font-display text-hero", name: "hero · 56-120px", use: "Landing hero and closing call only" },
];

const SPACING = [2, 4, 6, 8, 12, 16];
const RADII = [
  { cls: "rounded-sm", name: "sm", use: "Checkboxes, inline code, chips" },
  { cls: "rounded-md", name: "md", use: "Buttons, inputs, list rows" },
  { cls: "rounded-lg", name: "lg", use: "Blocks inside a panel" },
  { cls: "rounded-panel", name: "panel", use: "Cards, panels, dialogs" },
];
const SHADOWS = [
  { cls: "shadow-xs", name: "xs", use: "Resting cards" },
  { cls: "shadow-sm", name: "sm", use: "Hover, popovers" },
  { cls: "shadow-md", name: "md", use: "Dialogs" },
];

function luminance([r, g, b]: number[]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
}

/** Resolves a CSS variable to sRGB by painting it - works for oklch(). */
function useContrast() {
  const [ratios, setRatios] = React.useState<Record<string, number>>({});
  const compute = React.useCallback(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const style = getComputedStyle(document.documentElement);
    const rgb = (variable: string) => {
      ctx.fillStyle = "#000";
      ctx.fillStyle = style.getPropertyValue(variable).trim();
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const next: Record<string, number> = {};
    for (const pair of COLOR_PAIRS) {
      const a = luminance(rgb(pair.fg));
      const b = luminance(rgb(pair.bg));
      next[`${pair.fg}/${pair.bg}`] = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }
    setRatios(next);
  }, []);
  React.useEffect(() => {
    // Deferred so the paint-based measurement runs after the theme class is
    // applied; a MutationObserver re-measures on theme change.
    const id = requestAnimationFrame(compute);
    const observer = new MutationObserver(() => requestAnimationFrame(compute));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      cancelAnimationFrame(id);
      observer.disconnect();
    };
  }, [compute]);
  return ratios;
}

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="text-sm text-ink-muted">{blurb}</p>
      </div>
      {children}
    </section>
  );
}

export function DesignSystem() {
  const ratios = useContrast();
  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="meta">Internal</p>
          <h1 className="mt-1 text-xl font-semibold text-ink">Design system</h1>
          <p className="mt-2 max-w-2xl text-base text-ink-muted">
            Every screen is built from these tokens and components. If something you need is not
            here, add it here first, then use it. Contrast is computed live for the theme you are
            looking at - switch themes to check the other.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Colour" blurb="One accent, a few neutrals, three semantic tones. Each pair checked against WCAG AA.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3 text-left meta">Sample</th>
                <th className="py-2 pr-3 text-left meta">Pair</th>
                <th className="py-2 pr-3 text-left meta">Use</th>
                <th className="py-2 pr-3 text-right meta">Ratio</th>
                <th className="py-2 text-right meta">AA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {COLOR_PAIRS.map((pair) => {
                const ratio = ratios[`${pair.fg}/${pair.bg}`];
                const ok = ratio !== undefined && ratio >= pair.min;
                return (
                  <tr key={pair.use}>
                    <td className="py-2 pr-3">
                      <span
                        className="inline-block rounded-md border border-line px-3 py-1.5 font-medium"
                        style={{ color: `var(${pair.fg})`, background: `var(${pair.bg})` }}
                      >
                        Aa
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-ink-muted">
                      {pair.fg} on {pair.bg}
                    </td>
                    <td className="py-2 pr-3 text-ink">{pair.use}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-ink">{ratio ? ratio.toFixed(2) : "…"}</td>
                    <td className="py-2 text-right">
                      {ratio ? <Badge tone={ok ? "positive" : "danger"}>{ok ? `≥ ${pair.min}` : "fail"}</Badge> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Type" blurb="Five product sizes, plus display and hero for the public site. Weight and colour carry hierarchy within a size; a new size is a design-system change, not a page change. Product screens use the sans; public-site headlines use the display face.">
        <Panel className="divide-y divide-line">
          {TYPE.map((t) => (
            <div key={t.cls} className="grid gap-2 p-4 sm:grid-cols-[10rem_1fr_14rem] sm:items-baseline">
              <span className="font-mono text-xs text-ink-muted">{t.name}</span>
              <span className={`${t.cls} text-ink`}>The quick brown fox hires a careful agent.</span>
              <span className="text-xs text-ink-subtle">{t.use}</span>
            </div>
          ))}
        </Panel>
      </Section>

      <Section title="Spacing" blurb="An 8px grid. Compact controls may use the 4px half-step (p-1, gap-1); layout never does.">
        <div className="flex flex-wrap items-end gap-6">
          {SPACING.map((n) => (
            <div key={n} className="text-center">
              <div className="mx-auto bg-accent-soft" style={{ width: n * 4, height: n * 4 }} />
              <p className="mt-2 font-mono text-xs text-ink-muted">{n * 4}px · {n}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-8 md:grid-cols-2">
        <Section title="Radius" blurb="Four steps. Nested things step down.">
          <div className="flex flex-wrap gap-4">
            {RADII.map((r) => (
              <div key={r.cls} className="text-center">
                <div className={`size-16 border border-line-strong bg-surface ${r.cls}`} />
                <p className="mt-2 font-mono text-xs text-ink-muted">{r.name}</p>
                <p className="text-xs text-ink-subtle">{r.use}</p>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Shadow" blurb="Three steps, tinted with the brand hue.">
          <div className="flex flex-wrap gap-6">
            {SHADOWS.map((s) => (
              <div key={s.cls} className="text-center">
                <div className={`size-16 rounded-panel bg-surface ${s.cls}`} />
                <p className="mt-2 font-mono text-xs text-ink-muted">{s.name}</p>
                <p className="text-xs text-ink-subtle">{s.use}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Buttons" blurb="One primary action per screen. Secondary for the alternative, ghost for the incidental, danger only for the irreversible.">
        <Panel>
          <PanelBody className="flex flex-wrap items-center gap-3">
            <Button>
              <Plus aria-hidden />
              Primary
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="danger">
              <Trash2 aria-hidden />
              Danger
            </Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button loading>Working</Button>
            <Button disabled>Disabled</Button>
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Status badges" blurb="Every status in the app renders through StatusBadge, so a state looks the same in a list, a card and a detail page.">
        <Panel>
          <PanelBody className="flex flex-wrap items-center gap-2">
            {[
              "draft", "published", "open", "escalated", "resolved", "ready", "pending",
              "queued", "in_progress", "needs_approval", "approved", "executing_external", "done", "failed", "rejected",
              "sent", "owner", "admin", "member",
            ].map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Form controls" blurb="Label above, hint below, error replaces the hint. One focus ring everywhere.">
        <Panel>
          <PanelBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="ds-name" required hint="What clients will call the agent.">
              <Input id="ds-name" placeholder="Mia" />
            </Field>
            <Field label="Email" htmlFor="ds-email" error="Enter a valid email address.">
              <Input id="ds-email" defaultValue="not-an-email" />
            </Field>
            <Field label="Personality" htmlFor="ds-personality" className="sm:col-span-2">
              <Textarea id="ds-personality" rows={3} placeholder="Warm but efficient…" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox defaultChecked /> A checkbox
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <Switch defaultChecked /> A switch
            </label>
          </PanelBody>
        </Panel>
      </Section>

      <Section
        title="Landing stage"
        blurb="The one place the accent is loud. A near-black section that stays dark in both themes, three drifting blobs behind it, the display face, and a gradient on the words that matter. Nothing in the product uses these."
      >
        <div className="stage relative overflow-hidden rounded-panel p-8">
          <div className="aurora" aria-hidden>
            <i />
            <i />
            <i />
          </div>
          <div className="grain" aria-hidden />
          <div className="relative">
            <p className="font-mono text-xs uppercase tracking-wider text-[var(--glow-text-a)]">Eyebrow</p>
            <p className="mt-3 font-display text-hero text-[var(--stage-ink)]">
              Keep the <span className="glow-text">final say.</span>
            </p>
            <p className="mt-4 max-w-md text-lg text-[var(--stage-muted)]">Sub-line in stage-muted, one sentence.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="lift inline-flex h-12 items-center rounded-md bg-[var(--stage-ink)] px-6 text-base font-semibold text-[var(--stage)] shadow-[0_0_48px_-10px_var(--glow)]">
                Stage button
              </span>
              <span className="lift inline-flex h-12 items-center rounded-md border border-[var(--stage-line)] px-6 text-base font-medium text-[var(--stage-ink)]">
                Secondary
              </span>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              {["--stage", "--stage-surface", "--glow", "--glow-cool", "--glow-hot", "--glow-text-a", "--glow-text-b", "--stage-line"].map((token) => (
                <div key={token} className="flex items-center gap-2 text-[var(--stage-muted)]">
                  <span className="size-5 shrink-0 rounded-sm border border-[var(--stage-line)]" style={{ background: `var(${token})` }} />
                  <dt className="font-mono">{token}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      <Section title="Feedback" blurb="Every action answers: a toast for the outcome, a skeleton while loading, an empty state that says what to do next.">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel>
            <PanelHeader>
              <div>
                <PanelTitle>Toasts</PanelTitle>
                <PanelDescription>Success confirms; errors explain; destructive actions offer undo.</PanelDescription>
              </div>
            </PanelHeader>
            <PanelBody className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => toast.success("Agent published", { description: "Clients can reach Mia at her link." })}>
                Success
              </Button>
              <Button size="sm" variant="secondary" onClick={() => toast.error("Could not publish", { description: "The Free plan allows 1 published agent." })}>
                Error
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  toast("Agent unpublished", {
                    description: "Her link stops working now.",
                    action: { label: "Undo", onClick: () => toast.success("Published again") },
                  })
                }
              >
                With undo
              </Button>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader>
              <div>
                <PanelTitle>Loading</PanelTitle>
                <PanelDescription>Skeletons hold the layout; nothing jumps when data lands.</PanelDescription>
              </div>
            </PanelHeader>
            <PanelBody className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10" />
            </PanelBody>
          </Panel>
        </div>
        <EmptyState
          icon={Inbox}
          title="Nothing waiting for approval"
          description="When an agent is ready to publish or send, it lands here with the full text."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="#">
                <Check aria-hidden />
                A suggested next step
              </Link>
            </Button>
          }
        />
      </Section>
    </div>
  );
}
