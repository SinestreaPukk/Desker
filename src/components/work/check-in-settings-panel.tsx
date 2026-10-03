"use client";

import * as React from "react";
import { Mail, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input } from "@/components/ui/field";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, LoadingRows } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/shared/api-client";
import { badRecipients } from "@/lib/shared/form-errors";
import type { DigestCadence } from "@/lib/work/types";

interface Settings {
  id: string;
  name: string;
  cadence: DigestCadence;
  timezone: string;
  email: boolean;
  recipients: string;
}

export function CheckInSettingsPanel({ project }: { project: string }) {
  const [saved, setSaved] = React.useState<Settings | null>(null);
  const [form, setForm] = React.useState<Settings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const endpoint = `/api/projects/${encodeURIComponent(project)}/check-in`;

  const load = React.useCallback(async () => {
    const settings = await api<Settings>(endpoint);
    setSaved(settings);
    setForm(settings);
    setError(null);
    setLoading(false);
  }, [endpoint]);

  React.useEffect(() => {
    let active = true;
    api<Settings>(endpoint)
      .then((settings) => {
        if (active) { setSaved(settings); setForm(settings); setLoading(false); }
      })
      .catch((caught) => { if (active) { setError(errorMessage(caught)); setLoading(false); } });
    return () => { active = false; };
  }, [endpoint]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const value = await api<Settings>(endpoint, {
        method: "PUT",
        body: JSON.stringify({ cadence: form.cadence, email: form.email, recipients: form.recipients, timezone: form.timezone }),
      });
      setSaved(value);
      setForm(value);
      toast.success("Check-in settings saved");
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setSaving(false); }
  }

  if (loading) return <LoadingRows count={2} />;
  if (error && !form) return <ErrorState message={error} onRetry={() => { setLoading(true); void load().catch((caught) => { setError(errorMessage(caught)); setLoading(false); }); }} />;
  if (!form || !saved) return null;
  const invalidRecipient = form.email ? badRecipients(form.recipients)[0] : undefined;
  const dirty = form.cadence !== saved.cadence || form.email !== saved.email || form.recipients !== saved.recipients || form.timezone !== saved.timezone;

  return <Panel id="check-in-settings" className="scroll-mt-4">
    <PanelHeader>
      <div><PanelTitle>Project check-in</PanelTitle><PanelDescription>One update across the agents you include: completed work, approvals, failures, and changes in health.</PanelDescription></div>
    </PanelHeader>
    <PanelBody className="space-y-5">
      {error ? <p role="alert" className="rounded-lg border border-danger-line bg-danger-soft/40 px-3 py-2 text-sm text-danger">{error}</p> : null}
      <Field label="How often" htmlFor="check-in-cadence" hint={`Sent at 8 a.m. in ${form.timezone}.`}>
        <Select value={form.cadence} onValueChange={(cadence) => setForm({ ...form, cadence: cadence as DigestCadence })}>
          <SelectTrigger id="check-in-cadence"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off</SelectItem>
            <SelectItem value="daily">Every morning</SelectItem>
            <SelectItem value="weekly">Monday morning</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {form.cadence !== "off" ? <>
        <label htmlFor="check-in-email" className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <Checkbox id="check-in-email" checked={form.email} onCheckedChange={(email) => setForm({ ...form, email })} />
          <Mail className="size-4 text-ink-muted" aria-hidden /> Email the check-in too
        </label>
        {form.email ? <Field label="Send to" htmlFor="check-in-recipients" hint="Comma-separated. Leave blank for this organisation’s owners and admins." error={invalidRecipient ? `${invalidRecipient} is not a valid address.` : undefined}>
          <Input value={form.recipients} onChange={(event) => setForm({ ...form, recipients: event.target.value })} placeholder="you@example.com, ops@example.com" />
        </Field> : null}
      </> : null}
      <div className="flex justify-end border-t border-line pt-3">
        <Button size="sm" loading={saving} disabled={!dirty || Boolean(invalidRecipient)} onClick={() => void save()}><Save aria-hidden />Save settings</Button>
      </div>
    </PanelBody>
  </Panel>;
}
