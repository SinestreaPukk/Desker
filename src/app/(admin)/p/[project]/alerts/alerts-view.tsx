"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Newspaper, Plus, Send, Sunrise, Trash2, X } from "lucide-react";
import { api, errorMessage } from "@/lib/shared/api-client";
import { Page, PageBody, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input } from "@/components/ui/field";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, LoadingRows } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import {
  CHANNEL_KINDS,
  CHANNELS,
  EVENT_KINDS,
  EVENTS,
  NEWS_EDITIONS,
  type AlertPrefs,
  type ChannelKind,
} from "@/lib/messaging/prefs";
import type { AlertSettingsDto, ChannelDto } from "@/lib/messaging/settings";

const KEY = ["alert-settings"] as const;
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function useSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api<AlertSettingsDto>("/api/messaging"),
    // While a chat app waits for its code, look for the link every few seconds.
    refetchInterval: (query) => (query.state.data?.channels.some((c) => !c.linked) ? 3000 : false),
  });
}

/** Every change saves at once: there is no Save button to forget. */
function useSave() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (prefs: AlertPrefs) =>
      api<AlertSettingsDto>("/api/messaging", { method: "PATCH", body: JSON.stringify({ ...prefs, timeZone: browserZone() }) }),
    onMutate: (prefs) => {
      const before = client.getQueryData<AlertSettingsDto>(KEY);
      if (before) client.setQueryData(KEY, { ...before, prefs });
      return { before };
    },
    onError: (error, _prefs, context) => {
      if (context?.before) client.setQueryData(KEY, context.before);
      toast.error(errorMessage(error));
    },
    onSuccess: (data) => client.setQueryData(KEY, data),
  });
}

export function AlertsView() {
  const settings = useSettings();
  const save = useSave();
  if (settings.isPending) return <Shell><LoadingRows /></Shell>;
  if (settings.isError) return <Shell><ErrorState message={errorMessage(settings.error)} onRetry={() => settings.refetch()} /></Shell>;
  const data = settings.data;
  const prefs = data.prefs;
  const set = (next: Partial<AlertPrefs>) => save.mutate({ ...prefs, ...next });

  return (
    <Shell>
      <div className="space-y-5">
        <ChannelsPanel data={data} />
        <EventsPanel prefs={prefs} set={set} spaces={data.spaces} />
      </div>
      <div className="space-y-5">
        <BriefPanel prefs={prefs} set={set} />
        <NewsPanel prefs={prefs} set={set} />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Page>
      <PageHeader
        title="Alerts"
        description="Get Desker's messages in the app you already use: when something needs you, and a brief each morning. For every space you're in."
      />
      <PageBody className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">{children}</PageBody>
    </Page>
  );
}

// --- where ------------------------------------------------------------------

function ChannelsPanel({ data }: { data: AlertSettingsDto }) {
  const client = useQueryClient();
  const [adding, setAdding] = React.useState<ChannelKind | null>(null);
  const [url, setUrl] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const call = useMutation({
    mutationFn: (input: { path: string; method: string; body?: unknown }) =>
      api<AlertSettingsDto>(input.path, { method: input.method, body: input.body ? JSON.stringify(input.body) : undefined }),
    onSuccess: (next) => client.setQueryData(KEY, next),
  });

  async function add(kind: ChannelKind) {
    setError(null);
    if (CHANNELS[kind].how === "webhook" && adding !== kind) {
      setAdding(kind);
      setUrl("");
      setName("");
      return;
    }
    try {
      await call.mutateAsync({ path: "/api/messaging/channels", method: "POST", body: { kind, url: url || undefined, name: name || undefined } });
      setAdding(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const has = new Set(data.channels.filter((c) => c.linked).map((c) => c.kind));
  const chatLinked = data.channels.some((c) => c.linked && CHANNELS[c.kind].how === "chat");

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>
            <Bell className="mr-1.5 inline size-4 text-accent" aria-hidden />
            Where to send
          </PanelTitle>
          <PanelDescription>Pick one or several. Each can be turned off without removing it.</PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-4">
        {data.channels.length > 0 ? (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {data.channels.map((channel) => (
              <ChannelRow key={channel.id} channel={channel} call={call.mutateAsync} />
            ))}
          </ul>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-medium text-ink">{data.channels.length ? "Add another" : "Add one"}</p>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_KINDS.map((kind) => {
              const available = data.available[kind];
              const done = kind === "email" && has.has("email");
              return (
                <Button
                  key={kind}
                  variant={adding === kind ? "primary" : "secondary"}
                  size="sm"
                  disabled={!available || done || call.isPending}
                  title={!available ? "Not set up on this server yet" : CHANNELS[kind].hint}
                  onClick={() => add(kind)}
                >
                  <Plus aria-hidden />
                  {CHANNELS[kind].name}
                </Button>
              );
            })}
          </div>
          {CHANNEL_KINDS.some((kind) => !data.available[kind]) ? (
            <p className="mt-2 text-xs text-ink-muted">Greyed out: not switched on for Desker yet.</p>
          ) : null}
        </div>

        {adding ? (
          <form
            className="space-y-3 rounded-lg border border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void add(adding);
            }}
          >
            <p className="text-sm text-ink-muted">{WEBHOOK_HOWTO[adding]}</p>
            <Field label={`${CHANNELS[adding].name} webhook URL`} htmlFor="webhook-url">
              <Input id="webhook-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" autoComplete="off" />
            </Field>
            <Field label="Name (optional)" htmlFor="webhook-name" hint="So you can tell them apart, like #alerts.">
              <Input id="webhook-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={!url.trim() || call.isPending}>
                Add {CHANNELS[adding].name}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(null)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {chatLinked ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-muted">
            In LINE, WhatsApp or Telegram you can also send <strong className="text-ink">brief</strong>,{" "}
            <strong className="text-ink">news</strong>, <strong className="text-ink">pause</strong> or{" "}
            <strong className="text-ink">resume</strong>.
          </p>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

const WEBHOOK_HOWTO: Partial<Record<ChannelKind, string>> = {
  slack: "In Slack: Apps → Incoming Webhooks → Add to Slack, pick a channel, and copy the Webhook URL.",
  discord: "In Discord: the channel's settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.",
  teams: "In Teams: the channel's ⋯ → Workflows → \"Post to a channel when a webhook request is received\", then copy the URL it gives you.",
};

function ChannelRow({
  channel,
  call,
}: {
  channel: ChannelDto;
  call: (input: { path: string; method: string; body?: unknown }) => Promise<AlertSettingsDto>;
}) {
  const [busy, setBusy] = React.useState(false);
  const path = `/api/messaging/channels/${channel.id}`;
  async function run(method: string, body?: unknown, success?: string) {
    setBusy(true);
    try {
      await call({ path, method, body });
      if (success) toast.success(success);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!channel.linked) {
    return (
      <li className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-ink">Connect {CHANNELS[channel.kind].name}</span>
          <Button variant="ghost" size="icon-sm" aria-label="Cancel" disabled={busy} onClick={() => run("DELETE")}>
            <X aria-hidden />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {channel.linkQr ? (
            // A computer can't open the app with the code typed (LINE's link only works on a phone): scan instead.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.linkQr} alt={`QR code to connect ${CHANNELS[channel.kind].name}`} className="hidden size-36 rounded-lg border border-line pointer-fine:block" />
          ) : null}
          <div className="space-y-2 text-sm text-ink-muted">
            <p className="hidden pointer-fine:block">
              Scan this with your phone&apos;s camera. {CHANNELS[channel.kind].name} opens with the code typed in: press send.
            </p>
            {channel.linkUrl ? (
              <a
                href={channel.linkUrl}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-fg hover:bg-primary-hover ${channel.kind === "line" ? "pointer-fine:hidden" : ""}`}
              >
                <Send className="size-3.5" aria-hidden />
                Open {CHANNELS[channel.kind].name}
              </a>
            ) : null}
            <p>
              Or {channel.handle ? <>add <strong className="text-ink">{channel.handle}</strong> in {CHANNELS[channel.kind].name} and</> : null}{" "}
              send this code:{" "}
              <code className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-base tracking-widest text-ink">{channel.linkCode}</code>
            </p>
          </div>
        </div>
        <p className="text-xs text-ink-muted">Waiting for your code… The code works for an hour.</p>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <Switch
        checked={channel.enabled}
        disabled={busy}
        onCheckedChange={(enabled) => run("PATCH", { enabled })}
        aria-label={`Send to ${channel.label}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{channel.label}</p>
        {channel.lastError ? <p className="truncate text-xs text-danger">Last message failed: {channel.lastError}</p> : null}
      </div>
      {!channel.enabled ? <Badge>Off</Badge> : null}
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => run("POST", undefined, "Sent. Check your app.")}>
        Test
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${channel.label}`} disabled={busy} onClick={() => run("DELETE")}>
        <Trash2 aria-hidden />
      </Button>
    </li>
  );
}

// --- what -------------------------------------------------------------------

function EventsPanel({
  prefs,
  set,
  spaces,
}: {
  prefs: AlertPrefs;
  set: (next: Partial<AlertPrefs>) => void;
  spaces: AlertSettingsDto["spaces"];
}) {
  return (
    <Panel>
      <PanelHeader className="flex items-start justify-between gap-3">
        <div>
          <PanelTitle>When something happens</PanelTitle>
          <PanelDescription>Sent the moment it happens.</PanelDescription>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          Pause all
          <Switch checked={prefs.paused} onCheckedChange={(paused) => set({ paused })} aria-label="Pause all messages" />
        </label>
      </PanelHeader>
      <PanelBody className={prefs.paused ? "space-y-4 opacity-50" : "space-y-4"}>
        <ul className="space-y-2.5">
          {EVENT_KINDS.map((kind) => (
            <li key={kind}>
              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  className="mt-0.5"
                  checked={prefs.events[kind]}
                  onCheckedChange={(on) => set({ events: { ...prefs.events, [kind]: on } })}
                />
                <span>
                  <span className="block text-sm text-ink">{EVENTS[kind].label}</span>
                  <span className="block text-xs text-ink-muted">{EVENTS[kind].hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {spaces.length > 1 ? (
          <div className="border-t border-line pt-3">
            <p className="mb-2 text-sm font-medium text-ink">From these spaces</p>
            <ul className="space-y-2">
              {spaces.map((space) => (
                <li key={space.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
                    <Checkbox
                      checked={!prefs.mutedSpaces.includes(space.id)}
                      onCheckedChange={(on) =>
                        set({ mutedSpaces: on ? prefs.mutedSpaces.filter((id) => id !== space.id) : [...prefs.mutedSpaces, space.id] })
                      }
                    />
                    {space.name}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

// --- when -------------------------------------------------------------------

function SendNow({ what, label }: { what: "brief" | "news"; label: string }) {
  const send = useMutation({
    mutationFn: () => api<{ sent: number }>("/api/messaging/send", { method: "POST", body: JSON.stringify({ what }) }),
    onSuccess: () => toast.success("Sent. Check your app."),
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Button variant="secondary" size="sm" disabled={send.isPending} onClick={() => send.mutate()}>
      <Send aria-hidden />
      {send.isPending ? "Sending…" : label}
    </Button>
  );
}

const BRIEF_PARTS = [
  { key: "calendar", label: "Today's calendar", hint: "From the calendar connected in a space you own." },
  { key: "waiting", label: "What's waiting on you", hint: "Approvals and questions across your spaces." },
  { key: "recap", label: "What got done", hint: "Since your last brief." },
  { key: "news", label: "News on your topics", hint: "Set your topics below." },
] as const;

function BriefPanel({ prefs, set }: { prefs: AlertPrefs; set: (next: Partial<AlertPrefs>) => void }) {
  const brief = prefs.brief;
  const setBrief = (next: Partial<AlertPrefs["brief"]>) => set({ brief: { ...brief, ...next } });
  return (
    <Panel>
      <PanelHeader className="flex items-start justify-between gap-3">
        <div>
          <PanelTitle>
            <Sunrise className="mr-1.5 inline size-4 text-accent" aria-hidden />
            Morning brief
          </PanelTitle>
          <PanelDescription>One message to start the day. Times are in {prefs.timeZone === "UTC" ? browserZone() : prefs.timeZone}.</PanelDescription>
        </div>
        <Switch checked={brief.on} onCheckedChange={(on) => setBrief({ on })} aria-label="Morning brief" />
      </PanelHeader>
      <PanelBody className={brief.on ? "space-y-4" : "space-y-4 opacity-50"}>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="At" htmlFor="brief-time">
            <Input
              id="brief-time"
              type="time"
              step={900}
              className="w-32"
              value={brief.time}
              disabled={!brief.on}
              onChange={(e) => e.target.value && setBrief({ time: e.target.value })}
            />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">On</p>
            <div className="flex gap-1">
              {DAYS.map((day, index) => {
                const on = brief.days.includes(index);
                return (
                  <button
                    key={index}
                    type="button"
                    disabled={!brief.on}
                    aria-pressed={on}
                    aria-label={DAY_NAMES[index]}
                    onClick={() => setBrief({ days: on ? brief.days.filter((d) => d !== index) : [...brief.days, index] })}
                    className={
                      on
                        ? "size-9 rounded-full bg-accent text-sm font-medium text-white"
                        : "size-9 rounded-full border border-line text-sm text-ink-muted hover:border-line-strong"
                    }
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <ul className="space-y-2.5">
          {BRIEF_PARTS.map((part) => (
            <li key={part.key}>
              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox className="mt-0.5" checked={brief[part.key]} disabled={!brief.on} onCheckedChange={(on) => setBrief({ [part.key]: on })} />
                <span>
                  <span className="block text-sm text-ink">{part.label}</span>
                  <span className="block text-xs text-ink-muted">{part.hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <SendNow what="brief" label="Send me one now" />
      </PanelBody>
    </Panel>
  );
}

function NewsPanel({ prefs, set }: { prefs: AlertPrefs; set: (next: Partial<AlertPrefs>) => void }) {
  const [topic, setTopic] = React.useState("");
  const topics = prefs.news.topics;
  const addTopic = () => {
    const value = topic.trim();
    if (!value || topics.length >= 5 || topics.some((t) => t.toLowerCase() === value.toLowerCase())) return;
    set({ news: { ...prefs.news, topics: [...topics, value.slice(0, 60)] } });
    setTopic("");
  };
  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>
            <Newspaper className="mr-1.5 inline size-4 text-accent" aria-hidden />
            News
          </PanelTitle>
          <PanelDescription>The top stories of the last day on up to five topics: in your brief, or any time you ask.</PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-4">
        {topics.length ? (
          <ul className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <li key={t}>
                <Badge tone="accent">
                  {t}
                  <button
                    type="button"
                    aria-label={`Remove ${t}`}
                    onClick={() => set({ news: { ...prefs.news, topics: topics.filter((x) => x !== t) } })}
                  >
                    <X aria-hidden />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addTopic();
          }}
        >
          <Input
            aria-label="News topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={topics.length >= 5 ? "That's five" : "A topic, a company, a place…"}
            disabled={topics.length >= 5}
          />
          <Button type="submit" variant="secondary" disabled={!topic.trim() || topics.length >= 5}>
            Add
          </Button>
        </form>
        <Field label="Edition" htmlFor="news-edition">
          <Select value={prefs.news.edition} onValueChange={(edition) => set({ news: { ...prefs.news, edition } })}>
            <SelectTrigger id="news-edition">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NEWS_EDITIONS.map((edition) => (
                <SelectItem key={edition.id} value={edition.id}>
                  {edition.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {topics.length ? <SendNow what="news" label="Send news now" /> : null}
      </PanelBody>
    </Panel>
  );
}
