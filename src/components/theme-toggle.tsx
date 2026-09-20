"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { useMounted } from "@/hooks/use-mounted";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

/**
 * Three-way theme control. A segmented radio group rather than a toggle, so
 * "follow my system" stays reachable instead of being an invisible default.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The active theme is unknown until hydration; until then no option is shown
  // as selected, which keeps server and client markup identical.
  const mounted = useMounted();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            onClick={() => setTheme(option.value)}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              active
                ? "bg-surface text-ink shadow-xs"
                : "text-ink-subtle hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
