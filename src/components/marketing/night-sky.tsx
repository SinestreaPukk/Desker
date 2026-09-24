import { cn } from "@/lib/utils";

/**
 * The public site's night: a starfield with a band of the Milky Way, and
 * moonlit dunes with wind ripples. Inline SVG drawn on the server - no
 * images, no client code - coloured from the --night-* and --dune-* tokens.
 * Decorative throughout.
 */

/** A small seeded generator, so the stars land in the same places on every render. */
function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = { x: number; y: number; r: number; o: number; twinkle: 0 | 1 | 2 | 3 };

const W = 1440;
const H = 900;
/** The Milky Way runs from lower left to upper right through this line. */
const BAND = { x1: 180, y1: 720, x2: 1300, y2: -60 };

const STARS: Star[] = (() => {
  const rand = seeded(7);
  const stars: Star[] = [];
  const pick = (x: number, y: number, dense: boolean) => {
    const big = rand() < (dense ? 0.03 : 0.06);
    stars.push({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      r: big ? 1.3 + rand() * 0.9 : 0.35 + rand() * 0.75,
      o: big ? 0.9 : 0.25 + rand() * 0.6,
      // One in four twinkles, in one of three rhythms.
      twinkle: rand() < 0.25 ? ((1 + Math.floor(rand() * 3)) as 1 | 2 | 3) : 0,
    });
  };
  // A scattering over the whole sky...
  for (let i = 0; i < 230; i++) pick(rand() * W, rand() * H * 0.8, false);
  // ...and a crowd along the band, thinning out from its spine.
  const dx = BAND.x2 - BAND.x1;
  const dy = BAND.y2 - BAND.y1;
  const len = Math.hypot(dx, dy);
  for (let i = 0; i < 260; i++) {
    const t = rand();
    const spread = (rand() + rand() + rand() - 1.5) * 120;
    const x = BAND.x1 + dx * t + (-dy / len) * spread;
    const y = BAND.y1 + dy * t + (dx / len) * spread;
    if (x > 0 && x < W && y > 0 && y < H * 0.8) pick(x, y, true);
  }
  return stars;
})();

export function NightSky({ className, uid = "sky" }: { className?: string; /** Unique per page - gradient ids. */ uid?: string }) {
  const angle = (Math.atan2(BAND.y2 - BAND.y1, BAND.x2 - BAND.x1) * 180) / Math.PI;
  const cx = (BAND.x1 + BAND.x2) / 2;
  const cy = (BAND.y1 + BAND.y2) / 2;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMin slice"
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    >
      <defs>
        <radialGradient id={`${uid}-milky-way`}>
          <stop offset="0%" stopColor="var(--night-milky)" stopOpacity="0.55" />
          <stop offset="45%" stopColor="var(--night-milky)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--night-milky)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-milky-core`}>
          <stop offset="0%" stopColor="var(--night-star)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--night-star)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-airglow`}>
          <stop offset="0%" stopColor="var(--night-airglow)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--night-airglow)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Faint violet airglow low on either side, as in a long exposure */}
      <ellipse cx="120" cy="420" rx="420" ry="120" fill={`url(#${uid}-airglow)`} transform="rotate(-18 120 420)" />
      <ellipse cx="1330" cy="330" rx="380" ry="110" fill={`url(#${uid}-airglow)`} transform="rotate(14 1330 330)" />

      {/* The Milky Way: a soft band and a brighter core */}
      <g transform={`rotate(${angle} ${cx} ${cy})`}>
        <ellipse cx={cx} cy={cy} rx={len(BAND) * 0.62} ry="150" fill={`url(#${uid}-milky-way)`} />
        <ellipse cx={cx + 60} cy={cy} rx={len(BAND) * 0.3} ry="60" fill={`url(#${uid}-milky-core)`} />
      </g>

      {([0, 1, 2, 3] as const).map((group) => (
        <g key={group} className={group ? `star-twinkle-${group}` : undefined} fill="var(--night-star)">
          {STARS.filter((star) => star.twinkle === group).map((star, index) => (
            <circle key={index} cx={star.x} cy={star.y} r={star.r} opacity={star.o} />
          ))}
        </g>
      ))}
    </svg>
  );
}

function len(band: typeof BAND) {
  return Math.hypot(band.x2 - band.x1, band.y2 - band.y1);
}

/**
 * Moonlit dunes, lit from the upper left: a far ridge, the main dune with a
 * sharp crest between its lit face and its shadowed face, and a foreground
 * swale. Wind ripples fade in toward the foot, as they do in a photograph,
 * and the whole dissolves into the paper so the next section begins on the
 * page's own ground.
 */
export function Dunes({
  className,
  uid = "dunes",
  haze = true,
}: {
  className?: string;
  /** Unique per page - gradient ids. */
  uid?: string;
  /**
   * Fade the last rows into paper. True where the dunes hand over to the page
   * (the hero); false where the sand is the end of the page (the closing CTA),
   * which would otherwise wash out to white just above the footer.
   */
  haze?: boolean;
}) {
  const id = (name: string) => `${uid}-${name}`;
  const url = (name: string) => `url(#${uid}-${name})`;
  // The product window covers the middle of the scene, so the shapes are
  // composed for the margins: a far ridge on the left, and the main dune's
  // crest high on the right, clear of the window at every width.
  const far = "M0 520 L0 190 Q160 140 330 160 Q500 182 660 250 L660 520 Z";
  // The main dune: a long lit slope rising from the left to the crest at 1180,70.
  const litFace = "M0 270 Q400 225 760 172 Q1000 122 1140 80 Q1165 72 1180 70 Q1250 150 1300 300 Q1330 420 1350 520 L0 520 Z";
  // Its lee side: from the crest down and away to the right, in shadow.
  const leeFace = "M1180 70 Q1260 78 1440 130 L1440 520 L1350 520 Q1330 420 1300 300 Q1250 150 1180 70 Z";
  const near = "M0 350 Q380 300 720 370 Q1060 440 1440 405 L1440 520 L0 520 Z";
  return (
    <svg
      viewBox="0 0 1440 520"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      className={cn("pointer-events-none block h-full w-full", className)}
    >
      <defs>
        <linearGradient id={id("far")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--dune-mid)" />
          <stop offset="100%" stopColor="var(--dune-deep)" />
        </linearGradient>
        {/* The lit face: bright along the crest, cooling down the slope */}
        <linearGradient id={id("lit")} x1="0.85" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor="var(--dune-crest)" />
          <stop offset="35%" stopColor="var(--dune-lit)" />
          <stop offset="100%" stopColor="var(--dune-mid)" />
        </linearGradient>
        <linearGradient id={id("lee")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--dune-shadow)" />
          <stop offset="100%" stopColor="var(--dune-deep)" />
        </linearGradient>
        <linearGradient id={id("near")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--dune-mid)" />
          <stop offset="100%" stopColor="var(--dune-shadow)" />
        </linearGradient>
        {/* Wind ripples: a faint light edge over a darker trough */}
        <pattern id={id("ripples")} width="150" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-5)">
          <path d="M0 4 Q37 1 75 4 T150 4" fill="none" stroke="var(--dune-ripple-light)" strokeWidth="0.8" opacity="0.14" />
          <path d="M0 6 Q37 3 75 6 T150 6" fill="none" stroke="var(--dune-ripple-dark)" strokeWidth="1.2" opacity="0.2" />
        </pattern>
        {/* Ripples show low on the dunes and fade out toward the crests */}
        <linearGradient id={id("ripple-fade")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="25%" stopColor="#000" />
          <stop offset="70%" stopColor="#fff" />
        </linearGradient>
        <mask id={id("ripple-mask")}>
          <rect width="1440" height="520" fill={url("ripple-fade")} />
        </mask>
        <linearGradient id={id("haze")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--paper)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--paper)" stopOpacity="1" />
        </linearGradient>
      </defs>

      <path fill={url("far")} d={far} />
      <path fill={url("lee")} d={leeFace} />
      <path fill={url("lit")} d={litFace} />
      {/* The crest line catches the light */}
      <path d="M760 172 Q1000 122 1140 80 Q1165 72 1180 70 Q1260 78 1440 130" fill="none" stroke="var(--dune-crest)" strokeWidth="1.5" opacity="0.75" />
      <path fill={url("near")} opacity="0.9" d={near} />

      <g mask={url("ripple-mask")}>
        <path fill={url("ripples")} d={far} />
        <path fill={url("ripples")} d={leeFace} />
        <path fill={url("ripples")} d={litFace} />
        <path fill={url("ripples")} d={near} />
      </g>

      {/* Into the paper */}
      {haze ? <rect x="0" y="400" width="1440" height="120" fill={url("haze")} /> : null}
    </svg>
  );
}
