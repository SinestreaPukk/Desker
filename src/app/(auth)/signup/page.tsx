import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage() {
  // A stale session (JWT with no user row) must not bounce someone away from
  // the one page that can replace it.
  if (await currentUser()) redirect("/roster");
  return <SignupForm />;
}
