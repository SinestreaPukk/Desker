"use client";

import * as React from "react";
import { Blocks, CheckCircle2, ChevronRight, Mail, MinusCircle, Plug, Trash2, TriangleAlert, Webhook } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { EmptyState, ErrorState, FormError, LoadingRows } from "@/components/ui/states";
import {
  useCreateIntegration,
  useDeleteIntegration,
  useIntegrations,
  useOAuthProviders,
} from "@/hooks/use-work-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConnectorCard } from "@/components/integrations/connector-card";
import { CONNECTORS, CONNECTOR_CATEGORIES, connectorById } from "@/lib/integrations/catalog";
import { TEMPLATES } from "@/lib/content";
import { useSpaceKind } from "@/components/space-kind";
import { SupportInboxForm } from "@/components/integrations/support-inbox-form";
import { ApiError, errorMessage } from "@/lib/api-client";
import { integrationInputSchema } from "@/lib/work/validation";
import { validate } from "@/lib/form-errors";
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils";
import type { IntegrationDto } from "@/lib/work/serialize";

/**
 * Where an organisation connects the tools its agents work with: a library of
 * connectors grouped by what they are for, each tagged with the roles that
 * need it and saying exactly what it can and cannot do. OAuth wherever the
 * provider offers it; a key or a webhook only where it does not. Keys are
 * write-only: nothing here ever shows one back.
 */
export function IntegrationsView({ project }: { project: string }) {
  const list = useIntegrations(project);
  const providers = useOAuthProviders();
  const remove = useDeleteIntegration(project);
  const [removing, setRemoving] = React.useState<{ id: string; name: string } | null>(null);
  const [role, setRole] = React.useState<string>("all");
  const [openForm, setOpenForm] = React.useState<string | null>(null);
  const router = useRouter();
  const search = useSearchParams();
  const returnTo = `/p/${project}/integrations`;

  // Coming back from a provider: say how it went once, then tidy the address.
  React.useEffect(() => {
    const connected = search.get("connected");
    const failed = search.get("connectError");
    if (!connected && !failed) return;
    if (connected) toast.success(`${connectorById(connected)?.name ?? "Connection"} connected`);
    if (failed) toast.error(failed);
    router.replace(returnTo, { scroll: false });
  }, [search, router, returnTo]);

  // Which category sections are open. React owns <details open>, so this is
  // state: opening one by hand (or by a link) must survive the next render.
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const toggle = (id: string, open: boolean) =>
    setExpanded((current) => {
      if (current.has(id) === open) return current;
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  // Links elsewhere point at #<connector>: open its section and scroll to it.
  React.useEffect(() => {
    const id = window.location.hash.slice(1);
    const connector = id ? connectorById(id) : undefined;
    if (!connector) return;
    // After hydration, so the server's closed sections match the first paint.
    const frame = requestAnimationFrame(() => {
      toggle(connector.category, true);
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "center" }));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const byType = new Map((list.data ?? []).map((row) => [row.type, row]));
  // A personal space has no customers writing in.
  const personal = useSpaceKind() === "personal";
  const shown = CONNECTORS.filter(
    (connector) => (role === "all" || connector.roles.includes(role)) && !(personal && connector.id === "support_inbox"),
  );
  // The library is for choosing: an OAuth connector already set up lives in
  // "Your connections" above. Key and webhook ones stay, since you can add another.
  const library = shown.filter(
    (connector) => connector.status === "available" && !(connector.auth === "oauth" && byType.has(connector.id)),
  );
  const planned = shown.filter((connector) => connector.status === "planned");

  return (
    <Page>
      <PageHeader
        title="Integrations"
        description="Connect the tools your agents work with. Each asks for the least access it needs, and anything that reaches outside Desker waits for your approval first. Shared by every project in your organisation."
      />
      <PageBody className="space-y-8">
        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle>Your connections</PanelTitle>
              <PanelDescription>What each one means for your agents right now.</PanelDescription>
            </div>
          </PanelHeader>
          <PanelBody>
            {list.isLoading ? (
              <LoadingRows count={2} />
            ) : list.error ? (
              <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />
            ) : list.data && list.data.length > 0 ? (
              <ul className="grid gap-2 lg:grid-cols-2">
                {list.data.map((row) => (
                  // min-w-0: a grid item otherwise refuses to shrink below its
                  // one-line summary, and the page scrolls sideways on a phone.
                  <li key={row.id} className="min-w-0">
                    <ConnectionRow
                      row={row}
                      onRemove={() => setRemoving({ id: row.id, name: row.name })}
                      removing={remove.isPending}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Blocks}
                title="Nothing connected"
                description="Agents still work without connections: they do what they can, keep anything outbound as a draft, and say in their report what connecting a tool would let them finish."
              />
            )}
          </PanelBody>
        </Panel>

        <div>
          <div className="flex items-center gap-2">
            <label htmlFor="connector-role" className="text-sm text-ink-muted">
              Show connectors for
            </label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="connector-role" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.jobTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {CONNECTOR_CATEGORIES.map((category) => {
            const connectors = library.filter((connector) => connector.category === category.id);
            if (connectors.length === 0) return null;
            const formHere = connectors.find((connector) => connector.id === openForm);
            return (
              // Collapsed by default so the page scans as a list of categories; a
              // role filter opens them, since then you are looking for something.
              <details
                key={`${category.id}-${role}`}
                open={role !== "all" || expanded.has(category.id) || Boolean(formHere)}
                onToggle={(event) => toggle(category.id, event.currentTarget.open)}
                className="group mt-4 rounded-lg border border-line bg-surface"
              >
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="size-4 shrink-0 text-ink-subtle transition-transform group-open:rotate-90" aria-hidden />
                  <h2 className="text-sm font-semibold text-ink">{category.label}</h2>
                  <span className="min-w-0 truncate text-xs text-ink-muted">
                    {connectors.map((connector) => connector.name).join(", ")}
                  </span>
                </summary>
                <div className="border-t border-line p-4">
                  <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {connectors.map((connector) => (
                      <li key={connector.id} id={connector.id}>
                        <ConnectorCard
                          connector={connector}
                          connection={byType.get(connector.id)}
                          providers={providers.data}
                          project={project}
                          returnTo={returnTo}
                          showRoles
                          {...(connector.auth === "webhook" || connector.auth === "api_key"
                            ? {
                                onSetUp: () => setOpenForm((open) => (open === connector.id ? null : connector.id)),
                                setUpOpen: openForm === connector.id,
                              }
                            : {})}
                        />
                      </li>
                    ))}
                  </ul>
                  {formHere?.id === "webhook" ? (
                    <div className="mt-3 max-w-2xl">
                      <WebhookForm project={project} onDone={() => setOpenForm(null)} />
                    </div>
                  ) : null}
                  {formHere?.id === "support_inbox" ? (
                    <div className="mt-3 max-w-3xl">
                      <SupportInboxForm project={project} onDone={() => setOpenForm(null)} />
                    </div>
                  ) : null}
                  {formHere?.id === "email" ? (
                    <div className="mt-3 max-w-2xl">
                      <EmailForm project={project} onDone={() => setOpenForm(null)} />
                    </div>
                  ) : null}
                </div>
              </details>
            );
          })}

          {planned.length > 0 ? (
            <details className="group mt-8 rounded-lg border border-dashed border-line">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-4 shrink-0 text-ink-subtle transition-transform group-open:rotate-90" aria-hidden />
                <h2 className="text-sm font-semibold text-ink-muted">Coming soon</h2>
                <span className="min-w-0 truncate text-xs text-ink-subtle">
                  {planned.map((connector) => connector.name).join(", ")}
                </span>
              </summary>
              <div className="border-t border-dashed border-line p-4">
                <p className="mb-3 text-xs text-ink-subtle">Not connectable yet - listed so you know what is on the way.</p>
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {planned.map((connector) => (
                    <li key={connector.id} id={connector.id}>
                      <ConnectorCard connector={connector} project={project} returnTo={returnTo} showRoles />
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ) : null}
        </div>
      </PageBody>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? "this integration"}?`}
        description="Agents stop being able to use it straight away, and anything already waiting for your approval will fail to send until you connect it again."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!removing) return;
          await remove.mutateAsync(removing.id);
          toast.success(`${removing.name} removed`);
          setRemoving(null);
        }}
      />
    </Page>
  );
}

const STATE_LOOK = {
  connected: {
    label: "Connected",
    tone: "positive" as const,
    icon: CheckCircle2,
    className: "border-positive-line/70 bg-positive-soft text-positive",
  },
  attention: {
    label: "Needs attention",
    tone: "warning" as const,
    icon: TriangleAlert,
    className: "border-warning-line/70 bg-warning-soft text-warning",
  },
  disconnected: {
    label: "Disconnected",
    tone: "neutral" as const,
    icon: MinusCircle,
    className: "border-line bg-surface-2 text-ink-muted",
  },
};

/**
 * One connection, in one of three plain states, each saying what it costs the
 * agents that use it. No status codes, no unexplained red dot.
 */
function ConnectionRow({
  row,
  onRemove,
  removing,
}: {
  row: IntegrationDto;
  onRemove: () => void;
  removing: boolean;
}) {
  const look = STATE_LOOK[row.state];
  const StateIcon = look.icon;
  const KindIcon = row.type === "webhook" ? Webhook : row.type === "email" ? Mail : Plug;

  return (
    <div className="rounded-lg border border-line p-3 transition-colors hover:bg-surface-2/50">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-muted"
        >
          <KindIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink">{row.name}</p>
            <Badge tone={look.tone}>
              <StateIcon aria-hidden />
              {look.label}
            </Badge>
          </div>
          <p className={cn("mt-1 text-xs leading-relaxed", row.state === "connected" ? "text-ink-muted" : "text-ink")}>
            {row.consequence}
          </p>
          <p className="mt-1 truncate text-xs text-ink-subtle">
            {row.summary} · added{" "}
            <span title={formatDateTime(row.createdAt)}>{formatRelativeTime(row.createdAt)}</span>
            {row.lastDeliveryAt ? (
              <>
                {" "}· last used{" "}
                <span title={formatDateTime(row.lastDeliveryAt)}>{formatRelativeTime(row.lastDeliveryAt)}</span>
              </>
            ) : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Remove ${row.name}`}
          onClick={onRemove}
          disabled={removing}
          className="text-ink-subtle hover:bg-danger-soft/50 hover:text-danger"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** The platforms a publishing webhook can be named for; a draft's platform picks the matching one. */
const PUBLISH_PLATFORMS = ["LinkedIn", "X", "Instagram", "YouTube", "CMS"] as const;

function WebhookForm({ project, onDone }: { project: string; onDone: () => void }) {
  const create = useCreateIntegration(project);
  const [form, setForm] = React.useState({ name: "Publishing webhook", url: "", secret: "", platform: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    // The same schema the route parses, so the message is the one the server
    // would have sent - just without the round trip.
    const checked = validate(integrationInputSchema, { type: "webhook", ...form });
    if (!checked.ok) {
      setFieldErrors(checked.fieldErrors);
      return;
    }
    try {
      await create.mutateAsync({ type: "webhook", ...form });
      setForm({ name: "Publishing webhook", url: "", secret: "", platform: "" });
      toast.success("Publishing connected", {
        description: "Agents can publish through it as soon as you approve a post.",
      });
      onDone();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else setError(errorMessage(caught));
    }
  }

  return (
    <Panel>
      <form onSubmit={submit}>
        <PanelHeader>
          <div>
            <PanelTitle>Publish posts</PanelTitle>
            <PanelDescription>
              Approved posts are sent to an address you choose, as JSON. Point a Zapier or Make
              catch hook at it, or your own endpoint, and send it on to LinkedIn, X or a CMS.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody className="space-y-5">
          <FormError message={error} />
          <Field
            label="Name"
            htmlFor="wh-name"
            hint="How it appears in this list. For example: LinkedIn via Zapier."
            error={fieldErrors.name?.[0]}
          >
            <Input id="wh-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field
            label="Platform"
            htmlFor="wh-platform"
            hint="Which platform this address posts to. Posts drafted for that platform go here; add one per platform."
          >
            <Select value={form.platform || "any"} onValueChange={(next) => setForm({ ...form, platform: next === "any" ? "" : next })}>
              <SelectTrigger id="wh-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any platform</SelectItem>
                {PUBLISH_PLATFORMS.map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    {platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Where to send posts"
            htmlFor="wh-url"
            required
            hint="The address your automation listens on. Give it permission to post and nothing else."
            error={fieldErrors.url?.[0]}
          >
            <Input
              id="wh-url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://hooks.zapier.com/hooks/catch/…"
            />
          </Field>
          <Field
            label="Signing secret"
            htmlFor="wh-secret"
            hint="Optional. Set one and every delivery is signed, so your endpoint can ignore anything that is not from us."
            error={fieldErrors.secret?.[0]}
          >
            <Input
              id="wh-secret"
              type="password"
              autoComplete="off"
              value={form.secret}
              onChange={(e) => setForm({ ...form, secret: e.target.value })}
            />
          </Field>
        </PanelBody>
        <PanelFooter className="flex justify-end">
          <Button type="submit" size="sm" loading={create.isPending} disabled={create.isPending}>
            Connect it
          </Button>
        </PanelFooter>
      </form>
    </Panel>
  );
}

function EmailForm({ project, onDone }: { project: string; onDone: () => void }) {
  const create = useCreateIntegration(project);
  const [form, setForm] = React.useState({ name: "Resend", from: "", apiKey: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const checked = validate(integrationInputSchema, { type: "email", ...form });
    if (!checked.ok) {
      setFieldErrors(checked.fieldErrors);
      return;
    }
    try {
      await create.mutateAsync({ type: "email", ...form });
      setForm({ name: "Resend", from: "", apiKey: "" });
      toast.success("Email connected", {
        description: "Agents can send through it as soon as you approve an email.",
      });
      onDone();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else setError(errorMessage(caught));
    }
  }

  return (
    <Panel>
      <form onSubmit={submit}>
        <PanelHeader>
          <div>
            <PanelTitle>Send email</PanelTitle>
            <PanelDescription>
              Approved emails go out through Resend, from an address on a domain you have
              verified there.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody className="space-y-5">
          <FormError message={error} />
          <Field
            label="Send from"
            htmlFor="em-from"
            required
            hint="Must be on a domain you have verified in Resend, or nothing will send."
            error={fieldErrors.from?.[0]}
          >
            <Input
              id="em-from"
              value={form.from}
              onChange={(e) => setForm({ ...form, from: e.target.value })}
              placeholder="Mia at Northwind <mia@northwind.example>"
            />
          </Field>
          <Field
            label="Resend API key"
            htmlFor="em-key"
            required
            hint="Create one with sending access only. It is stored encrypted and never shown again."
            error={fieldErrors.apiKey?.[0]}
          >
            <Input
              id="em-key"
              type="password"
              autoComplete="off"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="re_…"
            />
          </Field>
        </PanelBody>
        <PanelFooter className="flex justify-end">
          <Button type="submit" size="sm" loading={create.isPending} disabled={create.isPending}>
            Connect it
          </Button>
        </PanelFooter>
      </form>
    </Panel>
  );
}
