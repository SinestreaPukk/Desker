"use client";

import { useEffect } from "react";
import { api } from "@/lib/shared/api-client";

/** Saves the owner's browser zone once, before local-time features run. */
export function TimeZoneBootstrap() {
  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone) return;
    void api("/api/account/time-zone", { method: "PATCH", body: JSON.stringify({ timeZone }) })
      .catch((error: unknown) => console.warn("[time-zone] could not save the local time zone", error));
  }, []);

  return null;
}
