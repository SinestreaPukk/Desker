"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The public header's surface. Over the landing's sky it is transparent with
 * light text; once the page scrolls, or on any other page, it frosts over.
 * Server-rendered as the sky variant on "/", so there is no flash.
 */
export function SiteHeader({ children }: { children: React.ReactNode }) {
  const onSky = usePathname() === "/";
  const scrolled = React.useSyncExternalStore(
    (onChange) => {
      window.addEventListener("scroll", onChange, { passive: true });
      return () => window.removeEventListener("scroll", onChange);
    },
    () => window.scrollY > 24,
    () => false,
  );
  const clear = onSky && !scrolled;
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
