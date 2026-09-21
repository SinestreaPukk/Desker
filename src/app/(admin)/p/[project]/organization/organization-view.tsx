"use client";

import * as React from "react";
import { Copy, CreditCard, Mail, Trash2, UserPlus, Users } from "lucide-react";
import { Page, PageBody, PageHeader } from "@/components/page-header";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, FormError, LoadingRows } from "@/components/ui/states";
import {
  useBilling,
  useBillingPortal,
  useCheckout,
  useCreateInvite,
  useInvites,
  useMembers,
  useOrganization,
  useRemoveMember,
  useRenameOrganization,
  useRevokeInvite,
  useSetMemberRole,
  type BillingSummary,
} from "@/hooks/use-work-data";
import { ApiError, errorMessage } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";

const ROLE_BLURB: Record<string, string> = {
  owner: "People, billing, everything.",
  admin: "Agents, integrations, trust and approvals.",
  member: "Uses agents, reviews approvals.",
};

export function OrganizationView({
  project,
  organizationId,
  currentUserId,
  checkoutResult,
}: {
  project: string;
  organizationId: string;
  currentUserId: string;
  checkoutResult: string | null;
}) {
  const org = useOrganization(organizationId);
  const role = org.data?.role ?? "member";
  const isOwner = role === "owner";
  const isAdmin = role === "owner" || role === "admin";

  return (
    <Page>
      <PageHeader
        title={org.data?.name ?? "Organization"}
        description="Who is in this organisation, what they may do, and what it pays for. Shared by every project here."
      />
      <PageBody className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          <MembersPanel organizationId={organizationId} currentUserId={currentUserId} isOwner={isOwner} />
          {isAdmin ? <InvitesPanel organizationId={organizationId} isOwner={isOwner} /> : null}
        </div>
        <div className="space-y-5">
          <BillingPanel project={project} isOwner={isOwner} checkoutResult={checkoutResult} />
          {isOwner && org.data ? <RenamePanel organizationId={organizationId} name={org.data.name} /> : null}
        </div>
      </PageBody>
    </Page>
  );
}

function MembersPanel({
  organizationId,
  currentUserId,
  isOwner,
}: {
  organizationId: string;
  currentUserId: string;
  isOwner: boolean;
}) {
  const members = useMembers(organizationId);
  const setRole = useSetMemberRole(organizationId);
  const remove = useRemoveMember(organizationId);
  const [note, setNote] = React.useState<string | null>(null);

  async function act(fn: () => Promise<unknown>) {
    setNote(null);
    try {
      await fn();
    } catch (caught) {
      setNote(errorMessage(caught));
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>Members</PanelTitle>
          <PanelDescription>
            Owners manage people and billing; admins manage agents, integrations and trust; members use
            agents and review approvals.
          </PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody>
        <FormError message={note} />
        {members.isPending ? (
          <LoadingRows count={3} />
        ) : members.error ? (
          <ErrorState message={errorMessage(members.error)} onRetry={() => void members.refetch()} />
        ) : (
          <ul className="divide-y divide-line">
            {members.data.map((member) => {
              const isSelf = member.userId === currentUserId;
              return (
                <li key={member.userId} className="flex flex-wrap items-center gap-3 py-3 text-[0.8125rem]">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">
                      {member.name ?? member.email}
                      {isSelf ? <span className="ml-1.5 text-xs text-ink-subtle">(you)</span> : null}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {member.email} · joined {formatRelativeTime(member.joinedAt)}
                    </p>
                  </div>
                  {isOwner ? (
                    <Select
                      value={member.role}
                      onValueChange={(next) => void act(() => setRole.mutateAsync({ userId: member.userId, role: next }))}
                    >
                      <SelectTrigger aria-label={`Role for ${member.email}`} className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["owner", "admin", "member"].map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge tone={member.role === "owner" ? "accent" : "neutral"}>{member.role}</Badge>
                  )}
                  {isOwner || isSelf ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={isSelf ? "Leave organisation" : `Remove ${member.email}`}
                      onClick={() => void act(() => remove.mutateAsync(member.userId))}
                      disabled={remove.isPending}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}

function InvitesPanel({ organizationId, isOwner }: { organizationId: string; isOwner: boolean }) {
  const invites = useInvites(organizationId);
  const create = useCreateInvite(organizationId);
  const revoke = useRevokeInvite(organizationId);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("member");
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [last, setLast] = React.useState<{ url: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    try {
      const invite = await create.mutateAsync({ email: email.trim(), role });
      setLast({ url: invite.url, emailed: invite.emailed });
      setEmail("");
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else setError(errorMessage(caught));
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked; the link is visible to select */
    }
  }

  return (
    <Panel>
      <form onSubmit={submit}>
        <PanelHeader>
          <div>
            <PanelTitle>Invite a teammate</PanelTitle>
            <PanelDescription>
              They get a link that works for seven days, for their address only. It is emailed when
              the server has an email provider; either way you can copy it.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <FormError message={error} />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Email" htmlFor="invite-email" error={fieldErrors.email?.[0]}>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
              />
            </Field>
            <div>
              <label htmlFor="invite-role" className="text-[0.8125rem] font-medium text-ink">
                Role
              </label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="invite-role" className="mt-1.5 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  {isOwner ? <SelectItem value="owner">owner</SelectItem> : null}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-ink-muted">{ROLE_BLURB[role]}</p>
            </div>
          </div>
          {last ? (
            <div className="rounded-xl border border-positive-line bg-positive-soft/40 p-3 text-[0.8125rem]">
              <p className="text-ink">
                {last.emailed ? "Invitation emailed. " : "Invitation created - send them this link: "}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs">
                  {last.url}
                </code>
                <Button type="button" size="sm" variant="secondary" onClick={() => void copy(last.url)}>
                  <Copy aria-hidden />
                  {copied === last.url ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          ) : null}

          {invites.data && invites.data.length > 0 ? (
            <ul className="divide-y divide-line border-t border-line pt-1">
              {invites.data.map((invite) => (
                <li key={invite.id} className="flex items-center gap-3 py-2.5 text-[0.8125rem]">
                  <Mail className="size-4 text-ink-subtle" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-ink">{invite.email}</p>
                    <p className="text-xs text-ink-muted">
                      {invite.role} · expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void copy(invite.url)}>
                    <Copy aria-hidden />
                    {copied === invite.url ? "Copied" : "Copy link"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Revoke invitation for ${invite.email}`}
                    onClick={() => revoke.mutate(invite.id)}
                    disabled={revoke.isPending}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </PanelBody>
        <PanelFooter className="flex justify-end">
          <Button type="submit" size="sm" disabled={create.isPending || !email.trim()}>
            <UserPlus aria-hidden />
            Send invitation
          </Button>
        </PanelFooter>
      </form>
    </Panel>
  );
}

function Meter({ label, used, limit, money }: { label: string; used: number; limit: number; money?: boolean }) {
  const unlimited = limit >= Number.MAX_SAFE_INTEGER;
  const ratio = unlimited || limit <= 0 ? 0 : Math.min(used / limit, 1);
  const fmt = (n: number) => (money ? `$${n.toFixed(2)}` : n.toLocaleString());
  if (unlimited) {
    return (
      <div className="flex items-baseline justify-between text-[0.8125rem]">
        <span className="text-ink">{label}</span>
        <span className="tabular-nums text-ink-muted">{fmt(used)} · no limit</span>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-baseline justify-between text-[0.8125rem]">
        <span className="text-ink">{label}</span>
        <span className={`tabular-nums ${ratio >= 1 ? "text-danger" : "text-ink-muted"}`}>
          {fmt(used)} / {fmt(limit)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className={`h-full rounded-full ${ratio >= 1 ? "bg-danger" : ratio >= 0.8 ? "bg-warning" : "bg-accent"}`}
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
              {data.currentPeriodEnd ? ` · renews ${formatRelativeTime(data.currentPeriodEnd)}` : ""}
            </PanelDescription>
          </div>
          <Badge tone={plan.id === "free" ? "neutral" : "accent"}>{plan.name}</Badge>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <FormError message={note} />
        <p className="text-xs text-ink-muted">Usage this month ({usage.period}). Limits are enforced on the server.</p>
        <Meter label="Published agents" used={usage.publishedAgents} limit={plan.limits.publishedAgents} />
        <Meter label="Runs" used={usage.actionItems} limit={plan.limits.actionItemsPerMonth} />
        <Meter label="Conversations" used={usage.conversations} limit={plan.limits.conversationsPerMonth} />
        <Meter label="Model spend" used={usage.modelCostUsd} limit={plan.limits.modelCostUsdPerMonth} money />
        <p className="text-xs text-ink-subtle">
          {(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens · {usage.searches} web searches
          {plan.limits.runsPerHour < Number.MAX_SAFE_INTEGER
            ? ` · rate: ${plan.limits.runsPerHour} runs/hour, ${plan.limits.chatMessagesPerMinute} client messages/minute`
            : ""}
        </p>

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
                    <div key={p.id} className={`rounded-xl border p-3 ${p.id === plan.id ? "border-accent bg-accent-soft/30" : "border-line"}`}>
                      <p className="text-[0.8125rem] font-medium text-ink">
                        {p.name} <span className="text-ink-muted">· ${p.priceUsd}/mo</span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">{p.blurb}</p>
                      <p className="mt-1 text-xs text-ink-subtle">
                        {p.limits.publishedAgents} agents · {p.limits.actionItemsPerMonth.toLocaleString()} runs ·{" "}
                        {p.limits.conversationsPerMonth.toLocaleString()} conversations · ${p.limits.modelCostUsdPerMonth} model budget
                      </p>
                      {p.id !== plan.id && p.purchasable ? (
                        <Button
                          size="sm"
                          className="mt-2"
                          onClick={() => void go(() => checkout.mutateAsync(p.id as "starter" | "growth"))}
                          disabled={checkout.isPending}
                        >
                          {plan.id === "free" ? "Choose" : "Switch to"} {p.name}
                        </Button>
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
                Manage billing
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

function RenamePanel({ organizationId, name }: { organizationId: string; name: string }) {
  const rename = useRenameOrganization(organizationId);
  const [value, setValue] = React.useState(name);
  const [note, setNote] = React.useState<string | null>(null);
  return (
    <Panel>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setNote(null);
          try {
            await rename.mutateAsync(value.trim());
            setNote("Saved.");
          } catch (caught) {
            setNote(errorMessage(caught));
          }
        }}
      >
        <PanelHeader>
          <div>
            <PanelTitle>
              <Users className="mr-1.5 inline size-4 text-accent" aria-hidden />
              Name
            </PanelTitle>
          </div>
        </PanelHeader>
        <PanelBody>
          <Field label="Organisation name" htmlFor="org-name" hint={note ?? undefined}>
            <Input id="org-name" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        </PanelBody>
        <PanelFooter className="flex justify-end">
          <Button type="submit" size="sm" disabled={rename.isPending || !value.trim() || value.trim() === name}>
            Save
          </Button>
        </PanelFooter>
      </form>
    </Panel>
  );
}
