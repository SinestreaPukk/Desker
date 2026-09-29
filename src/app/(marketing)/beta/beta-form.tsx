"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/states";
import { api, ApiError } from "@/lib/api-client";
import { FIRST_HIRES } from "@/lib/beta";

export function BetaForm() {
  const [state, setState] = React.useState<"idle" | "sending" | "sent">("idle");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    // Checked here first, so a mistyped address gets a message in our voice
    // rather than the browser's; the server checks it again.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldErrors({ email: ["That address doesn't look right. Try one like you@yourbusiness.com."] });
      return;
    }
    setState("sending");
    const data = new FormData(event.currentTarget);
    try {
      await api("/api/beta", {
        method: "POST",
        body: JSON.stringify({
          email,
          firstHire: String(data.get("firstHire") ?? ""),
          // A field people never see; bots fill it in.
          website: String(data.get("website") ?? ""),
        }),
      });
      setState("sent");
    } catch (caught) {
      setState("idle");
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setError("That didn't go through. Check your connection and try again.");
      }
    }
  }

  if (state === "sent") {
    return (
      <div role="status" className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">You&apos;re on the list</h2>
        <p className="text-base leading-relaxed text-ink-muted">
          We&apos;ll email <span className="font-medium text-ink">{email}</span> when your group opens. There&apos;s
          no payment during the beta.
        </p>
        <Link href="/showcase" className="inline-flex min-h-[44px] items-center text-sm font-medium text-accent hover:underline">
          Meanwhile, see every role at work
        </Link>
      </div>
    );
  }

  return (
    // The browser checks the address before anything is sent; the server
    // checks it again. The banner is for errors no field shows.
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={Object.keys(fieldErrors).length > 0 ? null : error} />
      <Field label="Email" htmlFor="beta-email" required error={fieldErrors.email?.[0]}>
        <Input
          id="beta-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">
          Who would you hire first? <span className="font-normal text-ink-muted">Optional</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {FIRST_HIRES.map((role) => (
            <label
              key={role}
              className="flex min-h-[44px] cursor-pointer items-center rounded-lg border border-line bg-surface px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent-line has-[:checked]:border-accent has-[:checked]:bg-accent-soft/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
            >
              <input type="radio" name="firstHire" value={role} className="sr-only" />
              {role}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="hidden" aria-hidden>
        <label htmlFor="beta-website">Website</label>
        <input id="beta-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="space-y-3">
        <Button type="submit" size="lg" loading={state === "sending"} className="rounded-full px-7 font-hand text-hand-cta font-bold">
          Join the beta
        </Button>
        <p className="text-sm text-ink-muted">
          We use your email to invite you to the beta. See the{" "}
          <Link href="/privacy" className="text-accent underline underline-offset-4 hover:text-accent-hover">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
