"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Trash2, X } from "lucide-react";
import { api, errorMessage } from "@/lib/shared/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { CHANNELS, type ChannelKind } from "@/lib/messaging/prefs";
import type { AlertSettingsDto, ChannelDto } from "@/lib/messaging/settings";

const KEY = ["alert-settings"] as const;
const MAIN: ChannelKind[] = ["line", "telegram", "whatsapp"];
const MORE: ChannelKind[] = ["email", "slack", "discord", "teams"];

const HOWTO: Partial<Record<ChannelKind, string>> = {
  slack: "In Slack: Apps, Incoming Webhooks, pick a channel, copy the URL.",
  discord: "In Discord: channel settings, Integrations, Webhooks, copy the URL.",
  teams: "In Teams: channel menu, Workflows, post on webhook request, copy the URL.",
};

type Call = (input: { path: string; method: string; body?: unknown }) => Promise<AlertSettingsDto>;

/** Where you talk to the assistant, and where it reaches you. */
export function ChatApps() {
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: KEY,
    queryFn: () => api<AlertSettingsDto>("/api/messaging"),
    // While an app waits for its code, look for the link every few seconds.
    refetchInterval: (query) => (query.state.data?.channels.some((channel) => !channel.linked) ? 3000 : false),
  });
  const call = useMutation({
    mutationFn: (input: { path: string; method: string; body?: unknown }) =>
      api<AlertSettingsDto>(input.path, { method: input.method, body: input.body ? JSON.stringify(input.body) : undefined }),
    onSuccess: (next) => client.setQueryData(KEY, next),
  });

  if (settings.isPending) return <Skeleton className="h-48" />;
  if (settings.error) return <ErrorState message={errorMessage(settings.error)} onRetry={() => void settings.refetch()} />;
  const data = settings.data;

  const row = (kind: ChannelKind) =>
    data.available[kind] ? <KindRow key={kind} kind={kind} channels={data.channels.filter((channel) => channel.kind === kind)} call={call.mutateAsync} /> : null;

  return (
    <div>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">{MAIN.map(row)}</ul>
      <details className="group mt-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-accent hover:underline [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">More ways to reach you</span>
          <span className="hidden group-open:inline">Fewer</span>
        </summary>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">{MORE.map(row)}</ul>
      </details>
    </div>
  );
}

function KindRow({ kind, channels, call }: { kind: ChannelKind; channels: ChannelDto[]; call: Call }) {
  const [form, setForm] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const meta = CHANNELS[kind];
  const linked = channels.filter((channel) => channel.linked);
  const waiting = channels.find((channel) => !channel.linked);
  const canAdd = !waiting && (linked.length === 0 || meta.how === "webhook");

  async function add() {
    if (meta.how === "webhook" && !form) return setForm(true);
    setBusy(true);
    try {
      await call({ path: "/api/messaging/channels", method: "POST", body: { kind, url: url || undefined } });
      setForm(false);
      setUrl("");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="px-4 py-3.5">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{meta.name}</p>
          <p className="text-sm text-ink-muted">{linked.length > 0 ? "Connected" : meta.hint}</p>
        </div>
        {canAdd && !form ? (
          <Button size="sm" variant={linked.length > 0 ? "secondary" : "primary"} loading={busy} onClick={() => void add()}>
            {linked.length > 0 ? "Add another" : "Connect"}
          </Button>
        ) : null}
      </div>

      {linked.map((channel) => (
        <Linked key={channel.id} channel={channel} call={call} />
      ))}
      {waiting ? <Waiting channel={waiting} call={call} /> : null}

      {form ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <p className="text-sm text-ink-muted">{HOWTO[kind]}</p>
          <Field label="Webhook URL" htmlFor={`${kind}-url`}>
            <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" autoComplete="off" />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!url.trim()} loading={busy}>
              Connect
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

function useAct(channel: ChannelDto, call: Call) {
  const [busy, setBusy] = React.useState(false);
  async function act(method: string, body?: unknown, done?: string) {
    setBusy(true);
    try {
      await call({ path: `/api/messaging/channels/${channel.id}`, method, body });
      if (done) toast.success(done);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return { busy, act };
}

function Linked({ channel, call }: { channel: ChannelDto; call: Call }) {
  const { busy, act } = useAct(channel, call);
  return (
    <div className="mt-3 flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2">
      <p className="min-w-0 flex-1 truncate text-sm text-ink">{channel.label}</p>
      {channel.lastError ? <span className="text-sm text-danger">Last message failed</span> : null}
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => void act("POST", undefined, "Sent. Check your app.")}>
        Test
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${channel.label}`} disabled={busy} onClick={() => void act("DELETE")}>
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}

function Waiting({ channel, call }: { channel: ChannelDto; call: Call }) {
  const { busy, act } = useAct(channel, call);
  const name = CHANNELS[channel.kind].name;
  return (
    <div className="mt-3 rounded-md px-4 py-3" style={{ background: "var(--note-sky)" }}>
      <div className="flex items-start gap-4">
        {channel.linkQr ? (
          // A computer can't open the app with the code typed in: scan it with a phone instead.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.linkQr} alt={`QR code to connect ${name}`} className="hidden size-32 rounded-md bg-white p-1 pointer-fine:block" />
        ) : null}
        <div className="min-w-0 flex-1 space-y-2 text-sm text-ink">
          <p className="hidden pointer-fine:block">Scan with your phone, then press send in {name}.</p>
          {channel.linkUrl ? (
            <a
              href={channel.linkUrl}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-fg hover:bg-primary-hover ${channel.kind === "line" ? "pointer-fine:hidden" : ""}`}
            >
              <Send className="size-3.5" aria-hidden />
              Open {name}
            </a>
          ) : null}
          <p>
            Or send this code{channel.handle ? <> to <strong>{channel.handle}</strong></> : null}:{" "}
            <code className="rounded-md bg-white px-2 py-0.5 font-mono text-base tracking-widest">{channel.linkCode}</code>
          </p>
          <p className="text-ink-muted">Waiting for you. The code works for an hour.</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Cancel" disabled={busy} onClick={() => void act("DELETE")}>
          <X aria-hidden />
        </Button>
      </div>
    </div>
  );
}
