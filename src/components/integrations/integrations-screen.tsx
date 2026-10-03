"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Screen } from "@/components/screen";
import { AppsList } from "@/components/integrations/apps-list";
import { ChatApps } from "@/components/integrations/chat-apps";
import { connectorById } from "@/lib/integrations/catalog";

/** Where to talk to it, and which accounts it can use. */
export function IntegrationsScreen({ project }: { project: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const returnTo = `/p/${project}/integrations`;

  // Coming back from an app: say how it went once, then tidy the address.
  React.useEffect(() => {
    const connected = search.get("connected");
    const failed = search.get("connectError");
    if (!connected && !failed) return;
    if (connected) toast.success(`${connectorById(connected)?.name ?? "App"} connected`);
    if (failed) toast.error(failed);
    router.replace(returnTo, { scroll: false });
  }, [search, router, returnTo]);

  return (
    <Screen title="Integrations" hint="Connect the apps you use.">
      <div className="space-y-10">
        <section aria-labelledby="chat-apps">
          <h2 id="chat-apps" className="mb-1 text-lg font-semibold text-ink">
            Chat
          </h2>
          <p className="mb-3 text-sm text-ink-muted">Talk to it from your phone. It also sends you anything that needs a yes.</p>
          <ChatApps />
        </section>
        <section aria-labelledby="apps">
          <h2 id="apps" className="mb-1 text-lg font-semibold text-ink">
            Apps
          </h2>
          <p className="mb-3 text-sm text-ink-muted">Let it work in your accounts.</p>
          <AppsList project={project} returnTo={returnTo} />
        </section>
      </div>
    </Screen>
  );
}
