"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The public header's surface. At the top of a page it is transparent with
 * light type, sitting on the sky; once the page scrolls it frosts over and
 * the type turns to ink.
 *
 * A section marked data-header-clear keeps it clear for as long as that
 * section's dark sky is under it - the landing hero, whose pinned demo keeps
 * the night on screen for a long stretch of scroll, where a frosted paper
 * bar would sit on the stars. It frosts anyway the moment something light
 * is under it: an element marked data-header-solid (the demo window, as it
 * leaves), or the pale fade at the foot of the section. White type on
 * either would vanish.
 */
const HEADER_H = 56;
/** The foot of the hero dissolves into paper over roughly this much. */
const FADE_H = 160;

function scrolledPast(): boolean {
  const clearUnder = document.querySelector("[data-header-clear]");
  if (!clearUnder) return window.scrollY > 24;
  if (clearUnder.getBoundingClientRect().bottom <= HEADER_H + FADE_H) return true;
  for (const solid of document.querySelectorAll("[data-header-solid]")) {
    const box = solid.getBoundingClientRect();
    if (box.top < HEADER_H && box.bottom > 0) return true;
  }
  return false;
}

export function SiteHeader({ children }: { children: React.ReactNode }) {
  // Re-read on navigation: the marked section belongs to one page only.
  usePathname();
  const scrolled = React.useSyncExternalStore(
    (onChange) => {
      window.addEventListener("scroll", onChange, { passive: true });
      window.addEventListener("resize", onChange, { passive: true });
      return () => {
        window.removeEventListener("scroll", onChange);
        window.removeEventListener("resize", onChange);
      };
    },
    scrolledPast,
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
