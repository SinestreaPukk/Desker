import type { Metadata } from "next";
import { WelcomeView } from "./welcome-view";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const [{ project }, { template }] = await Promise.all([params, searchParams]);
  return <WelcomeView project={project} template={template ?? null} />;
}
