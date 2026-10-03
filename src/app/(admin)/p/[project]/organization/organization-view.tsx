"use client";

import * as React from "react";
import { Building, Download, ShieldCheck, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { api } from "@/lib/shared/api-client";
import { Page, PageBody, PageHeader } from "@/components/page-header";
import { ProjectContextPanel } from "@/components/builder/project-context-panel";
import { CheckInSettingsPanel } from "@/components/work/check-in-settings-panel";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import { FormError } from "@/components/ui/states";
import {
  useOrganization,
  useUpdateOrganization,
} from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/shared/api-client";

export function OrganizationView({
  project,
  organizationId,
}: {
  project: string;
  organizationId: string;
}) {
  const org = useOrganization(organizationId);
  const role = org.data?.role ?? "member";
  const isOwner = role === "owner";

  return (
    <Page>
      <PageHeader
        title={org.data?.name ?? "Your space"}
        description="Private to you. What your assistants know about you, and your data."
      />
      <PageBody className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          <ProjectContextPanel project={project} />
          <CheckInSettingsPanel project={project} />
          <PrivacyPanel />
        </div>
        <div className="space-y-5">
          {isOwner && org.data ? <RenamePanel organizationId={organizationId} name={org.data.name} label="Space name" /> : null}
          <YourDataPanel />
        </div>
      </PageBody>
    </Page>
  );
}

function RenamePanel({ organizationId, name, label = "Organisation name" }: { organizationId: string; name: string; label?: string }) {
  const rename = useUpdateOrganization(organizationId);
  const [value, setValue] = React.useState(name);
  const [note, setNote] = React.useState<string | null>(null);
  return (
    <Panel>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setNote(null);
          try {
            await rename.mutateAsync({ name: value.trim() });
            setNote("Saved.");
          } catch (caught) {
            setNote(errorMessage(caught));
          }
        }}
      >
        <PanelHeader>
          <div>
            <PanelTitle>
              <Building className="mr-1.5 inline size-4 text-accent" aria-hidden />
              Name
            </PanelTitle>
          </div>
        </PanelHeader>
        <PanelBody>
          <Field label={label} htmlFor="org-name" hint={note ?? undefined}>
            <Input id="org-name" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        </PanelBody>
        <PanelFooter className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            variant={value.trim() && value.trim() !== name ? "primary" : "secondary"}
            disabled={rename.isPending || !value.trim() || value.trim() === name}
          >
            Save
          </Button>
        </PanelFooter>
      </form>
    </Panel>
  );
}

/** What a personal space promises, in plain words: each line is enforced in code, not policy alone. */
function PrivacyPanel() {
  const promises = [
    "Only you can open this space. Nobody can be invited into it.",
    "Your assistants have no public chat link or widget.",
    "Nothing leaves without your yes: every email and post waits for your approval.",
    "Statements are added up on our server, and account and card numbers are masked before any AI reads them.",
    "What you share is never used to train AI models, and never sold.",
  ];
  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>
            <ShieldCheck className="mr-1.5 inline size-4 text-accent" aria-hidden />
            Private by design
          </PanelTitle>
          <PanelDescription>How this space keeps your life your own.</PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody>
        <ul className="space-y-2 text-sm text-ink">
          {promises.map((line) => (
            <li key={line} className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  );
}

/**
 * The two data rights, as buttons rather than an email to write: download
 * everything, or delete the account with every space it solely owns.
 */
function YourDataPanel() {
  const [confirming, setConfirming] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function remove() {
    setError(null);
    setDeleting(true);
    try {
      await api("/api/account", { method: "DELETE", body: JSON.stringify({ confirmEmail: email }) });
      await signOut({ callbackUrl: "/" });
    } catch (caught) {
      setError(errorMessage(caught));
      setDeleting(false);
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>
            <Download className="mr-1.5 inline size-4 text-accent" aria-hidden />
            Your data
          </PanelTitle>
          <PanelDescription>
            Everything in your account and the spaces you own. Take a copy any time, or delete it all.
          </PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/account"
            download
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:border-accent-line"
          >
            <Download className="size-4" aria-hidden />
            Download my data
          </a>
          <Button variant="secondary" size="sm" onClick={() => setConfirming((open) => !open)} aria-expanded={confirming}>
            <Trash2 aria-hidden />
            Delete my account
          </Button>
        </div>
        {confirming ? (
          <div className="space-y-3 rounded-lg border border-danger/40 p-3">
            <p className="text-sm text-ink">
              This deletes your account and every space you alone own: assistants, documents, chats, drafts and history.
              It can&apos;t be undone. Download your data first if you want a copy.
            </p>
            <FormError message={error} />
            <Field label="Type your email address to confirm" htmlFor="confirm-delete">
              <Input id="confirm-delete" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button variant="danger" size="sm" loading={deleting} disabled={!email.trim()} onClick={() => void remove()}>
              Delete everything
            </Button>
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
