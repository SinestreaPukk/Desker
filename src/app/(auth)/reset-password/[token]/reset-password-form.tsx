"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Panel, PanelBody } from "@/components/ui/panel";
import { FormError } from "@/components/ui/states";
import { BrandLockup } from "@/components/brand-logo";
import { api, errorMessage } from "@/lib/api-client";

/** Step two: the new password, typed twice so a slip does not lock anyone out. */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== String(form.get("confirm") ?? "")) return setError("The two passwords don't match.");
    setPending(true);
    try {
      await api("/api/password-reset/confirm", { method: "POST", body: JSON.stringify({ token, password }) });
      router.push("/login?reset=1");
    } catch (caught) {
      setError(errorMessage(caught));
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <BrandLockup />
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-ink-muted">You&apos;ll be signed out everywhere else once it&apos;s changed.</p>
      </div>
      <Panel className="window shadow-md">
        <PanelBody className="p-6 sm:p-7">
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <FormError message={error} />
            <Field label="New password" htmlFor="password" required hint="At least 8 characters.">
              <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
            </Field>
            <Field label="Type it again" htmlFor="confirm" required>
              <Input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
            </Field>
            <Button type="submit" className="w-full" loading={pending}>
              Change password
            </Button>
          </form>
        </PanelBody>
      </Panel>
    </div>
  );
}
