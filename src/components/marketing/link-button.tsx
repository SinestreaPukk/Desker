"use client";

import Link from "next/link";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * A Button that is a link, for server components.
 *
 * <Button asChild><Link/></Button> written in a server component hands the
 * Link across to the client Button as a lazy reference, and Radix's Slot
 * only slots onto a plain element - so it throws ("Slot failed to slot onto
 * its children") whenever that reference has not resolved at render time,
 * which depends on how the page's client chunks happen to load. Building the
 * Link here, on the client side of the boundary, always hands Slot a plain
 * element.
 */
export function LinkButton({
  href,
  children,
  ...props
}: Omit<ButtonProps, "asChild"> & { href: string }) {
  return (
    <Button asChild {...props}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
