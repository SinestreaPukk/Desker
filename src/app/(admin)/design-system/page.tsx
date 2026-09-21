import type { Metadata } from "next";
import { DesignSystem } from "./design-system";

export const metadata: Metadata = { title: "Design system", robots: { index: false } };

/** Internal. Behind the admin auth boundary, not tied to a project. */
export default function DesignSystemPage() {
  return <DesignSystem />;
}
