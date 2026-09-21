"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api-client";
import { isPublicPath } from "@/lib/public-routes";

export function Providers({ children }: { children: React.ReactNode }) {
  // The public site is always light. next-themes still reads and writes the
  // visitor's stored choice - it just does not apply it here - so the theme
  // they picked is waiting for them the moment they reach the product.
  const forcedTheme = isPublicPath(usePathname()) ? "light" : undefined;
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              // A 4xx will not get better by asking again.
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                return false;
              }
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      forcedTheme={forcedTheme}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast:
                  "!bg-surface !border-line !text-ink !rounded-md !shadow-md !font-sans",
                description: "!text-ink-muted",
                actionButton: "!bg-accent !text-accent-fg",
              },
            }}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
