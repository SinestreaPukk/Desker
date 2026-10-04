import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/auth";
import { prisma } from "@/lib/platform/db";
import { findProject } from "@/lib/tenancy/projects";
import { AccountScreen } from "@/components/account/account-screen";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ project: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { project: handle } = await params;
  const project = await findProject(handle, user.id);
  if (!project) notFound();
  const [row, nick] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { firstName: true, lastName: true, username: true, email: true } }),
    prisma.lifePreference.findUnique({ where: { projectId_key: { projectId: project.id, key: "nickname" } }, select: { value: true } }),
  ]);
  const nickname = nick?.value.match(/^Call them "(.*)"$/)?.[1] ?? "";
  return (
    <AccountScreen
      project={project.slug}
      initial={{ firstName: row.firstName ?? "", lastName: row.lastName ?? "", username: row.username ?? "", nickname, email: row.email }}
    />
  );
}
