import type { Metadata } from "next";
import { MoneyView } from "./money-view";

export const metadata: Metadata = { title: "Money" };

export default async function MoneyPage({ params }: { params: Promise<{ project: string }> }) {
  return <MoneyView project={(await params).project} />;
}
