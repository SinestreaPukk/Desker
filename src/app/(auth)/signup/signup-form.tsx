"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Panel, PanelBody } from "@/components/ui/panel";
import { FormError } from "@/components/ui/states";
import { api, ApiError } from "@/lib/api-client";
import { BrandLockup } from "@/components/brand-logo";

export function SignupForm({ invite }: { invite?: { token: string; email: string; organization: string } | null }) {
  const router = useRouter();
  const search = useSearchParams();
  const inviteToken = invite?.token ?? search.get("invite") ?? undefined;
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [accepted, setAccepted] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      await api("/api/signup", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          email,
          password,
          acceptTerms: accepted,
          ...(inviteToken ? { invite: inviteToken } : {}),
        }),
      });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setError("Could not create your account. Please try again.");
      }
      setPending(false);
      return;
    }

    // Sign straight in - a new admin should land on the onboarding flow, not
    // be bounced back to a login form they just filled in.
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      router.push("/login");
      return;
    }

    // The root resolves the project and forwards into its wizard.
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <BrandLockup />
        <h1 className="mt-5 text-xl font-semibold text-ink">Create your account</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          One workspace, as many AI employees as you need.
        </p>
      </div>

      <Panel>
        <PanelBody className="pt-5">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormError message={error} />

            <Field label="Your name" htmlFor="name" hint="Optional.">
              <Input name="name" autoComplete="name" placeholder="Alex Chen" />
            </Field>

            <Field
              label="Email"
              htmlFor="email"
              required
              error={fieldErrors.email?.[0]}
            >
              <Input
                name="email"
                defaultValue={invite?.email ?? ""}
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              required
              hint="At least 8 characters."
              error={fieldErrors.password?.[0]}
            >
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                placeholder="••••••••"
              />
            </Field>

            <div>
              <label htmlFor="accept-terms" className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
                <Checkbox
                  id="accept-terms"
                  checked={accepted}
                  onCheckedChange={(next) => setAccepted(next === true)}
                  className="mt-0.5"
                />
                <span>
                  I agree to the{" "}
                  <Link href="/terms" target="_blank" className="font-medium text-accent hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank" className="font-medium text-accent hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {fieldErrors.acceptTerms?.[0] ? (
                <p className="mt-1.5 text-xs text-danger">{fieldErrors.acceptTerms[0]}</p>
              ) : null}
            </div>

            <Button type="submit" className="w-full" loading={pending} disabled={!accepted}>
              Create account
            </Button>
          </form>
        </PanelBody>
      </Panel>

      <p className="text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : "/login"} className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
