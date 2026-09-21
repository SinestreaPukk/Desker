"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The public header's links, with the section you are reading underlined.
 *
 * Only the links that point at a section of this page can be followed that
 * way - "Roles" goes to the showcase and "Contact" to its own page, so
 * neither ever lights up while you scroll, which is the honest behaviour: a
 * highlighted link that navigates somewhere else is a small lie.
 *
 * The reading position is whichever section's top has most recently passed
 * under the header, rather than an IntersectionObserver ratio, because
 * sections here differ in height by a factor of five and a ratio would skip
 * the short ones entirely.
 */
const HEADER_H = 56;

export function SiteNav({ items }: { items: readonly { label: string; href: string }[] }) {
  const pathname = usePathname();
  const ids = React.useMemo(
    () => items.map((item) => /^\/#(.+)$/.exec(item.href)?.[1]).filter((id): id is string => Boolean(id)),
    [items],
  );
  const [active, setActive] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (pathname !== "/" || ids.length === 0) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      let current: string | null = null;
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= HEADER_H + 1) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname, ids]);

  return (
    <nav aria-label="Site" className="hidden items-center gap-6 md:flex">
      {items.map((item) => {
        const id = /^\/#(.+)$/.exec(item.href)?.[1];
        const here = pathname === "/" ? Boolean(id) && id === active : item.href === pathname;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={here ? "location" : undefined}
            className={cn(
              "focus-current relative text-sm transition-colors",
              "after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:origin-left",
              "after:bg-current after:transition-transform after:duration-200",
              here ? "text-current after:scale-x-100" : "text-current/75 after:scale-x-0 hover:text-current",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
