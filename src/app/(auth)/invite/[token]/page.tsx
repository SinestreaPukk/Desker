import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { acceptInvitation, findOpenInvitation, InviteMismatch } from "@/lib/invites";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody } from "@/components/ui/panel";
import { BrandLockup } from "@/components/brand-logo";

export const metadata: Metadata = { title: "Invitation" };

/**
 * The link in an invitation email. Signed in as the invited address, it
 * accepts and forwards into the organisation; signed out, it offers sign-in
 * or sign-up with the token carried along.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await findOpenInvitation(token);

  if (!invitation) {
    return (
      <Shell title="This invitation is no longer valid">
        <p className="text-[0.8125rem] text-ink-muted">
          It may have expired, been revoked, or already been used. Ask whoever invited you to send a
          new one.
        </p>
        <Button asChild className="mt-4" variant="secondary">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </Shell>
    );
  }

  const user = await currentUser();
  if (user) {
    try {
      await acceptInvitation(token, user);
    } catch (error) {
      if (error instanceof InviteMismatch) {
        return (
          <Shell title={`Join ${invitation.organization.name}`}>
            <p className="text-[0.8125rem] text-ink-muted">{error.message}</p>
            <p className="mt-1 text-xs text-ink-subtle">You are signed in as {user.email}.</p>
            <Button asChild className="mt-4" variant="secondary">
              <Link href={`/api/auth/signout?callbackUrl=${encodeURIComponent(`/login?invite=${token}`)}`}>
                Sign out and switch account
              </Link>
            </Button>
          </Shell>
        );
      }
      throw error;
    }
    const project = await prisma.project.findFirst({
      where: { organizationId: invitation.organizationId },
      orderBy: { createdAt: "asc" },
      select: { slug: true },
    });
    redirect(project ? `/p/${project.slug}/roster` : "/");
  }

  return (
    <Shell title={`Join ${invitation.organization.name}`}>
      <p className="text-[0.8125rem] text-ink-muted">
        You have been invited as <strong className="text-ink">{invitation.role}</strong>, at{" "}
        <strong className="text-ink">{invitation.email}</strong>. Sign in with that address, or
        create an account with it, to accept.
      </p>
      <div className="mt-4 flex gap-2">
        <Button asChild>
          <Link href={`/signup?invite=${encodeURIComponent(token)}`}>Create an account</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/login?invite=${encodeURIComponent(token)}`}>Sign in</Link>
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <BrandLockup />
      <h1 className="mt-6 text-xl font-semibold text-ink">{title}</h1>
      <Panel className="mt-4">
        <PanelBody>{children}</PanelBody>
      </Panel>
    </div>
  );
}
