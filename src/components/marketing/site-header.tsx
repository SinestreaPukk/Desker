"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The public header's surface. At the top of a page it is transparent with
 * light type, sitting on the sky; once the page scrolls it frosts over and
 * the type turns to ink.
 *
 * This assumes every page in the public shell opens on a band of sky - the
 * landing page's hero or a PageHeader. That is the invariant: a public page
 * without one would put white type on white paper, so give it a PageHeader.
 * Server-rendered as the clear variant, which is what the top of the page
 * always is, so there is no flash.
 */
export function SiteHeader({ children }: { children: React.ReactNode }) {
  const scrolled = React.useSyncExternalStore(
    (onChange) => {
      window.addEventListener("scroll", onChange, { passive: true });
      return () => window.removeEventListener("scroll", onChange);
    },
    () => window.scrollY > 24,
    () => false,
  );
  const clear = !scrolled;
  return (
    <header
      data-clear={clear || undefined}
      className={cn(
        "sticky top-0 z-40 transition-[background-color,border-color,color] duration-300",
        clear
          ? "border-b border-transparent bg-transparent text-[var(--sky-ink)]"
          : "border-b border-line/40 bg-paper/75 text-ink backdrop-blur-md",
      )}
    >
      {children}
    </header>
  );
}
