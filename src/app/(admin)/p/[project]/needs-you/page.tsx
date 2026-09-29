import type { Metadata } from "next";
import { NeedsYouView } from "./needs-you-view";

export const metadata: Metadata = { title: "Needs you" };

export default async function NeedsYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ item?: string }>;
}) {
  const { project } = await params;
  const { item } = await searchParams;
  return <NeedsYouView project={project} focus={item ?? null} />;
}
