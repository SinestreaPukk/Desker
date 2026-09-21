import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SignupForm } from "./signup-form";
import { findOpenInvitation } from "@/lib/invites";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite: token } = await searchParams;
  // A signed-in user with an invitation goes straight to accepting it.
  if (await currentUser()) redirect(token ? `/invite/${token}` : "/");
  const invitation = token ? await findOpenInvitation(token) : null;
  return (
    <Suspense>
      <SignupForm
        invite={
          invitation && token
            ? { token, email: invitation.email, organization: invitation.organization.name }
            : null
        }
      />
    </Suspense>
  );
}
