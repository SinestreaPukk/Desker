import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge knows Tailwind's default sizes, not ours. Without this it
 * reads text-display / text-hero / text-title as colours, and a later
 * text-ink "wins" and silently deletes the size.
 */
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["display", "hero", "title"] }] } },
});

/** Tailwind-aware className joiner: later classes win over earlier conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: Date | string): string {
  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((Date.now() - then.getTime()) / 1000);
  // Upcoming times (a next scheduled run) read forwards, not as "just now".
  if (seconds <= -60) {
    const ahead = -seconds;
    if (ahead < 3600) return `in ${Math.round(ahead / 60)}m`;
    if (ahead < 86_400) return `in ${Math.round(ahead / 3600)}h`;
    if (ahead < 7 * 86_400) return `in ${Math.round(ahead / 86_400)}d`;
    return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/**
 * A URL that came from an agent or a web page is untrusted content. Only an
 * absolute http(s) URL becomes a link; anything else (javascript:, data:,
 * a relative path into our own app) is shown as text.
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
