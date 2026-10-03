"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useDeleteIntegration, useIntegrations, useOAuthProviders } from "@/hooks/use-work-data";
import { CONNECTORS, type Connector } from "@/lib/integrations/catalog";
import { errorMessage } from "@/lib/shared/api-client";

/** The accounts it can work in, grouped by how useful they are first. */
const GROUPS: { title: string; note?: string; ids: string[] }[] = [
  { title: "Most useful", ids: ["gmail", "google_calendar"] },
  { title: "Work", ids: ["slack", "github", "google_tasks", "outlook_mail", "outlook_calendar", "microsoft_todo"] },
  { title: "Social", note: "Posts wait for your yes.", ids: ["linkedin", "meta", "x", "threads"] },
];

export function AppsList({ project, returnTo }: { project: string; returnTo: string }) {
  const connections = useIntegrations(project);
  const providers = useOAuthProviders();
  const remove = useDeleteIntegration(project);

  if (connections.isPending || providers.isPending) return <Skeleton className="h-64" aria-busy aria-label="Loading" />;
  if (connections.error) return <ErrorState message={errorMessage(connections.error)} onRetry={() => void connections.refetch()} />;

  const byType = new Map(connections.data.map((row) => [row.type, row]));
  // Only apps this server can actually connect.
  const available = new Map(
    CONNECTORS.filter(
      (connector) => connector.status === "available" && connector.auth === "oauth" && connector.oauthProvider && providers.data?.[connector.oauthProvider],
    ).map((connector) => [connector.id, connector]),
  );

  return (
    <div className="space-y-8">
      {GROUPS.map((group) => {
        const apps = group.ids.map((id) => available.get(id)).filter((app): app is Connector => Boolean(app));
        if (apps.length === 0) return null;
        return (
          <section key={group.title} aria-label={group.title}>
            <h3 className="mb-2 text-sm font-semibold text-ink">
              {group.title}
              {group.note ? <span className="ml-2 font-normal text-ink-muted">{group.note}</span> : null}
            </h3>
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {apps.map((app) => {
                const connection = byType.get(app.id);
                const on = connection && connection.state !== "disconnected";
                const needsAgain = connection?.state === "attention";
                return (
                  <li key={app.id} id={app.id} className="flex items-center gap-4 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{app.name}</p>
                      <p className="truncate text-sm text-ink-muted">{needsAgain ? "Needs to be connected again." : on ? "Connected" : app.can[0]}</p>
                    </div>
                    {on && !needsAgain ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={remove.isPending && remove.variables === connection.id}
                        onClick={() =>
                          remove.mutate(connection.id, {
                            onSuccess: () => toast.success(`${app.name} disconnected`),
                            onError: (caught) => toast.error(errorMessage(caught)),
                          })
                        }
                      >
                        Disconnect
                      </Button>
                    ) : (
                      // Solid blue only for the two apps most worth connecting first.
                      <Button asChild size="sm" variant={group.title === "Most useful" && !connection ? "primary" : "secondary"}>
                        <a href={`/api/integrations/oauth/${app.id}/start?project=${encodeURIComponent(project)}&returnTo=${encodeURIComponent(returnTo)}`}>
                          {connection ? "Reconnect" : "Connect"}
                        </a>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
