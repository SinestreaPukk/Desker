"use client";

import * as React from "react";
import { Building, Copy, CreditCard, Download, Mail, ShieldCheck, Trash2, UserRoundPlus } from "lucide-react";
import { signOut } from "next-auth/react";
import { useSpaceKind } from "@/components/space-kind";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Page, PageBody, PageHeader } from "@/components/page-header";
import { ProjectContextPanel } from "@/components/builder/project-context-panel";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
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
  useUpdateOrganization,
  useRevokeInvite,
  useSetMemberRole,
  type BillingSummary,
} from "@/hooks/use-work-data";
import { ApiError, errorMessage } from "@/lib/api-client";
import { renewalTerms } from "@/lib/billing/plans";
import { formatDateTime, formatRelativeTime, formatTime } from "@/lib/utils";

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
  const kind = useSpaceKind();

  // A personal space has one person in it: no members, no invitations, and
  // no business address. What is left is what they know about you, the plan,
  // and your data.
  if (kind === "personal") {
    return (
      <Page>
        <PageHeader
          title={org.data?.name ?? "Your space"}
          description="Private to you. What your assistants know about you, your plan, and your data."
        />
        <PageBody className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-5">
            <ProjectContextPanel project={project} />
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

  return (
    <Page>
      <PageHeader
        title={org.data?.name ?? "Organisation"}
        description="Who is in this organisation, what they may do, and what it pays for. Shared by every project here."
      />
      <PageBody className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          {/* The same shared context as the roster's, edited from either place. */}
          <ProjectContextPanel project={project} />
          <MembersPanel organizationId={organizationId} currentUserId={currentUserId} isOwner={isOwner} />
          {isAdmin ? <InvitesPanel organizationId={organizationId} isOwner={isOwner} /> : null}
        </div>
        <div className="space-y-5">
          <BillingPanel project={project} isOwner={isOwner} checkoutResult={checkoutResult} />
          {isOwner && org.data ? <RenamePanel organizationId={organizationId} name={org.data.name} /> : null}
          {isOwner && org.data ? (
            <MailingAddressPanel organizationId={organizationId} address={org.data.mailingAddress ?? ""} />
          ) : null}
          <YourDataPanel />
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
  const [removing, setRemoving] = React.useState<{ userId: string; label: string; self: boolean } | null>(null);

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
          <ul className="space-y-1">
            {members.data.map((member) => {
              const isSelf = member.userId === currentUserId;
              return (
                <li key={member.userId} className="group flex flex-wrap items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-surface-2/60 text-sm">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-fg ring-1 ring-accent-line">
                    {(member.name ?? member.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">
                      {member.name ?? member.email}
                      {isSelf ? <span className="ml-1.5 text-xs text-ink-muted font-normal">(you)</span> : null}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {member.email} · joined{" "}
                      <span title={formatDateTime(member.joinedAt)}>
                        {formatRelativeTime(member.joinedAt)}
                      </span>
                    </p>
                  </div>
                  {isOwner ? (
                    <Select
                      value={member.role}
                      onValueChange={(next) =>
                        void act(async () => {
                          await setRole.mutateAsync({ userId: member.userId, role: next });
                          toast.success(`${member.name ?? member.email} is now ${next}`);
                        })
                      }
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
                    <StatusBadge status={member.role} />
                  )}
                  {isOwner || isSelf ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={isSelf ? "Leave organisation" : `Remove ${member.email}`}
                      onClick={() =>
                        setRemoving({ userId: member.userId, label: member.name ?? member.email, self: isSelf })
                      }
                      disabled={remove.isPending}
                      className="text-ink-subtle hover:bg-danger-soft/50 hover:text-danger"
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
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing?.self ? "Leave this organisation?" : `Remove ${removing?.label ?? "this member"}?`}
        description={
          removing?.self
            ? "You lose access to every project here immediately. An owner can invite you back."
            : "They lose access to every project here immediately. You can invite them again later."
        }
        confirmLabel={removing?.self ? "Leave" : "Remove"}
        onConfirm={async () => {
          if (!removing) return;
          await remove.mutateAsync(removing.userId);
          toast.success(removing.self ? "You left the organisation" : `${removing.label} removed`);
          setRemoving(null);
        }}
      />
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
  const [revoking, setRevoking] = React.useState<{ id: string; email: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    try {
      const invite = await create.mutateAsync({ email: email.trim(), role });
      setLast({ url: invite.url, emailed: invite.emailed });
      setEmail("");
      toast.success(invite.emailed ? `Invitation emailed to ${invite.email}` : "Invitation created", {
        description: invite.emailed ? undefined : "Copy the link below and send it yourself.",
      });
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
        <PanelBody className="space-y-5">
          <FormError message={error} />
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field label="Email" htmlFor="invite-email" error={fieldErrors.email?.[0]}>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
              />
            </Field>
            <Field label="Role" htmlFor="invite-role" hint={ROLE_BLURB[role]}>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="invite-role" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  {isOwner ? <SelectItem value="owner">owner</SelectItem> : null}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {last ? (
            <div className="rounded-lg border border-positive-line bg-positive-soft/40 p-3 text-sm">
              <p className="text-ink">
                {last.emailed ? "Invitation emailed. " : "Invitation created - send them this link: "}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-sm border border-line bg-surface px-2 py-1 font-mono text-xs">
                  {last.url}
                </code>
                <Button type="button" size="sm" variant="secondary" onClick={() => void copy(last.url)}>
                  <Copy aria-hidden />
                  {copied === last.url ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          ) : null}

          {invites.isPending ? (
            <LoadingRows count={1} />
          ) : invites.error ? (
            <ErrorState
              message={errorMessage(invites.error)}
              onRetry={() => void invites.refetch()}
              retrying={invites.isRefetching}
            />
          ) : invites.data && invites.data.length > 0 ? (
            <ul className="divide-y divide-line border-t border-line pt-1">
              {invites.data.map((invite) => (
                <li key={invite.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <Mail className="size-4 text-ink-subtle" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-ink">{invite.email}</p>
                    <p className="text-xs text-ink-muted">
                      {invite.role} · expires {formatDateTime(invite.expiresAt)}
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
                    onClick={() => setRevoking(invite)}
                    disabled={revoke.isPending}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-t border-line pt-3 text-xs text-ink-muted">
              No invitations are outstanding. Anyone you invite appears here until they accept.
            </p>
          )}
        </PanelBody>
        <PanelFooter className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            variant={email.trim() ? "primary" : "secondary"}
            disabled={create.isPending || !email.trim()}
          >
            <UserRoundPlus aria-hidden />
            Send invitation
          </Button>
        </PanelFooter>
      </form>
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={`Revoke the invitation for ${revoking?.email ?? ""}?`}
        description="The link they were sent stops working. You can invite them again any time."
        confirmLabel="Revoke"
        onConfirm={async () => {
          if (!revoking) return;
          await revoke.mutateAsync(revoking.id);
          toast.success("Invitation revoked");
          setRevoking(null);
        }}
      />
    </Panel>
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
  const personal = useSpaceKind() === "personal";
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
        <Meter label={personal ? "Assistants switched on" : "Published agents"} used={usage.publishedAgents} limit={plan.limits.publishedAgents} />
        <Meter label="Tasks done on their own" used={usage.actionItems} limit={plan.limits.actionItemsPerMonth} />
        {personal ? null : (
          <Meter label="Chat conversations" used={usage.conversations} limit={plan.limits.conversationsPerMonth} />
        )}
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

/**
 * The postal address at the foot of every email an agent sends. Anti-spam
 * law requires one on email to customers, so agent email waits for it.
 */
function MailingAddressPanel({ organizationId, address }: { organizationId: string; address: string }) {
  const update = useUpdateOrganization(organizationId);
  const [value, setValue] = React.useState(address);
  const [note, setNote] = React.useState<string | null>(null);
  const changed = value.trim() !== address.trim();
  return (
    <Panel>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setNote(null);
          try {
            await update.mutateAsync({ mailingAddress: value.trim() });
            setNote("Saved.");
          } catch (caught) {
            setNote(errorMessage(caught));
          }
        }}
      >
        <PanelHeader>
          <div>
            <PanelTitle>
              <Mail className="mr-1.5 inline size-4 text-accent" aria-hidden />
              Email sender details
            </PanelTitle>
            <PanelDescription>
              Every email an agent sends ends with your business name, this address, and an unsubscribe link. The
              law requires them on email to customers, so agents can&apos;t send email until an address is set.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody>
          <Field label="Business postal address" htmlFor="org-address" hint={note ?? undefined}>
            <Textarea
              id="org-address"
              rows={3}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={"12 Sukhumvit Soi 11\nKhlong Toei Nuea, Bangkok 10110\nThailand"}
            />
          </Field>
        </PanelBody>
        <PanelFooter className="flex justify-end">
          <Button type="submit" size="sm" variant={changed ? "primary" : "secondary"} disabled={update.isPending || !changed}>
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
