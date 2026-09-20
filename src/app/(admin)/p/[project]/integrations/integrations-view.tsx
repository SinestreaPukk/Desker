"use client";

import * as React from "react";
import { Mail, Plug, Trash2, Webhook } from "lucide-react";
import { Page, PageBody, PageHeader } from "@/components/page-header";
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
import { formatRelativeTime } from "@/lib/utils";

/**
 * Where an organisation connects the outside world. Two connectors for now:
 * a generic webhook that receives published posts (point Zapier, Make, or
 * your own endpoint at it) and an email provider. Keys are write-only: the
 * list never shows them back.
 */
export function IntegrationsView({ project }: { project: string }) {
  const list = useIntegrations(project);
  const remove = useDeleteIntegration(project);

  return (
    <Page>
      <PageHeader
        title="Integrations"
        description="Where agents deliver work that leaves the building. Shared by every project in your organisation."
      />
      <PageBody className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <WebhookForm project={project} />
          <EmailForm project={project} />
        </div>

        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle>Connected</PanelTitle>
              <PanelDescription>Agents use the oldest enabled connector of each kind.</PanelDescription>
            </div>
          </PanelHeader>
          <PanelBody>
            {list.isLoading ? (
              <LoadingRows count={2} />
            ) : list.error ? (
              <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />
            ) : list.data && list.data.length > 0 ? (
              <ul className="divide-y divide-line">
                {list.data.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 py-3 text-[0.8125rem]">
                    {row.type === "webhook" ? (
                      <Webhook className="size-4 text-accent" aria-hidden />
                    ) : (
                      <Mail className="size-4 text-accent" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{row.name}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {row.summary} · added {formatRelativeTime(row.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${row.name}`}
                      onClick={() => remove.mutate(row.id)}
                      disabled={remove.isPending}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Plug}
                title="Nothing connected"
                description="Until a connector exists, agents leave posts and emails as drafts and say so in their reports."
              />
            )}
          </PanelBody>
        </Panel>
      </PageBody>
    </Page>
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
    try {
      await create.mutateAsync({ type: "webhook", ...form });
      setForm({ name: "Publishing webhook", url: "", secret: "" });
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
            <PanelTitle>Publishing webhook</PanelTitle>
            <PanelDescription>
              <code>publish_post</code> sends the approved draft here as JSON. Point a Zapier or
              Make catch hook at it, or your own endpoint, and route it to X, LinkedIn or a CMS.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <FormError message={error} />
          <Field label="Name" htmlFor="wh-name" error={fieldErrors.name?.[0]}>
            <Input id="wh-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="URL" htmlFor="wh-url" required error={fieldErrors.url?.[0]}>
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
            hint="Optional. Deliveries carry an X-Desker-Signature header (HMAC-SHA256 of the body)."
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
          <Button type="submit" size="sm" disabled={create.isPending || !form.url.trim()}>
            Connect webhook
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
    try {
      await create.mutateAsync({ type: "email", ...form });
      setForm({ name: "Resend", from: "", apiKey: "" });
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
            <PanelTitle>Email (Resend)</PanelTitle>
            <PanelDescription>
              <code>send_email</code> goes through Resend. The from-address must be on a domain
              verified in your Resend account.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <FormError message={error} />
          <Field label="From" htmlFor="em-from" required error={fieldErrors.from?.[0]}>
            <Input
              id="em-from"
              value={form.from}
              onChange={(e) => setForm({ ...form, from: e.target.value })}
              placeholder="Mia at Northwind <mia@northwind.example>"
            />
          </Field>
          <Field label="API key" htmlFor="em-key" required error={fieldErrors.apiKey?.[0]}>
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
          <Button type="submit" size="sm" disabled={create.isPending || !form.from.trim() || !form.apiKey.trim()}>
            Connect email
          </Button>
        </PanelFooter>
      </form>
    </Panel>
  );
}
