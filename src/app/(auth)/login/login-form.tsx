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

export function LoginForm() {
  const router = useRouter();
  const inviteToken = useSearchParams().get("invite");
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
      setError("That email and password combination doesn't match an account.");
      setPending(false);
      return;
    }

    router.push(inviteToken ? `/invite/${inviteToken}` : "/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <BrandLockup />
        <h1 className="mt-5 text-2xl font-semibold text-ink">Sign in</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Manage your roster of AI employees.
        </p>
      </div>

      <Panel>
        <PanelBody className="pt-5">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
