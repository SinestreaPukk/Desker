"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The public header's links, with the section you are reading underlined.
 *
 * Only links that point at a section of this page can light up that way; a
 * link to another page never does - a highlighted link that navigates
 * somewhere else is a small lie.
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

/**
 * The same links below md, where the row above is hidden: a disclosure
 * button and a sheet under the header. Closes on a link, on Escape (focus
 * back to the button) and when the viewport grows past md.
 */
export function SiteMenu({
  items,
  signIn,
}: {
  items: readonly { label: string; href: string }[];
  signIn: { label: string; href: string };
}) {
  const [open, setOpen] = React.useState(false);
  const button = React.useRef<HTMLButtonElement>(null);
  const id = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const wide = window.matchMedia("(min-width: 768px)");
    const onWide = () => wide.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="focus-current inline-flex size-11 items-center justify-center rounded-md text-current"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>
      <nav
        id={id}
        aria-label="Site"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-line bg-paper px-4 pb-4 pt-2 text-ink shadow-md"
      >
        <ul className="divide-y divide-line">
          {[...items, signIn].map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex min-h-[48px] items-center text-base font-medium text-ink hover:text-accent"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
