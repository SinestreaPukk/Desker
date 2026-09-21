"use client";

import * as React from "react";
import { ImageUp, X } from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import {
  AgentFigure,
  TONES,
  catalogueFor,
  defaultAvatar,
  parseBuiltIn,
  builtInKey,
} from "@/components/agent-figure";
import { Button } from "@/components/ui/button";
import { imageFileToAvatarDataUri } from "@/lib/avatars";
import { cn } from "@/lib/utils";

export function AvatarPicker({
  name,
  seed,
  value,
  onChange,
}: {
  name: string;
  /** Stable identity, so the preview matches what the roster will show. */
  seed?: string;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Open on the colour the agent already has - chosen or assigned - so the
  // swatches reflect reality rather than resetting to the first in the list.
  const [tone, setTone] = React.useState<(typeof TONES)[number]>(
    () => (parseBuiltIn(value) ?? defaultAvatar(seed || name || "agent")).tone,
  );

  const catalogue = React.useMemo(() => catalogueFor(tone), [tone]);
  const chosen = parseBuiltIn(value);

  async function onFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    setBusy(true);
    try {
      onChange(await imageFileToAvatarDataUri(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read that image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <AgentAvatar name={name || "?"} src={value} seed={seed} size="xl" />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={busy}
              onClick={() => inputRef.current?.click()}
            >
              <ImageUp aria-hidden />
              Upload a photo
            </Button>
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange(null);
                  setError(null);
                }}
              >
                <X aria-hidden />
                Reset
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-ink-muted">
            Pick a face below, or upload a photo. Leave it alone and one is chosen
            for you.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
          event.target.value = "";
        }}
      />

      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div className="space-y-3 rounded-lg border border-line bg-surface-2/50 p-3">
        <fieldset>
          <legend className="meta mb-2">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {TONES.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={`Colour ${option}`}
                aria-pressed={tone === option}
                onClick={() => {
                  setTone(option);
                  // Keep the chosen face, restate it in the new colour.
                  if (chosen?.variant) onChange(builtInKey(chosen.variant, option));
                }}
                className={cn(
                  "size-7 rounded-full border-2 transition-colors",
                  tone === option ? "border-accent" : "border-transparent",
                )}
                style={{ background: `var(--av-${option}-fg)` }}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="meta mb-2">Face</legend>
          <div className="flex flex-wrap gap-2">
            {catalogue.map((entry) => {
              const selected = value === entry.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  aria-label={`Face ${entry.variant}`}
                  aria-pressed={selected}
                  onClick={() => onChange(selected ? null : entry.key)}
                  className={cn(
                    "size-11 overflow-hidden rounded-full border-2 transition-colors",
                    selected
                      ? "border-accent"
                      : "border-transparent hover:border-line-strong",
                  )}
                >
                  <AgentFigure seed={entry.seed} tone={tone} />
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
