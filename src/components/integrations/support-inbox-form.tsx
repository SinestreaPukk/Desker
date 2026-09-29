"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, Send, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError, LoadingRows } from "@/components/ui/states";
import { useAgents } from "@/hooks/use-admin-data";
import { api, errorMessage } from "@/lib/api-client";
import type { ReadinessCheck } from "@/lib/work/support-inbox";

interface InboxResponse {
  inbox: { url: string; agentId: string; callbackUrl: string | null; signed: boolean; enabled: boolean } | null;
  readiness: ReadinessCheck[];
  checking: string | null;
}

const EXAMPLE = `{
  "email": "jo@example.com",
  "name": "Jo Bloggs",
  "subject": "Returns",
  "message": "Can I return a drill after 40 days if it's unopened?",
  "id": "ticket-1042"
}`;

/**
 * The support inbox, set up in one place: who answers, where messages go in,
 * where the "answered" report goes out - and, above all, a plain checklist of
 * what the loop still needs, so its limits are on screen before a customer
 * finds them.
 */
export function SupportInboxForm({ project, onDone }: { project: string; onDone: () => void }) {
  const client = useQueryClient();
  const key = ["support-inbox", project];
  const agents = (useAgents(project).data ?? []).filter((agent) => agent.status === "published");
  const [agentId, setAgentId] = React.useState<string | null>(null);
  // The checklist follows the agent picked in the form; until then the server
  // checks the saved one, or the likely Support agent.
  const preview = agentId ?? "";
  const data = useQuery({
    queryKey: [...key, preview],
    queryFn: () =>
      api<InboxResponse>(`/api/support-inbox?project=${encodeURIComponent(project)}${preview ? `&agent=${encodeURIComponent(preview)}` : ""}`),
    placeholderData: (previous) => previous,
  });
  const [callbackUrl, setCallbackUrl] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/api/support-inbox?project=${encodeURIComponent(project)}`, { method: "PUT", body: JSON.stringify(body) }),
    onSettled: () => void client.invalidateQueries({ queryKey: key }),
  });
  const remove = useMutation({
    mutationFn: () => api(`/api/support-inbox?project=${encodeURIComponent(project)}`, { method: "DELETE" }),
    onSettled: () => void client.invalidateQueries({ queryKey: key }),
  });
  const test = useMutation({
    mutationFn: (url: string) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "test.customer@example.com", name: "Test customer", subject: "A test question", message: "Hi - what is your returns policy?" }),
      }).then(async (response) => {
        if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? `Status ${response.status}`);
      }),
  });

  if (data.isPending) return <LoadingRows count={2} />;
  const inbox = data.data?.inbox ?? null;
  const chosen = agentId ?? data.data?.checking ?? null;
  const callback = callbackUrl ?? inbox?.callbackUrl ?? "";

  async function submit(extra: Record<string, unknown> = {}) {
    if (!chosen) return;
    setError(null);
    try {
      await save.mutateAsync({ agentId: chosen, callbackUrl: callback, ...(secret ? { callbackSecret: secret } : {}), ...extra });
      toast.success(inbox ? "Support inbox updated" : "Support inbox ready", {
        description: extra.rotate ? "The old address stopped working." : "Send a test message to see it end to end.",
      });
      setSecret("");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>Support inbox</PanelTitle>
          <PanelDescription>
            Customer messages in, answered from your policies, reply sent once you approve it, and your helpdesk told it&apos;s
            done. Anything that can send a web request can feed it: your helpdesk&apos;s webhooks, a website form, or a Zapier
            or Make zap on your support email.
          </PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-5">
        <FormError message={error ?? (data.error ? errorMessage(data.error) : null)} />

        <section aria-label="What it needs">
          <h3 className="eyebrow mb-2">What it needs</h3>
          <ul className="space-y-1.5 text-sm">
            {(data.data?.readiness ?? []).map((check) => (
              <li key={check.label} className="flex flex-wrap items-center gap-2">
                {check.ok ? <Check className="size-4 shrink-0 text-positive" aria-hidden /> : <X className="size-4 shrink-0 text-danger" aria-hidden />}
                <span className={check.ok ? "text-ink" : "text-ink"}>{check.label}</span>
                {check.fix ? (
                  <Link href={check.fix.href} className="text-xs font-medium text-accent hover:underline">
                    {check.fix.label}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Who answers" htmlFor="support-agent" hint="A published agent with your policies uploaded.">
            <Select value={chosen ?? undefined} onValueChange={setAgentId}>
              <SelectTrigger id="support-agent">
                <SelectValue placeholder="Choose an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name} · {agent.jobTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Report back to (optional)" htmlFor="support-callback" hint="Your helpdesk or zap hears ticket.answered and ticket.needs_human here.">
            <Input
              id="support-callback"
              value={callback}
              onChange={(event) => setCallbackUrl(event.target.value)}
              placeholder="https://hooks.zapier.com/hooks/catch/…"
            />
          </Field>
          <Field label="Signing secret (optional)" htmlFor="support-secret" hint={inbox?.signed ? "A secret is set. Type a new one to replace it." : "Each report carries X-Desker-Signature: sha256=HMAC of the body."}>
            <Input id="support-secret" type="password" value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="off" />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void submit()} loading={save.isPending} disabled={!chosen}>
            {inbox ? "Save changes" : "Set up the inbox"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Close
          </Button>
        </div>

        {inbox ? (
          <section aria-label="Intake address" className="space-y-3 rounded-lg border border-line bg-surface-2/50 p-4">
            <div>
              <h3 className="eyebrow mb-1">Send customer messages to</h3>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-surface px-2 py-1.5 font-mono text-xs text-ink">{inbox.url}</code>
                <Button
                  size="icon-sm"
                  variant="secondary"
                  aria-label="Copy the address"
                  onClick={() => void navigator.clipboard.writeText(inbox.url).then(() => toast.success("Address copied"))}
                >
                  <Copy aria-hidden />
                </Button>
              </div>
              <p className="mt-1 text-xs text-ink-muted">The address is the password: keep it private. Replace it any time and the old one stops working.</p>
            </div>
            <details>
              <summary className="cursor-pointer text-xs font-medium text-ink">What to send (JSON or a form)</summary>
              <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-surface p-3 font-mono text-xs text-ink">{EXAMPLE}</pre>
              <p className="mt-1 text-xs text-ink-muted">
                Only <code>email</code> and <code>message</code> are required; <code>from</code>, <code>body</code>, <code>description</code> and
                other common names work too. Send the same <code>id</code> twice and it is answered once.
              </p>
            </details>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={test.isPending}
                onClick={() =>
                  test.mutate(inbox.url, {
                    onSuccess: () => toast.success("Test message sent", { description: "Follow it in Workflows; the reply will wait in Needs you." }),
                    onError: (caught) => toast.error(errorMessage(caught)),
                  })
                }
              >
                <Send aria-hidden />
                Send a test message
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void submit({ rotate: true })}>
                Replace the address
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void submit({ enabled: !inbox.enabled })}>
                {inbox.enabled ? "Pause the inbox" : "Turn the inbox back on"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={remove.isPending}
                onClick={() => remove.mutate(undefined, { onSuccess: () => toast("Support inbox removed") })}
              >
                Remove
              </Button>
            </div>
          </section>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
