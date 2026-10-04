import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/auth";
import { TimeZoneBootstrap } from "@/components/time-zone-bootstrap";

/**
 * The auth boundary for every admin surface. Route handlers repeat the check
 * via requireAdmin() - this one stops an unauthenticated person from seeing the
 * chrome at all.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <><TimeZoneBootstrap />{children}</>;
}
