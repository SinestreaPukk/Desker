import type { Metadata } from "next";
import { PageHeader } from "@/components/marketing/page-header";
import { Check } from "lucide-react";
import { StickyNote } from "@/components/marketing/desk-notes";
import { AgentAvatar } from "@/components/ui/avatar";
import { pageMetadata } from "@/lib/content";
import { BetaForm } from "./beta-form";

export const metadata: Metadata = pageMetadata({
  title: "Join the beta",
  description: "Beta opens soon. Join the list for an invite.",
  path: "/beta",
});

const PROMISES = [
  "An email from us when your group opens, with your invite",
  "No payment during the beta",
  "Your staff draft; every post and email waits for your yes",
  "Nothing you upload is used to train an AI model",
];

/** Where every "Join the beta" goes: one email field and one optional question. */
export default function BetaPage() {
  return (
    <>
      <PageHeader
        hand
        title="Join the Desker beta"
        intro="Beta opens soon. Join the list for an invite, and tell us who you'd hire first."
      />
      {/* The form rises into the header band, as it does on the contact page:
          the form on a pale lemon note, and beside it a note from Kai. */}
      <div className="relative z-10 mx-auto -mt-24 max-w-6xl px-4 pb-24 sm:-mt-28 sm:px-6 sm:pb-28">
        <div className="grid items-start gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <StickyNote tone="lemon" tilt={-0.6} settle={false} soft className="note-plain relative p-6 sm:p-8">
            <BetaForm />
          </StickyNote>
          <StickyNote tone="mint" tilt={1.2} settle={false} soft className="relative p-6">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <AgentAvatar name="Kai" seed="kai" size="sm" />
              Kai · Assistant
            </p>
            <h2 className="mt-3 font-hand text-hand-cta font-bold">What joining means</h2>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed">
              {PROMISES.map((line) => (
                <li key={line} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </StickyNote>
        </div>
      </div>
    </>
  );
}
