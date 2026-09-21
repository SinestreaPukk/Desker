import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { TEMPLATES } from "@/lib/content";
import { TemplateIcon } from "@/components/marketing/template-icon";
import { cn } from "@/lib/utils";

/**
 * The parts of the landing page that are pure markup and CSS: the sky's
 * horizon, the role cards and the FAQ. No client code, so they read
 * identically to a crawler and to a browser with scripts off.
 */

/**
 * A mountain horizon drawn in three ridges, far to near, each a little
 * deeper in the sky's blue, with snow on the peaks and haze at the foot that
 * dissolves into the page. Sits at the bottom of the hero behind the
 * product window.
 */
export function Horizon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 420"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      className={cn("block h-full w-full", className)}
    >
      <defs>
        <linearGradient id="ridge-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(0.90 0.05 240)" />
          <stop offset="1" stopColor="oklch(0.94 0.03 235)" />
        </linearGradient>
        <linearGradient id="ridge-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(0.78 0.10 250)" />
          <stop offset="1" stopColor="oklch(0.90 0.05 240)" />
        </linearGradient>
        <linearGradient id="ridge-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(0.62 0.15 258)" />
          <stop offset="1" stopColor="oklch(0.84 0.08 245)" />
        </linearGradient>
        <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--paper)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--paper)" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Far ridge: low, soft, almost dissolved in the haze. */}
      <path
        fill="url(#ridge-far)"
        d="M0 300 L90 262 L160 280 L250 236 L330 268 L420 224 L500 256 L590 214 L660 246 L760 208 L840 240 L930 200 L1010 236 L1100 196 L1190 232 L1280 204 L1360 236 L1440 210 L1440 420 L0 420 Z"
      />
      {/* Mid ridge, with snow along its crest. */}
      <path
        fill="url(#ridge-mid)"
        d="M0 340 L70 300 L140 322 L230 258 L300 292 L390 232 L470 276 L540 246 L640 292 L720 236 L800 272 L900 220 L980 262 L1060 232 L1150 278 L1240 226 L1320 268 L1400 244 L1440 258 L1440 420 L0 420 Z"
      />
      <path
        fill="oklch(0.985 0.005 240)"
        opacity="0.9"
        d="M230 258 L252 276 L270 270 L300 292 L280 284 L258 290 Z M390 232 L410 254 L432 246 L470 276 L446 266 L420 272 Z M720 236 L744 258 L766 250 L800 272 L776 266 L748 270 Z M900 220 L922 244 L946 236 L980 262 L954 254 L926 258 Z M1240 226 L1262 250 L1284 242 L1320 268 L1294 260 L1266 264 Z"
      />
      {/* Near ridge: the deepest blue, on the left, like the painting. */}
      <path
        fill="url(#ridge-near)"
        d="M0 420 L0 330 L60 304 L120 332 L200 268 L260 312 L330 262 L400 300 L460 274 L540 330 L620 302 L700 350 L780 332 L860 360 L940 348 L1030 372 L1110 356 L1200 380 L1300 366 L1440 386 L1440 420 Z"
      />
      <path
        fill="oklch(0.985 0.005 240)"
        opacity="0.92"
        d="M200 268 L226 296 L246 290 L260 312 L242 306 L222 310 Z M330 262 L356 288 L378 280 L400 300 L380 294 L358 300 Z M460 274 L482 296 L500 292 L540 330 L516 318 L490 322 Z"
      />
      {/* Haze at the foot. */}
      <rect x="0" y="300" width="1440" height="120" fill="url(#haze)" />
    </svg>
  );
}

/** Every role, from the same records the wizard and showcase use. */
export function RoleGrid() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {TEMPLATES.map((role) => (
        <li key={role.id}>
          <Link
            href={`/showcase#${role.id}`}
            className="lift flex h-full flex-col rounded-panel border border-line bg-surface p-5 hover:border-accent-line hover:shadow-md"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
              <TemplateIcon icon={role.icon} className="size-4" />
            </span>
            <span className="mt-4 text-lg font-semibold tracking-tight text-ink">{role.name}</span>
            <span className="mt-1 text-sm text-ink-muted">{role.jobTitle}</span>
            <span className="mt-3 text-sm leading-relaxed text-ink-muted">{role.pitch}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Native disclosure, so it opens without JavaScript. */
export function Faq({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item, index) => (
        <details key={item.q} className="group" open={index === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-medium tracking-tight text-ink [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown
              className="size-4 shrink-0 text-ink-subtle transition-transform duration-300 group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <p className="max-w-2xl pb-6 text-base leading-relaxed text-ink-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
