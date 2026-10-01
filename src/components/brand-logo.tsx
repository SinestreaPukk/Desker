import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/**
 * The Desker mascot logo: friendly light-blue circular character with dark navy features.
 * Rendered with a transparent background.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/desker-mark.png"
      alt={BRAND.name}
      width={40}
      height={40}
      draggable={false}
      className={cn("inline-block size-6 shrink-0 select-none object-contain", className)}
    />
  );
}

/**
 * The full lockup: mascot mark alongside "Desker" and "Agentic AI Platform".
 */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-3 select-none", className)}>
      <BrandMark className="size-11" />
      <div className="flex flex-col">
        <span className="text-xl font-bold tracking-tight text-ink leading-tight">
          {BRAND.name}
        </span>
        <span className="text-xs font-medium tracking-wide text-ink-muted leading-tight">
          {BRAND.tagline}
        </span>
      </div>
    </div>
  );
}
