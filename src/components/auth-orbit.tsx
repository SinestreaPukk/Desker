import { AgentAvatar } from "@/components/ui/avatar";

/**
 * The sign-in pages' backdrop: the whole cast, in round frames, circling the
 * form on two slow orbits - the business staff on the outer ring, the
 * personal assistants on the inner one, turning the other way. The faces are
 * counter-rotated so they stay upright. Pure CSS (globals.css, .orbit);
 * still for anyone who prefers reduced motion, and hidden from assistive tech.
 */
const OUTER = [
  ["Sol", "sol"],
  ["Nova", "nova"],
  ["Mia", "mia"],
  ["Leo", "leo-leads"],
  ["Kai", "kai"],
  ["Ivy", "ivy"],
  ["Ada", "ada"],
  ["Rae", "rae"],
] as const;

const INNER = [
  ["Penny", "penny"],
  ["Juno", "juno"],
  ["Remy", "remy"],
  ["Theo", "theo"],
  ["Isla", "isla"],
  ["Ollie", "ollie"],
] as const;

function Ring({
  faces,
  diameter,
  duration,
  reverse = false,
  size,
  offset = 0,
}: {
  faces: readonly (readonly [string, string])[];
  diameter: string;
  duration: string;
  reverse?: boolean;
  size: "md" | "lg" | "xl";
  offset?: number;
}) {
  return (
    <div
      className="orbit absolute left-1/2 top-1/2 rounded-full border border-dashed border-accent-line/70"
      style={
        {
          width: diameter,
          height: diameter,
          marginLeft: `calc(${diameter} / -2)`,
          marginTop: `calc(${diameter} / -2)`,
          "--orbit-duration": duration,
          animationDirection: reverse ? "reverse" : undefined,
        } as React.CSSProperties
      }
    >
      {faces.map(([name, seed], index) => {
        const angle = offset + (360 / faces.length) * index;
        return (
          <span
            key={seed}
            className="absolute left-1/2 top-1/2"
            style={{ transform: `rotate(${angle}deg) translateX(calc(${diameter} / 2)) rotate(${-angle}deg)` }}
          >
            <span
              className="orbit-face block -translate-x-1/2 -translate-y-1/2"
              style={{ "--orbit-duration": duration, animationDirection: reverse ? "normal" : undefined } as React.CSSProperties}
            >
              <AgentAvatar
                name={name}
                seed={seed}
                size={size}
                className="bg-surface shadow-md ring-4 ring-surface outline-1 outline-offset-4 outline-accent-line/60"
              />
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function AuthOrbit() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* A soft pool of light where the form sits, so it reads first. */}
      <div className="absolute left-1/2 top-1/2 size-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-soft),transparent)] opacity-70" />
      <Ring faces={OUTER} diameter="clamp(34rem, 92vw, 60rem)" duration="180s" size="xl" offset={10} />
      <Ring faces={INNER} diameter="clamp(26rem, 64vw, 40rem)" duration="140s" size="lg" reverse offset={30} />
    </div>
  );
}
