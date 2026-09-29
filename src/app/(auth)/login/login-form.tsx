"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Panel, PanelBody } from "@/components/ui/panel";
import { FormError } from "@/components/ui/states";
import { BrandLockup } from "@/components/brand-logo";
import { PRIVATE_BETA_CODE, PRIVATE_BETA_MESSAGE } from "@/lib/private-beta";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const inviteToken = search.get("invite");
  const template = search.get("template");
  const justReset = search.get("reset") === "1";
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      redirect: false,
    });

    if (result?.error) {
      // Deliberately not distinguishing "no such account" from "wrong password".
      setError(
        result.code === PRIVATE_BETA_CODE
          ? PRIVATE_BETA_MESSAGE
          : "That email and password combination doesn't match an account.",
      );
      setPending(false);
      return;
    }

    router.push(
      inviteToken
        ? `/invite/${inviteToken}`
        : template
          ? `/?template=${encodeURIComponent(template)}`
          : "/",
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <BrandLockup />
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">Sign in</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Desker is in private beta. Sign-in is open to our testers for now.{" "}
          <Link href="/beta" className="font-medium text-accent hover:underline">
            Join the beta list
          </Link>{" "}
          to get an invite.
        </p>
      </div>

      <Panel className="window shadow-md">
        <PanelBody className="p-6 sm:p-7">
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            {justReset && !error ? (
              <p role="status" className="rounded-md border border-positive-line bg-positive-soft px-3 py-2 text-sm text-positive">
                Password changed. Sign in with your new one.
              </p>
            ) : null}
            <FormError message={error} />

            <Field label="Email" htmlFor="email" required>
              <Input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
              />
            </Field>

            <Field label="Password" htmlFor="password" required>
              <Input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </Field>
            <p className="-mt-3 text-right text-sm">
              <Link href="/forgot-password" className="font-medium text-accent hover:underline">
                Forgot password?
              </Link>
            </p>

            <Button type="submit" className="w-full" loading={pending}>
              Sign in
            </Button>
          </form>
        </PanelBody>
      </Panel>

      <p className="text-center text-sm text-ink-muted">
        No account yet?{" "}
        <Link href={inviteToken ? `/signup?invite=${encodeURIComponent(inviteToken)}` : "/signup"} className="font-medium text-accent hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
