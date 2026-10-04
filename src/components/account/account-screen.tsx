"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Screen } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { api, errorMessage } from "@/lib/shared/api-client";
import type { AlertSettingsDto } from "@/lib/messaging/settings";

interface Profile {
  firstName: string;
  lastName: string;
  username: string;
  nickname: string;
  email: string;
}

/** Who you are, how you sign in, what it tells you about, and your data. */
export function AccountScreen({ project, initial }: { project: string; initial: Profile }) {
  return (
    <Screen title="Account" hint="Your details, sign-in and data.">
      <div className="space-y-10">
        <ProfileForm project={project} initial={initial} />
        <PasswordForm />
        <Notifications />
        <DataSection email={initial.email} />
      </div>
    </Screen>
  );
}

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      {hint ? <p className="mb-3 mt-1 text-sm text-ink-muted">{hint}</p> : <div className="mb-3" />}
      <div className="rounded-panel border border-line bg-surface p-4 shadow-xs sm:p-5">{children}</div>
    </section>
  );
}

/** Field errors the API sent, keyed by field name, for the form to show under the right box. */
function fieldErrors(error: unknown): Record<string, string> {
  const raw = (error as { fieldErrors?: Record<string, string[]> } | null)?.fieldErrors ?? {};
  return Object.fromEntries(Object.entries(raw).map(([key, list]) => [key, list[0] ?? ""]));
}

function ProfileForm({ project, initial }: { project: string; initial: Profile }) {
  const [form, setForm] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const set = (key: keyof Profile) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });
  const save = useMutation({
    mutationFn: () => api("/api/account/profile", { method: "PATCH", body: JSON.stringify({ project, ...form }) }),
    onSuccess: () => {
      setErrors({});
      toast.success("Saved");
    },
    onError: (caught) => {
      setErrors(fieldErrors(caught));
      toast.error(errorMessage(caught));
    },
  });
  return (
    <Section id="profile" title="You">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Field label="First name" htmlFor="firstName" error={errors.firstName}>
          <Input value={form.firstName} onChange={set("firstName")} autoComplete="given-name" required />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={errors.lastName}>
          <Input value={form.lastName} onChange={set("lastName")} autoComplete="family-name" required />
        </Field>
        <Field label="Nickname" htmlFor="nickname" hint="What your assistant calls you." error={errors.nickname}>
          <Input value={form.nickname} onChange={set("nickname")} maxLength={40} />
        </Field>
        <Field label="Username" htmlFor="username" error={errors.username}>
          <Input value={form.username} onChange={set("username")} autoComplete="username" required />
        </Field>
        <Field label="Email" htmlFor="email" hint="This is how you sign in." className="sm:col-span-2">
          <Input value={form.email} disabled readOnly />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Section>
  );
}

function PasswordForm() {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const change = useMutation({
    mutationFn: () => api("/api/account/password", { method: "POST", body: JSON.stringify({ current, next }) }),
    // Changing it ends every session, this one too, so sign in again.
    onSuccess: () => {
      toast.success("Password changed. Sign in again.");
      void signOut({ callbackUrl: "/login" });
    },
    onError: (caught) => {
      setErrors(fieldErrors(caught));
      toast.error(errorMessage(caught));
    },
  });
  return (
    <Section id="password" title="Password" hint="Changing it signs you out everywhere.">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          change.mutate();
        }}
      >
        <Field label="Current password" htmlFor="current" error={errors.current}>
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </Field>
        <Field label="New password" htmlFor="next" hint="At least 8 characters." error={errors.next}>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required minLength={8} />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" variant="secondary" disabled={change.isPending || !current || !next}>
            Change password
          </Button>
        </div>
      </form>
    </Section>
  );
}

function Notifications() {
  const client = useQueryClient();
  const settings = useQuery({ queryKey: ["alert-settings"], queryFn: () => api<AlertSettingsDto>("/api/messaging") });
  const save = useMutation({
    mutationFn: (prefs: AlertSettingsDto["prefs"]) => api<AlertSettingsDto>("/api/messaging", { method: "PATCH", body: JSON.stringify(prefs) }),
    onSuccess: (data) => client.setQueryData(["alert-settings"], data),
    onError: (caught) => toast.error(errorMessage(caught)),
  });
  const prefs = settings.data?.prefs;
  const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC";
  // Until saved once, show the browser's own time zone, as the alerts do.
  const zone = prefs ? (settings.data?.saved ? prefs.timeZone : detectedZone) : "";
  const update = (patch: (p: AlertSettingsDto["prefs"]) => AlertSettingsDto["prefs"]) => {
    if (prefs) save.mutate(patch({ ...prefs, timeZone: zone }));
  };
  return (
    <Section id="alerts" title="Messages from Desker" hint="What it sends you on LINE, Telegram and email.">
      {!prefs ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : (
        <div className="space-y-4">
          <Row label="Pause everything" hint="Stops all messages. Nothing is lost.">
            <Switch checked={prefs.paused} onCheckedChange={(paused) => update((p) => ({ ...p, paused }))} aria-label="Pause everything" />
          </Row>
          <Row label="Morning brief" hint="Your day in one message.">
            <Switch checked={prefs.brief.on} onCheckedChange={(on) => update((p) => ({ ...p, brief: { ...p.brief, on } }))} aria-label="Morning brief" />
          </Row>
          {prefs.brief.on ? (
            <Field label="Brief time" htmlFor="brief-time">
              <Input
                type="time"
                className="w-36"
                defaultValue={prefs.brief.time}
                onBlur={(event) => event.target.value && update((p) => ({ ...p, brief: { ...p.brief, time: event.target.value } }))}
              />
            </Field>
          ) : null}
          <Field label="Time zone" htmlFor="tz" hint="Dates, schedules, reminders and messages use it.">
            <Input
              defaultValue={zone}
              key={zone}
              onBlur={(event) => event.target.value.trim() && update((p) => ({ ...p, timeZone: event.target.value.trim() }))}
            />
          </Field>
        </div>
      )}
    </Section>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-sm text-ink-muted">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function DataSection({ email }: { email: string }) {
  const [confirming, setConfirming] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const remove = useMutation({
    mutationFn: () => api("/api/account", { method: "DELETE", body: JSON.stringify({ confirmEmail: typed }) }),
    onSuccess: () => void signOut({ callbackUrl: "/" }),
    onError: (caught) => toast.error(errorMessage(caught)),
  });
  return (
    <Section id="data" title="Your data" hint="Take a copy, or erase everything.">
      <div className="space-y-5">
        <Button variant="secondary" asChild>
          <a href="/api/account" download>
            <Download aria-hidden />
            Download my data
          </a>
        </Button>
        <div className="border-t border-line pt-5">
          <p className="text-sm font-medium text-ink">Delete my account</p>
          <p className="mt-1 text-sm text-ink-muted">Erases your chats, memory, files and connections for good. This can&rsquo;t be undone.</p>
          {confirming ? (
            <form
              className="mt-3 flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                remove.mutate();
              }}
            >
              <Field label={`Type ${email} to confirm`} htmlFor="confirm-email" className="min-w-64 flex-1">
                <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
              </Field>
              <Button type="submit" variant="danger" disabled={remove.isPending || typed.trim().toLowerCase() !== email.toLowerCase()}>
                Delete everything
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <Button variant="danger" className="mt-3" onClick={() => setConfirming(true)}>
              Delete my account
            </Button>
          )}
        </div>
      </div>
    </Section>
  );
}
