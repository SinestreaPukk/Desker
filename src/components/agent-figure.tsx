/**
 * Agent avatar artwork.
 *
 * A duotone circle with a minimal face - two eyes and a mouth on an offset
 * colour field - in the style modern products settled on for generated
 * avatars (the "beam" idiom). It reads as a friendly character rather than a
 * drawing of a person, stays clean at 28px, and every parameter is derived from
 * a seed so the same agent always gets the same face.
 *
 * Drawn as inline SVG rather than stored as an image so the colours follow the
 * theme, it stays crisp at any size, and it costs one short string in the
 * database (`beam:<variant>:<tone>`) instead of an asset.
 */
import * as React from "react";

/** Twelve looks per tone is enough choice without a wall of near-duplicates. */
export const VARIANTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type Variant = (typeof VARIANTS)[number];

export const TONES = [1, 2, 3, 4, 5, 6] as const;
export type Tone = (typeof TONES)[number];

/** The drawing is done in a 36-unit space, then scaled by the container. */
const SIZE = 36;

/**
 * FNV-1a with a murmur3 finaliser. The finaliser matters: agent ids are cuids
 * sharing a long prefix, and plain FNV-1a leaves the low bits of such
 * neighbours correlated - a five-agent roster came out with three of them the
 * same colour.
 */
function hash(input: string, salt = ""): number {
  let value = 0x811c9dc5;
  const source = `${salt}${input}`;
  for (let i = 0; i < source.length; i++) {
    value ^= source.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}

/** A bounded number from a hash, optionally signed by one of its bits. */
function unit(h: number, range: number, signBit?: number): number {
  const value = h % range;
  if (signBit === undefined) return value;
  return (h >>> signBit) & 1 ? -value : value;
}

interface Face {
  wrapperX: number;
  wrapperY: number;
  wrapperRotate: number;
  wrapperScale: number;
  circle: boolean;
  faceX: number;
  faceY: number;
  faceRotate: number;
  eyeSpread: number;
  mouthSpread: number;
  smile: boolean;
}

/**
 * Every geometric decision, from one seed. Independently salted hashes keep
 * the parameters from moving in lockstep, so two seeds that share a colour do
 * not also share an expression.
 */
function faceFor(seed: string): Face {
  const h = (salt: string) => hash(seed, salt);

  const wrapperX = unit(h("wx"), 10, 1);
  const wrapperY = unit(h("wy"), 10, 2);

  return {
    wrapperX,
    wrapperY,
    wrapperRotate: unit(h("wr"), 360),
    wrapperScale: 1 + unit(h("ws"), SIZE / 12) / 10,
    circle: h("circle") % 2 === 0,
    // The face follows the colour field when the field has drifted far, so the
    // features always land on it rather than on the background.
    faceX: wrapperX > SIZE / 6 ? wrapperX / 2 : unit(h("fx"), 8, 1),
    faceY: wrapperY > SIZE / 6 ? wrapperY / 2 : unit(h("fy"), 7, 2),
    faceRotate: unit(h("fr"), 10, 3),
    eyeSpread: unit(h("eyes"), 5),
    mouthSpread: unit(h("mouth"), 3),
    smile: h("smile") % 2 === 0,
  };
}

/** The seed a stored variant resolves to. Stable across releases. */
function variantSeed(variant: Variant, tone: Tone): string {
  return `desker-beam-${variant}-${tone}`;
}

export function AgentFigure({
  seed,
  tone,
  title,
}: {
  /** Any stable string: an agent id, or a variant seed from the picker. */
  seed: string;
  tone: Tone;
  title?: string;
}) {
  const f = faceFor(seed);
  // Mask ids must be unique per instance, or one avatar's clip shape is
  // reused by every other avatar on the page.
  const maskId = React.useId().replace(/[^a-zA-Z0-9]/g, "");

  const field = `var(--av-${tone}-fg)`;
  const ground = `var(--av-${tone}-bg)`;
  // The face sits on the colour field, so it is drawn in the ground colour:
  // that pair is contrast-checked at 3:1 or better in both themes.
  const ink = ground;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="size-full"
      // Decorative by default: the agent's name is always rendered as text
      // beside the avatar.
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={SIZE} height={SIZE}>
        <rect width={SIZE} height={SIZE} rx={SIZE * 2} fill="#fff" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <rect width={SIZE} height={SIZE} fill={ground} />
        <rect
          x="0"
          y="0"
          width={SIZE}
          height={SIZE}
          rx={f.circle ? SIZE : SIZE / 6}
          fill={field}
          transform={`translate(${f.wrapperX} ${f.wrapperY}) rotate(${f.wrapperRotate} ${SIZE / 2} ${SIZE / 2}) scale(${f.wrapperScale})`}
        />
        <g transform={`translate(${f.faceX} ${f.faceY}) rotate(${f.faceRotate} ${SIZE / 2} ${SIZE / 2})`}>
          {f.smile ? (
            <path
              d={`M15 ${19 + f.mouthSpread}c2 1 4 1 6 0`}
              stroke={ink}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
            />
          ) : (
            <path d={`M13 ${19 + f.mouthSpread}a1 0.75 0 0 0 10 0`} fill={ink} />
          )}
          <rect x={14 - f.eyeSpread} y={14} width={1.5} height={2} rx={1} fill={ink} />
          <rect x={20 + f.eyeSpread} y={14} width={1.5} height={2} rx={1} fill={ink} />
        </g>
      </g>
    </svg>
  );
}

// --- stored value ----------------------------------------------------------

/** A built-in avatar is stored as this short key, not as image data. */
export type BuiltInAvatar = `beam:${Variant}:${Tone}`;

export function builtInKey(variant: Variant, tone: Tone): BuiltInAvatar {
  return `beam:${variant}:${tone}`;
}

export interface ResolvedAvatar {
  seed: string;
  tone: Tone;
  /** Present when the avatar came from the picker rather than the agent id. */
  variant?: Variant;
}

export function parseBuiltIn(value: string | null | undefined): ResolvedAvatar | null {
  if (!value?.startsWith("beam:")) return null;
  const [, rawVariant, rawTone] = value.split(":");
  const variant = Number(rawVariant) as Variant;
  const tone = Number(rawTone) as Tone;
  if (!VARIANTS.includes(variant) || !TONES.includes(tone)) return null;
  return { seed: variantSeed(variant, tone), tone, variant };
}

/**
 * The avatar an agent gets before anyone picks one. Derived from its id, so it
 * is stable across reloads and spreads a roster across the whole set rather
 * than making everyone look alike.
 */
export function defaultAvatar(seed: string): ResolvedAvatar {
  return {
    seed,
    tone: TONES[hash(seed, "tone:") % TONES.length]!,
  };
}

/** The picker's catalogue for one tone. */
export function catalogueFor(tone: Tone): { key: BuiltInAvatar; seed: string; variant: Variant }[] {
  return VARIANTS.map((variant) => ({
    key: builtInKey(variant, tone),
    seed: variantSeed(variant, tone),
    variant,
  }));
}
