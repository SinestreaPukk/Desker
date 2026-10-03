import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  // A stale session (JWT with no user row) must not bounce someone away from
  // the one page that can replace it.
  if (await currentUser()) redirect("/");
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
