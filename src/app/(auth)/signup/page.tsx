import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage() {
  if (await currentUser()) redirect("/");
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
