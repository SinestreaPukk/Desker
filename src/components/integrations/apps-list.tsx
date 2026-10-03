"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useDeleteIntegration, useIntegrations, useOAuthProviders } from "@/hooks/use-work-data";
import { CONNECTORS } from "@/lib/integrations/catalog";
import { errorMessage } from "@/lib/shared/api-client";

/** The accounts it can work in. One row each; connecting asks the app for the least access it needs. */
export function AppsList({ project, returnTo }: { project: string; returnTo: string }) {
  const connections = useIntegrations(project);
  const providers = useOAuthProviders();
  const remove = useDeleteIntegration(project);

  if (connections.isPending || providers.isPending) return <Skeleton className="h-64" />;
  if (connections.error) return <ErrorState message={errorMessage(connections.error)} onRetry={() => void connections.refetch()} />;

  const byType = new Map(connections.data.map((row) => [row.type, row]));
  // Only apps this server can actually connect.
  const apps = CONNECTORS.filter(
    (connector) => connector.status === "available" && connector.auth === "oauth" && connector.oauthProvider && providers.data?.[connector.oauthProvider],
  );

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {apps.map((app) => {
        const connection = byType.get(app.id);
        const on = connection && connection.state !== "disconnected";
        return (
          <li key={app.id} id={app.id} className="flex items-center gap-4 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{app.name}</p>
              <p className="truncate text-sm text-ink-muted">
                {connection?.state === "attention" ? "Needs to be connected again." : on ? "Connected" : app.can[0]}
              </p>
            </div>
            {on && connection?.state !== "attention" ? (
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
              <Button asChild size="sm">
                <a href={`/api/integrations/oauth/${app.id}/start?project=${encodeURIComponent(project)}&returnTo=${encodeURIComponent(returnTo)}`}>
                  {connection ? "Reconnect" : "Connect"}
                </a>
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
