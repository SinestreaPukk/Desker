"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/states";
import { api, ApiError } from "@/lib/api-client";
import { CONTACT } from "@/lib/content";

export function ContactForm() {
  const { form } = CONTACT;
  const [state, setState] = React.useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setState("sending");
    const data = new FormData(event.currentTarget);
    try {
      await api("/api/contact", {
        method: "POST",
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          company: String(data.get("company") ?? ""),
          message: String(data.get("message") ?? ""),
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
        setError(form.error);
      }
    }
  }

  if (state === "sent") {
    return (
      <p role="status" className="rounded-panel border border-positive-line bg-positive-soft/50 px-4 py-3 text-base text-ink">
        {form.success}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4" noValidate>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={form.name} htmlFor="contact-name" required error={fieldErrors.name?.[0]}>
          <Input id="contact-name" name="name" autoComplete="name" required />
        </Field>
        <Field label={form.email} htmlFor="contact-email" required error={fieldErrors.email?.[0]}>
          <Input id="contact-email" name="email" type="email" autoComplete="email" required />
        </Field>
      </div>
      <Field label={form.company} htmlFor="contact-company" error={fieldErrors.company?.[0]}>
        <Input id="contact-company" name="company" autoComplete="organization" />
      </Field>
      <Field label={form.message} htmlFor="contact-message" required error={fieldErrors.message?.[0]}>
        <Textarea id="contact-message" name="message" rows={6} required />
      </Field>
      <div className="hidden" aria-hidden>
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <Button type="submit" size="lg" loading={state === "sending"}>
        {form.submit}
      </Button>
    </form>
  );
}
