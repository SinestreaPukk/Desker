import type { Metadata } from "next";
import { Page, PageBody, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Productivity" };

export default function ProductivityPage() {
  return (
    <Page>
      <PageHeader title="Productivity" />
      <PageBody>{null}</PageBody>
    </Page>
  );
}
