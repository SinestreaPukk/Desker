"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A page's large title, and the compact bar it condenses into once it has
 * scrolled away - the native pattern, so the owner never loses track of which
 * page they are on. The bar is a translucent material the content scrolls
 * under; it only exists on wide screens, where the phone's own top bar is not
 * already doing this job.
 */
export function LargeTitle({ title }: { title: string }) {
  const ref = React.useRef<HTMLHeadingElement>(null);
  const [condensed, setCondensed] = React.useState(false);

  React.useEffect(() => {
    const heading = ref.current;
    if (!heading) return;
    const observer = new IntersectionObserver(([entry]) => setCondensed(!entry!.isIntersecting), {
      rootMargin: "-8px 0px 0px 0px",
    });
    observer.observe(heading);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "material-bar fixed inset-x-0 top-0 z-20 hidden h-11 items-center justify-center border-b lg:left-60 lg:flex",
          "transition-[opacity,border-color] duration-200 ease-out",
          condensed ? "border-line/70 opacity-100" : "pointer-events-none border-transparent opacity-0",
        )}
      >
        <span className="text-sm font-semibold text-ink">{title}</span>
      </div>
      <h1 ref={ref} className="font-display text-large-title font-bold tracking-tight text-ink">
        {title}
      </h1>
    </>
  );
}
