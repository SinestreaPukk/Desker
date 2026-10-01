"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Building, Layers, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Panel, PanelBody } from "@/components/ui/panel";
import { FormError } from "@/components/ui/states";
import { api, ApiError } from "@/lib/api-client";
import { BrandLockup } from "@/components/brand-logo";
import type { UseType } from "@/lib/validation";

const USE_TYPE_OPTIONS: { value: UseType; label: string; hint: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }> }[] = [
  { value: "business", label: "Business", hint: "AI staff for my company", icon: Building },
  { value: "personal", label: "Personal", hint: "Help with my own life", icon: UserRound },
  { value: "mixed", label: "Both", hint: "One of each, kept apart", icon: Layers },
];

export function SignupForm({ invite }: { invite?: { token: string; email: string; organization: string } | null }) {
  const router = useRouter();
  const search = useSearchParams();
  const inviteToken = invite?.token ?? search.get("invite") ?? undefined;
  // From the showcase: the chosen role rides along into the hire wizard.
  const template = search.get("template");
  const next = template ? `/?template=${encodeURIComponent(template)}` : "/";
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [accepted, setAccepted] = React.useState(false);
  // Joining someone's team through an invitation is always business use.
  const [useType, setUseType] = React.useState<UseType | null>(invite ? "business" : null);
  const asksBusinessName = !invite && (useType === "business" || useType === "mixed");

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
          firstName: String(form.get("firstName") ?? ""),
          lastName: String(form.get("lastName") ?? ""),
          username: String(form.get("username") ?? ""),
          ...(asksBusinessName ? { organization: String(form.get("organization") ?? "") } : {}),
          useType: useType ?? "",
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
    router.push(next);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <BrandLockup />
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">Create your account</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          AI staff for your business, AI help for your own life, or both.
        </p>
      </div>

      <Panel className="window shadow-md">
        <PanelBody className="p-6 sm:p-7">
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <FormError message={error} />

            {invite ? null : (
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-ink">
                  What&apos;s Desker for? <span className="text-danger" aria-hidden>*</span>
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {USE_TYPE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <label
                        key={option.value}
                        className="flex cursor-pointer flex-col rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors hover:border-accent-line has-[:checked]:border-accent has-[:checked]:bg-accent-soft/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
                      >
                        <input
                          type="radio"
                          name="useType"
                          value={option.value}
                          checked={useType === option.value}
                          onChange={() => setUseType(option.value)}
                          required
                          className="sr-only"
                        />
                        <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                          <Icon className="size-4 text-accent" aria-hidden />
                          {option.label}
                        </span>
                        <span className="mt-0.5 text-xs text-ink-muted">{option.hint}</span>
                      </label>
                    );
                  })}
                </div>
                {fieldErrors.useType?.[0] ? (
                  <p className="mt-1.5 text-xs text-danger">{fieldErrors.useType[0]}</p>
                ) : useType === "personal" || useType === "mixed" ? (
                  <p className="mt-1.5 text-xs text-ink-muted">
                    Your personal space is yours alone: nobody can be invited into it, its assistants have no public
                    link, and you can download or delete everything in it at any time.
                  </p>
                ) : null}
              </fieldset>
            )}

            {asksBusinessName ? (
              <Field label="Business name" htmlFor="organization" required error={fieldErrors.organization?.[0]}>
                <Input name="organization" autoComplete="organization" required placeholder="Chen Studio" />
              </Field>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="firstName" required error={fieldErrors.firstName?.[0]}>
                <Input name="firstName" autoComplete="given-name" required placeholder="Alex" />
              </Field>
              <Field label="Last name" htmlFor="lastName" required error={fieldErrors.lastName?.[0]}>
                <Input name="lastName" autoComplete="family-name" required placeholder="Chen" />
              </Field>
            </div>

            <Field
              label="Username"
              htmlFor="username"
              required
              hint="Letters, numbers, dots, dashes or underscores."
              error={fieldErrors.username?.[0]}
            >
              <Input
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                minLength={3}
                maxLength={30}
                placeholder="alexchen"
              />
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
                  I&apos;m 18 or older and agree to the{" "}
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

            <Button type="submit" className="w-full" loading={pending} disabled={!accepted || !useType}>
              Create account
            </Button>
          </form>
        </PanelBody>
      </Panel>

      <p className="text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link
          href={
            inviteToken
              ? `/login?invite=${encodeURIComponent(inviteToken)}`
              : template
                ? `/login?template=${encodeURIComponent(template)}`
                : "/login"
          }
          className="font-medium text-accent hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
