"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/** Records a page view per navigation. Fire-and-forget; never blocks the UI. */
export function UsageTracker({ project }: { project: string }) {
  const pathname = usePathname();
  React.useEffect(() => {
    const body = JSON.stringify({
      name: "page.viewed",
      path: pathname,
      project,
      metadata: { section: pathname.split("/")[3] ?? "" },
    });
    try {
      if (!navigator.sendBeacon?.("/api/events/track", new Blob([body], { type: "application/json" }))) {
        void fetch("/api/events/track", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
      }
    } catch {
      /* analytics must never break a page */
    }
  }, [pathname, project]);
  return null;
}
