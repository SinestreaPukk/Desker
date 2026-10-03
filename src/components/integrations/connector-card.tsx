"use client";

import * as React from "react";
import { Check, CheckCircle2, ChevronRight, Clock, ExternalLink, Minus, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TEMPLATES } from "@/lib/site/content";
import type { Connector, OAuthProvider } from "@/lib/integrations/catalog";
import type { IntegrationDto } from "@/lib/work/serialize";
import { cn } from "@/lib/shared/utils";

/**
 * One connector, as an owner decides about it: what it is for, exactly what
 * it can and cannot do, and the one action that fits its state. Shared by the
 * Integrations library and the hire wizard, so both make the same promise.
 * The can/can't list sits one click away so a page of cards stays scannable.
 */
export function ConnectorCard({
  connector,
  connection,
  providers,
  project,
  returnTo,
  showRoles = false,
  newTab = false,
  onSetUp,
  setUpOpen = false,
  permissionsOpen = false,
}: {
  connector: Connector;
  /** The organisation's connection of this kind, when there is one. */
  connection?: IntegrationDto;
  providers?: Partial<Record<OAuthProvider, boolean>>;
  project: string;
  /** Where OAuth returns to afterwards. */
  returnTo: string;
  showRoles?: boolean;
  /** Open Connect in a new tab, so a half-finished form (the hire wizard) survives it. */
  newTab?: boolean;
  /** For key- and webhook-based connectors: reveals their form in place. */
  onSetUp?: () => void;
  setUpOpen?: boolean;
  /** Show what it can and can't do without a click - the hire wizard, where that is the decision. */
  permissionsOpen?: boolean;
}) {
  const roles = showRoles
    ? connector.roles
        .map((id) => TEMPLATES.find((template) => template.id === id)?.jobTitle)
        .filter((title): title is string => Boolean(title))
    : [];

  const permissions = (
    <>
      <dl className="grid gap-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="eyebrow mb-1">It can</dt>
          {connector.can.map((line) => (
            <dd key={line} className="flex items-start gap-1.5 text-ink">
              <Check className="mt-0.5 size-3 shrink-0 text-positive" aria-hidden />
              {line}
            </dd>
          ))}
        </div>
        <div>
          <dt className="eyebrow mb-1">It can&apos;t</dt>
          {connector.cannot.map((line) => (
            <dd key={line} className="flex items-start gap-1.5 text-ink-muted">
              <Minus className="mt-0.5 size-3 shrink-0" aria-hidden />
              {line}
            </dd>
          ))}
        </div>
      </dl>
      {roles.length > 0 ? <p className="mt-3 text-xs text-ink-subtle">Useful for: {roles.join(", ")}</p> : null}
    </>
  );

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-lg border p-4 transition-colors",
        connection?.state === "connected"
          ? "border-positive-line/60 bg-positive-soft/20"
          : connector.status === "planned"
            ? "border-dashed border-line bg-surface-2/50"
            : "border-line bg-surface",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("font-semibold", connector.status === "planned" ? "text-ink-muted" : "text-ink")}>{connector.name}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{connector.pitch}</p>
        </div>
        <ConnectorAction
          connector={connector}
          connection={connection}
          providers={providers}
          project={project}
          returnTo={returnTo}
          newTab={newTab}
          onSetUp={onSetUp}
          setUpOpen={setUpOpen}
        />
      </div>

      {connection ? (
        <p className="mt-3 text-xs text-ink-muted">
          {connection.summary ? `${connection.summary} · ` : ""}
          {connection.consequence}
        </p>
      ) : null}

      {permissionsOpen ? (
        <div className="mt-3">{permissions}</div>
      ) : (
        <details className="group mt-3">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-3 transition-transform group-open:rotate-90" aria-hidden />
            What it can and can&apos;t do
          </summary>
          <div className="mt-2">{permissions}</div>
        </details>
      )}
    </div>
  );
}

function ConnectorAction({
  connector,
  connection,
  providers,
  project,
  returnTo,
  newTab,
  onSetUp,
  setUpOpen,
}: {
  connector: Connector;
  connection?: IntegrationDto;
  providers?: Partial<Record<OAuthProvider, boolean>>;
  project: string;
  returnTo: string;
  newTab: boolean;
  onSetUp?: () => void;
  setUpOpen: boolean;
}) {
  if (connector.status === "planned") {
    return (
      <Badge tone="neutral" className="shrink-0">
        <Clock aria-hidden />
        Coming soon
      </Badge>
    );
  }
  if (connection && connector.auth !== "webhook") {
    return connection.state === "connected" ? (
      <Badge tone="positive" className="shrink-0">
        <CheckCircle2 aria-hidden />
        Connected
      </Badge>
    ) : (
      <Badge tone="warning" className="shrink-0">
        <TriangleAlert aria-hidden />
        Needs attention
      </Badge>
    );
  }
  if (connector.auth === "oauth" && connector.oauthProvider) {
    // Unknown until the server says: never offer a Connect that may just fail.
    if (!providers) {
      return (
        <Button size="sm" className="shrink-0" disabled>
          Connect
        </Button>
      );
    }
    if (!providers[connector.oauthProvider]) {
      return (
        <Badge tone="neutral" className="shrink-0" title="Whoever deploys Desker needs to add this provider's app credentials.">
          Not set up on this server
        </Badge>
      );
    }
    const href =
      `/api/integrations/oauth/${connector.id}/start?project=${encodeURIComponent(project)}` +
      `&returnTo=${encodeURIComponent(returnTo)}`;
    return (
      <Button asChild size="sm" className="shrink-0">
        <a href={href} {...(newTab ? { target: "_blank", rel: "noopener" } : {})}>
          Connect
          {newTab ? <ExternalLink aria-hidden /> : null}
        </a>
      </Button>
    );
  }
  // Key- and webhook-based: set up in place on the Integrations page, or open it from elsewhere.
  if (onSetUp) {
    return (
      <Button size="sm" variant={setUpOpen ? "ghost" : "secondary"} className="shrink-0" onClick={onSetUp}>
        {setUpOpen ? "Close" : connection ? "Add another" : "Set up"}
      </Button>
    );
  }
  return connection ? (
    <Badge tone="positive" className="shrink-0">
      <CheckCircle2 aria-hidden />
      Connected
    </Badge>
  ) : (
    <Button asChild size="sm" variant="secondary" className="shrink-0">
      <a href={`/p/${project}/integrations#${connector.id}`} target="_blank" rel="noopener">
        Set up
        <ExternalLink aria-hidden />
      </a>
    </Button>
  );
}
