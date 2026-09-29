"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        // A segmented control: a quiet track, the chosen segment a raised white pill.
        "inline-flex items-center gap-0.5 rounded-full bg-ink/[0.06] p-0.5",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-medium",
        "text-ink-muted transition-colors duration-150 hover:text-ink",
        "data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

/** A count inside a tab trigger: hidden at zero, so an empty tab reads as quiet. */
export function TabCount({ value, tone, label }: { value: number; tone: "accent" | "danger" | "warning"; label: string }) {
  if (value === 0) return null;
  return (
    <Badge tone={tone} className="ml-1.5 px-2 py-0 text-meta font-bold" aria-label={`${value} ${label}`}>
      {value}
    </Badge>
  );
}
