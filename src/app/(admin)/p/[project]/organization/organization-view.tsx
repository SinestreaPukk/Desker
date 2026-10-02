"use client";

import * as React from "react";
import { Building, CreditCard, Download, ShieldCheck, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { api } from "@/lib/api-client";
import { Page, PageBody, PageHeader } from "@/components/page-header";
import { ProjectContextPanel } from "@/components/builder/project-context-panel";
import { CheckInSettingsPanel } from "@/components/work/check-in-settings-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import { EmptyState, ErrorState, FormError, LoadingRows } from "@/components/ui/states";
import {
  useBilling,
  useBillingPortal,
  useCheckout,
  useOrganization,
  useUpdateOrganization,
  type BillingSummary,
} from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import { renewalTerms } from "@/lib/billing/plans";
import { formatDateTime } from "@/lib/utils";

export function OrganizationView({
  project,
  organizationId,
  checkoutResult,
}: {
  project: string;
  organizationId: string;
  checkoutResult: string | null;
}) {
  const org = useOrganization(organizationId);
  const role = org.data?.role ?? "member";
  const isOwner = role === "owner";

  return (
    <Page>
      <PageHeader
        title={org.data?.name ?? "Your space"}
        description="Private to you. What your assistants know about you, your plan, and your data."
      />
      <PageBody className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          <ProjectContextPanel project={project} />
          <CheckInSettingsPanel project={project} />
          <PrivacyPanel />
        </div>
        <div className="space-y-5">
          <BillingPanel project={project} isOwner={isOwner} checkoutResult={checkoutResult} />
          {isOwner && org.data ? <RenamePanel organizationId={organizationId} name={org.data.name} label="Space name" /> : null}
          <YourDataPanel />
        </div>
      </PageBody>
    </Page>
  );
}

function Meter({ label, used, limit, money }: { label: string; used: number; limit: number; money?: boolean }) {
  const unlimited = limit >= Number.MAX_SAFE_INTEGER;
  const ratio = unlimited || limit <= 0 ? 0 : Math.min(used / limit, 1);
  const fmt = (n: number) => (money ? `$${n.toFixed(2)}` : n.toLocaleString());
  if (unlimited) {
    return (
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="tabular-nums font-mono text-xs text-ink-muted">{fmt(used)} · no limit</span>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className={`tabular-nums font-mono text-xs ${ratio >= 1 ? "font-semibold text-danger" : "text-ink-muted"}`}>
          {fmt(used)} / {fmt(limit)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-3">
        <div
          className={`h-full rounded-full transition duration-500 ${ratio >= 1 ? "bg-danger" : ratio >= 0.8 ? "bg-warning" : "bg-accent"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

function BillingPanel({
  project,
  isOwner,
  checkoutResult,
}: {
  project: string;
  isOwner: boolean;
  checkoutResult: string | null;
}) {
  const billing = useBilling(project);
  const checkout = useCheckout(project);
  const portal = useBillingPortal(project);
  const [note, setNote] = React.useState<string | null>(
    checkoutResult === "success"
      ? "Payment received. The plan updates as soon as Stripe confirms it - usually within seconds."
      : checkoutResult === "cancelled"
        ? "Checkout cancelled; nothing was charged."
        : null,
  );

  async function go(fn: () => Promise<{ url: string }>) {
    setNote(null);
    try {
      const { url } = await fn();
      window.location.assign(url);
    } catch (caught) {
      setNote(errorMessage(caught));
    }
  }

  if (billing.isPending) {
    return (
      <Panel>
        <PanelBody>
          <LoadingRows count={3} />
        </PanelBody>
      </Panel>
    );
  }
  if (billing.error) {
    return (
      <Panel>
        <PanelBody>
          <ErrorState message={errorMessage(billing.error)} onRetry={() => void billing.refetch()} />
        </PanelBody>
      </Panel>
    );
  }
  const data: BillingSummary = billing.data;
  const { plan, usage } = data;

  return (
    <Panel>
      <PanelHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <PanelTitle>Billing</PanelTitle>
            <PanelDescription>
              {plan.name} plan{plan.priceUsd > 0 ? ` · $${plan.priceUsd}/month` : ""}
              {data.subscriptionStatus && data.subscriptionStatus !== "active"
                ? ` · ${data.subscriptionStatus.replace("_", " ")}`
                : ""}
              {data.currentPeriodEnd ? ` · renews ${formatDateTime(data.currentPeriodEnd)}` : ""}
            </PanelDescription>
          </div>
          <Badge tone={plan.id === "free" ? "neutral" : "accent"}>{plan.name}</Badge>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <FormError message={note} />
        <p className="text-xs text-ink-muted">
          What you have used this month. Anything past a limit is refused rather than billed.
        </p>
        <Meter label={"Assistants switched on"} used={usage.publishedAgents} limit={plan.limits.publishedAgents} />
        <Meter label="Tasks done on their own" used={usage.actionItems} limit={plan.limits.actionItemsPerMonth} />
        <Meter label="Estimated cost of the work" used={usage.modelCostUsd} limit={plan.limits.modelCostUsdPerMonth} money />
        {plan.limits.runsPerHour < Number.MAX_SAFE_INTEGER ? (
          <p className="text-xs text-ink-muted">
            Busy periods are smoothed out: up to {plan.limits.runsPerHour} tasks an hour and{" "}
            {plan.limits.chatMessagesPerMinute} chat messages a minute.
          </p>
        ) : null}
        {/* The figures behind the estimate, for whoever is checking an invoice. */}
        <details className="text-xs">
          <summary className="cursor-pointer text-ink-muted hover:text-ink">
            View technical details
          </summary>
          <p className="mt-1.5 rounded-md border border-line bg-surface-2/60 p-2.5 text-ink-muted">
            {usage.period} · {(usage.inputTokens + usage.outputTokens).toLocaleString()} model tokens ·{" "}
            {usage.searches} web searches. Limits are enforced on the server.
          </p>
        </details>

        {isOwner ? (
          <div className="border-t border-line pt-4">
            {!data.stripeConfigured ? (
              <EmptyState
                icon={CreditCard}
                title="Billing is not connected on this server"
                description="This is a self-hosted deployment: there is nothing to upgrade to, so no limits apply. Configure Stripe to sell plans."
                className="py-6"
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {data.plans
                  .filter((p) => p.id !== "free")
                  .map((p) => (
                    <div key={p.id} className={`rounded-lg border p-3 ${p.id === plan.id ? "border-accent bg-accent-soft/30" : "border-line"}`}>
                      <p className="text-sm font-medium text-ink">
                        {p.name}{" "}
                        <span className="text-ink-muted">
                          ·{" "}
                          {p.originalPriceUsd ? (
                            <span className="line-through decoration-line-strong mr-1 text-ink-muted/80">
                              <span className="sr-only">Original price: </span>
                              ${p.originalPriceUsd}
                            </span>
                          ) : null}
                          ${p.priceUsd}/mo
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">{p.blurb}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {p.limits.publishedAgents} agents · {p.limits.actionItemsPerMonth.toLocaleString()} runs ·{" "}
                        {p.limits.conversationsPerMonth.toLocaleString()} conversations · ${p.limits.modelCostUsdPerMonth} model budget
                      </p>
                      {p.id !== plan.id && p.purchasable ? (
                        <>
                        <p className="mt-2 text-xs text-ink">{renewalTerms(p)}</p>
                        <Button
                          size="sm"
                          className="mt-2"
                          onClick={() => void go(() => checkout.mutateAsync(p.id as "starter" | "growth"))}
                          disabled={checkout.isPending}
                        >
                          {plan.id === "free" ? "Choose" : "Switch to"} {p.name}
                        </Button>
                        </>
                      ) : null}
                    </div>
                  ))}
              </div>
            )}
            {data.hasPaymentMethod ? (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => void go(() => portal.mutateAsync())}
                disabled={portal.isPending}
              >
                <CreditCard aria-hidden />
                Manage or cancel billing
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-ink-muted">Only an owner can change the plan.</p>
        )}
      </PanelBody>
    </Panel>
  );
}

function RenamePanel({ organizationId, name, label = "Organisation name" }: { organizationId: string; name: string; label?: string }) {
  const rename = useUpdateOrganization(organizationId);
  const [value, setValue] = React.useState(name);
  const [note, setNote] = React.useState<string | null>(null);
  return (
    <Panel>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setNote(null);
          try {
            await rename.mutateAsync({ name: value.trim() });
            setNote("Saved.");
          } catch (caught) {
            setNote(errorMessage(caught));
          }
        }}
      >
        <PanelHeader>
          <div>
            <PanelTitle>
              <Building className="mr-1.5 inline size-4 text-accent" aria-hidden />
              Name
            </PanelTitle>
          </div>
        </PanelHeader>
        <PanelBody>
          <Field label={label} htmlFor="org-name" hint={note ?? undefined}>
            <Input id="org-name" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        </PanelBody>
        <PanelFooter className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            variant={value.trim() && value.trim() !== name ? "primary" : "secondary"}
            disabled={rename.isPending || !value.trim() || value.trim() === name}
          >
            Save
          </Button>
        </PanelFooter>
      </form>
    </Panel>
  );
}

/** What a personal space promises, in plain words: each line is enforced in code, not policy alone. */
function PrivacyPanel() {
  const promises = [
    "Only you can open this space. Nobody can be invited into it.",
    "Your assistants have no public chat link or widget.",
    "Nothing leaves without your yes: every email and post waits for your approval.",
    "Statements are added up on our server, and account and card numbers are masked before any AI reads them.",
    "What you share is never used to train AI models, and never sold.",
  ];
  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>
            <ShieldCheck className="mr-1.5 inline size-4 text-accent" aria-hidden />
            Private by design
          </PanelTitle>
          <PanelDescription>How this space keeps your life your own.</PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody>
        <ul className="space-y-2 text-sm text-ink">
          {promises.map((line) => (
            <li key={line} className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  );
}

/**
 * The two data rights, as buttons rather than an email to write: download
 * everything, or delete the account with every space it solely owns.
 */
function YourDataPanel() {
  const [confirming, setConfirming] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function remove() {
    setError(null);
    setDeleting(true);
    try {
      await api("/api/account", { method: "DELETE", body: JSON.stringify({ confirmEmail: email }) });
      await signOut({ callbackUrl: "/" });
    } catch (caught) {
      setError(errorMessage(caught));
      setDeleting(false);
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>
            <Download className="mr-1.5 inline size-4 text-accent" aria-hidden />
            Your data
          </PanelTitle>
          <PanelDescription>
            Everything in your account and the spaces you own. Take a copy any time, or delete it all.
          </PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/account"
            download
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:border-accent-line"
          >
            <Download className="size-4" aria-hidden />
            Download my data
          </a>
          <Button variant="secondary" size="sm" onClick={() => setConfirming((open) => !open)} aria-expanded={confirming}>
            <Trash2 aria-hidden />
            Delete my account
          </Button>
        </div>
        {confirming ? (
          <div className="space-y-3 rounded-lg border border-danger/40 p-3">
            <p className="text-sm text-ink">
              This deletes your account and every space you alone own: assistants, documents, chats, drafts and history.
              It can&apos;t be undone. Download your data first if you want a copy.
            </p>
            <FormError message={error} />
            <Field label="Type your email address to confirm" htmlFor="confirm-delete">
              <Input id="confirm-delete" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button variant="danger" size="sm" loading={deleting} disabled={!email.trim()} onClick={() => void remove()}>
              Delete everything
            </Button>
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
