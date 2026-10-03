import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/platform/db";
import { hasCoreContext } from "@/lib/work/context";
import { currentUser } from "@/lib/auth/auth";
import { defaultProject } from "@/lib/tenancy/projects";
import { entryPath } from "@/lib/tenancy/space-entry";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/components/marketing/cta";
import { SITE, pageMetadata, templateById } from "@/lib/site/content";

export const metadata: Metadata = pageMetadata({
  title: SITE.company.name,
  description: "Desker is being rebuilt for personal use. Back soon.",
  path: "/",
});

/**
 * A signed-in person goes to their space (or into the hire wizard when they
 * arrived with a role); everyone else sees the under-reconstruction page.
 */
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const user = await currentUser();
  if (user) {
    const { template } = await searchParams;
    const role = template ? templateById(template) : undefined;
    const project = await defaultProject(user.id);
    if (!role) redirect(await entryPath(project));
    // A brand-new space describes the person first, then hires.
    if (!hasCoreContext(project) && (await prisma.agent.count({ where: { projectId: project.id } })) === 0) {
      redirect(`/p/${project.slug}/welcome?template=${encodeURIComponent(role.id)}`);
    }
    redirect(`/p/${project.slug}/agents/new?template=${encodeURIComponent(role.id)}`);
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="font-hand text-hand-hero text-balance text-ink">We&apos;re under reconstruction</h1>
      <p className="mt-6 text-lg leading-relaxed text-pretty text-ink-muted">
        {SITE.company.name} is being rebuilt for personal use. Back soon.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/login" className={CTA_PRIMARY}>
          Sign in
        </Link>
        <Link href="/signup" className={CTA_SECONDARY}>
          Create an account
        </Link>
      </div>
    </section>
  );
}
