import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { readOptOutToken } from "@/lib/email-optout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Panel, PanelBody } from "@/components/ui/panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

/**
 * Where the link at the foot of every agent and digest email lands. It asks
 * for one click rather than acting on the visit, because mail scanners open
 * links on their own; the mail app's own Unsubscribe button skips this page.
 */
export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { token } = await params;
  const { done, error } = await searchParams;
  const optOut = readOptOutToken(token);
  const organization = optOut
    ? await prisma.organization.findUnique({ where: { id: optOut.organizationId }, select: { name: true } })
    : null;

  return (
    <Panel className="window shadow-md">
      <PanelBody className="space-y-4 p-6">
        {!optOut || !organization ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-ink">This link doesn&apos;t work</h1>
            <p className="text-sm text-ink-muted">
              It may have been cut short when it was copied. Try the link in the email again, or reply to the email and
              ask to be taken off the list.
            </p>
          </>
        ) : done ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-ink">You&apos;re unsubscribed</h1>
            <p className="text-sm text-ink-muted">
              {organization.name} won&apos;t send emails through Desker to {optOut.email ?? "that address"} again.
            </p>
          </>
        ) : (
          <form method="post" action={`/api/unsubscribe/${token}`} className="space-y-4">
            <h1 className="text-xl font-semibold tracking-tight text-ink">Stop emails from {organization.name}</h1>
            {optOut.email ? (
              <p className="text-sm text-ink-muted">
                {optOut.email} will no longer receive emails {organization.name} sends through Desker.
              </p>
            ) : (
              <label className="block space-y-1.5 text-sm text-ink">
                <span>Which address should we take off the list?</span>
                <Input name="email" type="email" required autoComplete="email" />
              </label>
            )}
            {error ? <p className="text-sm text-danger">Enter the email address the message was sent to.</p> : null}
            <Button type="submit" className="w-full">
              Unsubscribe
            </Button>
          </form>
        )}
      </PanelBody>
    </Panel>
  );
}
