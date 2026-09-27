"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Panel, PanelBody } from "@/components/ui/panel";
import { FormError } from "@/components/ui/states";
import { BrandLockup } from "@/components/brand-logo";
import { api, errorMessage } from "@/lib/api-client";

/**
 * Step one of a reset: the address. The answer is the same whether or not an
 * account exists for it, so this page cannot tell anyone who has one.
 */
export function ForgotPasswordForm() {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    try {
      await api("/api/password-reset", { method: "POST", body: JSON.stringify({ email }) });
      setSentTo(email);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <BrandLockup />
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">Reset your password</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          {sentTo ? "Check your email." : "We'll email you a link to choose a new one."}
        </p>
      </div>

      <Panel className="window shadow-md">
        <PanelBody className="p-6 sm:p-7">
          {sentTo ? (
            <div className="space-y-3 text-sm text-ink" role="status">
              <p>
                If there&apos;s a Desker account for <span className="font-medium">{sentTo}</span>, a reset link is on
                its way. It works for one hour.
              </p>
              <p className="text-ink-muted">Nothing after a few minutes? Check your spam folder, or try again.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              <FormError message={error} />
              <Field label="Email" htmlFor="email" required>
                <Input name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
              </Field>
              <Button type="submit" className="w-full" loading={pending}>
                Send reset link
              </Button>
            </form>
          )}
        </PanelBody>
      </Panel>

      <p className="text-center text-sm text-ink-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
