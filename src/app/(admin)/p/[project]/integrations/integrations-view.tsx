"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Mail, MinusCircle, Plug, Trash2, Webhook } from "lucide-react";
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
} from "@/hooks/use-work-data";
import { ApiError, errorMessage } from "@/lib/api-client";
import { integrationInputSchema } from "@/lib/work/validation";
import { validate } from "@/lib/form-errors";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { IntegrationDto } from "@/lib/work/serialize";

/**
 * Where an organisation connects the outside world. Two connectors for now:
 * a generic webhook that receives published posts (point Zapier, Make, or
 * your own endpoint at it) and an email provider. Keys are write-only: the
 * list never shows them back.
 */
export function IntegrationsView({ project }: { project: string }) {
  const list = useIntegrations(project);
  const remove = useDeleteIntegration(project);
  const [removing, setRemoving] = React.useState<{ id: string; name: string } | null>(null);

  return (
    <Page>
      <PageHeader
        title="Integrations"
        description="The two ways work can leave Desker. Both are shared by every project in your organisation, and both wait for your approval first."
      />
      <PageBody className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <WebhookForm project={project} />
          <EmailForm project={project} />
        </div>

        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle>Your connections</PanelTitle>
              <PanelDescription>
                What each one means for your agents right now.
              </PanelDescription>
            </div>
          </PanelHeader>
          <PanelBody>
            {list.isLoading ? (
              <LoadingRows count={2} />
            ) : list.error ? (
              <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />
            ) : list.data && list.data.length > 0 ? (
              <ul className="space-y-2">
                {list.data.map((row) => (
                  <li key={row.id}>
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
                icon={Plug}
                title="Nothing connected"
                description="Until something is connected, agents write posts and emails as drafts and say so in their reports. Nothing breaks - it simply stays inside Desker."
              />
            )}
          </PanelBody>
        </Panel>
      </PageBody>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? "this integration"}?`}
        description="Agents stop being able to use it straight away, and anything already waiting for your approval will fail to send until you connect another one."
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
    icon: AlertTriangle,
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
  const KindIcon = row.type === "webhook" ? Webhook : Mail;

  return (
    <div className="rounded-xl border border-line p-3 transition-colors hover:bg-surface-2/50">
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
            {row.summary} · added {formatRelativeTime(row.createdAt)}
            {row.lastDeliveryAt ? ` · last used ${formatRelativeTime(row.lastDeliveryAt)}` : ""}
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

function WebhookForm({ project }: { project: string }) {
  const create = useCreateIntegration(project);
  const [form, setForm] = React.useState({ name: "Publishing webhook", url: "", secret: "" });
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
      setForm({ name: "Publishing webhook", url: "", secret: "" });
      toast.success("Publishing connected", {
        description: "Agents can publish through it as soon as you approve a post.",
      });
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

function EmailForm({ project }: { project: string }) {
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
