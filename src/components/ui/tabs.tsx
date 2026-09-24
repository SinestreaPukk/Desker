"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2/80 p-1 shadow-2xs",
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
        "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium",
        "text-ink-muted transition-all duration-150 hover:text-ink hover:bg-surface/40",
        "data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-xs data-[state=active]:font-semibold",
        className,
      )}
      {...props}
    />
  );
}
