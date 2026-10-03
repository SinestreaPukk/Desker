import type { Metadata } from "next";
import { Screen } from "@/components/screen";

export const metadata: Metadata = { title: "Productivity" };

export default function ProductivityPage() {
  return <Screen title="Productivity" />;
}
