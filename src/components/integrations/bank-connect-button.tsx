"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

const LINK_SCRIPT = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

interface PlaidLink {
  create(config: {
    token: string;
    onSuccess: (publicToken: string, metadata: { institution?: { name: string } | null }) => void;
    onExit: () => void;
  }): { open(): void };
}

function loadLink(): Promise<PlaidLink> {
  const ready = () => (window as unknown as { Plaid?: PlaidLink }).Plaid;
  if (ready()) return Promise.resolve(ready()!);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LINK_SCRIPT;
    script.onload = () => resolve(ready()!);
    script.onerror = () => reject(new Error("Could not load the bank sign-in window."));
    document.head.appendChild(script);
  });
}

/** Opens Plaid's own sign-in window; Desker never sees the bank password. */
export function BankConnectButton({ project, onConnected }: { project: string; onConnected?: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const query = `?project=${encodeURIComponent(project)}`;

  async function post(path: string, body?: unknown) {
    const response = await fetch(`/api/integrations/bank/${path}${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json?.error?.message ?? json?.error ?? "Something went wrong.");
    return json.data ?? json;
  }

  async function start() {
    setBusy(true);
    setError("");
    try {
      const [{ linkToken }, Plaid] = await Promise.all([post("link-token"), loadLink()]);
      Plaid.create({
        token: linkToken,
        onSuccess: async (publicToken, metadata) => {
          try {
            await post("connect", { publicToken, institution: metadata.institution?.name });
            onConnected?.();
            window.location.reload();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save the connection.");
            setBusy(false);
          }
        },
        onExit: () => setBusy(false),
      }).open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the connection.");
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" className="shrink-0" onClick={start} disabled={busy}>
        {busy ? "Connecting…" : "Connect bank"}
      </Button>
      {error ? <p role="alert" className="mt-1 text-xs text-danger">{error}</p> : null}
    </>
  );
}
