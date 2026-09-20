"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import {
  AgentFigure,
  defaultAvatar,
  parseBuiltIn,
} from "@/components/agent-figure";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-7",
  md: "size-9",
  lg: "size-12",
  xl: "size-16",
} as const;

/**
 * An agent's face.
 *
 * `src` carries one of three things:
 *   - a `beam:<variant>:<tone>` key for a built-in face, drawn as inline SVG
 *     so it follows the theme;
 *   - a data: or http(s) URL for an image the admin uploaded;
 *   - nothing, in which case a face is derived from `seed` so every agent
 *     still has a stable, distinct one without anyone choosing it.
 *
 * Round, as is the convention for people across products - it also keeps the
 * avatar visually distinct from the square document and status tiles.
 */
export function AgentAvatar({
  name,
  src,
  seed,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  /** Stable identity for the auto-assigned face. Prefer the agent's id. */
  seed?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const shell = cn(
    "relative flex shrink-0 overflow-hidden rounded-full",
    SIZES[size],
    className,
  );

  const isImage = Boolean(src && /^(data:|https?:)/.test(src));
  const resolved = parseBuiltIn(src) ?? defaultAvatar(seed || name || "agent");

  if (!isImage) {
    return (
      <span className={shell}>
        <AgentFigure seed={resolved.seed} tone={resolved.tone} />
      </span>
    );
  }

  // An uploaded image, with the agent's own face behind it so a slow or broken
  // image never collapses to an empty grey circle.
  return (
    <AvatarPrimitive.Root className={cn(shell, "border border-line")}>
      <AvatarPrimitive.Image
        src={src!}
        alt=""
        className="aspect-square size-full object-cover"
      />
      <AvatarPrimitive.Fallback delayMs={300} className="size-full">
        <AgentFigure seed={resolved.seed} tone={resolved.tone} />
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
