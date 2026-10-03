"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/shared/api-client";

interface Data {
  details: { label: string; value: string }[];
  logins: { site: string; username: string }[];
}

/** What it may type into forms, and the logins it made for you. All of it is stored encrypted. */
export function DetailsSection({ project }: { project: string }) {
  const client = useQueryClient();
  const key = ["details", project];
  const data = useQuery({ queryKey: key, queryFn: () => api<Data>(`/api/details?project=${encodeURIComponent(project)}`) });
  const [label, setLabel] = React.useState("");
  const [value, setValue] = React.useState("");
  const [shown, setShown] = React.useState<Record<string, string>>({});

  const add = useMutation({
    mutationFn: () => api<Pick<Data, "details">>("/api/details", { method: "PUT", body: JSON.stringify({ project, label, value }) }),
    onSuccess: (next) => {
      client.setQueryData<Data>(key, (old) => ({ logins: old?.logins ?? [], details: next.details }));
      setLabel("");
      setValue("");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });
  const remove = useMutation({
    mutationFn: (name: string) => api<Pick<Data, "details">>(`/api/details?project=${encodeURIComponent(project)}&label=${encodeURIComponent(name)}`, { method: "DELETE" }),
    onSuccess: (next) => client.setQueryData<Data>(key, (old) => ({ logins: old?.logins ?? [], details: next.details })),
    onError: (caught) => toast.error(errorMessage(caught)),
  });
  const forgetLogin = useMutation({
    mutationFn: (site: string) => api<Pick<Data, "logins">>(`/api/logins?project=${encodeURIComponent(project)}&site=${encodeURIComponent(site)}`, { method: "DELETE" }),
    onSuccess: (next) => client.setQueryData<Data>(key, (old) => ({ details: old?.details ?? [], logins: next.logins })),
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  async function reveal(site: string) {
    try {
      const login = await api<{ username: string; password: string }>("/api/logins", { method: "POST", body: JSON.stringify({ project, site }) });
      setShown((current) => ({ ...current, [site]: login.password }));
      setTimeout(() => setShown((current) => Object.fromEntries(Object.entries(current).filter(([k]) => k !== site))), 15_000);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  if (data.isPending) return <Skeleton className="h-32" aria-busy aria-label="Loading" />;
  const details = data.data?.details ?? [];
  const logins = data.data?.logins ?? [];

  return (
    <div className="space-y-10">
      <section aria-labelledby="details">
        <h2 id="details" className="text-lg font-semibold text-ink">
          Details it can fill in
        </h2>
        <p className="mb-3 text-sm text-ink-muted">Your name, email, phone, address. It types these into forms for you. Stored encrypted.</p>
        {details.length > 0 ? (
          <ul className="mb-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {details.map((detail) => (
              <li key={detail.label} className="flex items-center gap-3 px-4 py-3">
                <p className="w-32 shrink-0 truncate text-sm font-medium text-ink">{detail.label}</p>
                <p className="min-w-0 flex-1 truncate text-ink">{detail.value}</p>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${detail.label}`} onClick={() => remove.mutate(detail.label)}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate();
          }}
        >
          <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Phone" aria-label="Detail name" className="w-40" maxLength={60} />
          <Input value={value} onChange={(event) => setValue(event.target.value)} placeholder="0812345678" aria-label="Detail value" className="min-w-40 flex-1" maxLength={300} />
          <Button type="submit" variant="secondary" disabled={!label.trim() || !value.trim()} loading={add.isPending}>
            <Plus aria-hidden />
            Add
          </Button>
        </form>
      </section>

      {logins.length > 0 ? (
        <section aria-labelledby="logins">
          <h2 id="logins" className="text-lg font-semibold text-ink">
            Accounts it made for you
          </h2>
          <p className="mb-3 text-sm text-ink-muted">The logins for sites it signed you up to. Passwords are shown only when you ask.</p>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {logins.map((login) => (
              <li key={login.site} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{login.site}</p>
                  <p className="truncate text-sm text-ink-muted">{login.username}</p>
                  {shown[login.site] ? <code className="mt-1 inline-block rounded-md bg-surface-2 px-2 py-0.5 font-mono text-sm text-ink">{shown[login.site]}</code> : null}
                </div>
                <Button variant="ghost" size="sm" onClick={() => void reveal(login.site)}>
                  <Eye aria-hidden />
                  Show password
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Forget ${login.site}`} onClick={() => forgetLogin.mutate(login.site)}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
