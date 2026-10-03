"use client";

import * as React from "react";
import { cn } from "@/lib/shared/utils";

/**
 * The public header's surface. At the top of a page it is clear, sitting on
 * the dotted paper; once the page scrolls it frosts over so what passes
 * under it never fights the links. Navy ink throughout: every public page is
 * light.
 */
function scrolledPast(): boolean {
  return window.scrollY > 24;
}

export function SiteHeader({ children }: { children: React.ReactNode }) {
  const scrolled = React.useSyncExternalStore(
    (onChange) => {
      window.addEventListener("scroll", onChange, { passive: true });
      return () => window.removeEventListener("scroll", onChange);
    },
    scrolledPast,
    () => false,
  );
  return (
    <header
      className={cn(
        "sticky top-0 z-40 text-ink transition-[background-color,border-color] duration-300",
        scrolled ? "border-b border-line/60 bg-paper/80 backdrop-blur-md" : "border-b border-transparent bg-transparent",
      )}
    >
      {children}
    </header>
  );
}
