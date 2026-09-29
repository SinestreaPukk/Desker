import { cn } from "@/lib/utils";

/**
 * A sticky note, for the app: a pale note colour under navy ink, square-ish
 * corners and a low shadow, barely tilted. The same material as the public
 * site's notes (globals.css, .note), kept calm for everyday screens: no tape,
 * a softer tint, and no tilt unless asked for.
 */
export type NoteTone = "lemon" | "sky" | "mint" | "coral" | "lilac";

export function Note({
  tone,
  tilt = 0,
  className,
  children,
  ...props
}: { tone: NoteTone; tilt?: number } & React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn("note note-plain relative", className)}
      style={
        {
          "--tilt": `${tilt}deg`,
          background: `color-mix(in oklch, var(--note-${tone}) 55%, var(--surface))`,
          ...props.style,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
