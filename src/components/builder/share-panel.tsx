"use client";

import * as React from "react";
import { Check, Copy, ExternalLink, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrigin } from "@/hooks/use-mounted";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export interface WidgetSettings {
  label: string;
  color: string;
  side: "right" | "left";
}

function CopyField({
  id,
  label,
  hint,
  value,
  multiline,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  value: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access can be denied; the field is selectable as a fallback.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={copy}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <textarea
        id={id}
        readOnly
        rows={multiline ? 4 : 1}
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        className={cn(
          "w-full resize-none rounded-md border border-line bg-surface-2 px-3 py-2",
          "font-mono text-xs leading-relaxed text-ink",
          !multiline && "whitespace-nowrap overflow-x-auto",
        )}
      />
      {hint ? <p className="text-xs leading-relaxed text-ink-muted">{hint}</p> : null}
      <span aria-live="polite" className="sr-only">
        {copied ? `${label} copied to clipboard` : ""}
      </span>
    </div>
  );
}

export function SharePanel({
  agentId,
  published,
  passcode,
  onPasscodeChange,
  widget,
  onWidgetChange,
  widgetFieldError,
}: {
  agentId: string;
  published: boolean;
  passcode: string;
  onPasscodeChange: (value: string) => void;
  widget: WidgetSettings;
  onWidgetChange: (next: Partial<WidgetSettings>) => void;
  widgetFieldError?: string;
}) {
  // Resolved in the browser so the snippet is correct behind any host or tunnel.
  const origin = useOrigin();

  const chatUrl = `${origin}/c/${agentId}`;
  const attributes = [
    `data-desker-agent="${agentId}"`,
    `data-desker-origin="${origin}"`,
    widget.label.trim() ? `data-desker-label="${widget.label.trim().replace(/"/g, "&quot;")}"` : null,
    widget.color.trim() ? `data-desker-color="${widget.color.trim()}"` : null,
    widget.side === "left" ? `data-desker-side="left"` : null,
  ].filter(Boolean);
  const snippet = `<script\n  src="${origin}/embed.js"\n  ${attributes.join("\n  ")}\n  defer\n></script>`;

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>Share with clients</PanelTitle>
          <PanelDescription>
            A direct link, or a chat bubble embedded in any website. Clients never
            need an account.
          </PanelDescription>
        </div>
        {published ? (
          <Badge tone="positive">Live</Badge>
        ) : (
          <Badge tone="warning">Draft — links return 404</Badge>
        )}
      </PanelHeader>

      <PanelBody className="space-y-5">
        <CopyField
          id="share-link"
          label="Direct link"
          value={chatUrl}
          hint={
            <a
              href={chatUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              Open it
              <ExternalLink className="size-3" aria-hidden />
            </a>
          }
        />

        <CopyField
          id="share-embed"
          label="Embed snippet"
          value={snippet}
          multiline
          hint="Paste before the closing </body> tag of any page. Adds a floating chat bubble."
        />

        <fieldset className="space-y-3 rounded-lg border border-line bg-surface-2/50 p-4">
          <legend className="px-1 text-sm font-medium text-ink">
            Widget appearance
          </legend>
          <p className="text-xs leading-relaxed text-ink-muted">
            Baked into the snippet above. Save, then copy it again.
          </p>

          <div className="grid gap-3 sm:grid-cols-[1fr_9rem_8rem]">
            <Field
              label="Launcher label"
              htmlFor="widgetLabel"
              hint="Also the accessible name of the button."
            >
              <Input
                value={widget.label}
                onChange={(event) => onWidgetChange({ label: event.target.value })}
                placeholder="Chat with us"
                maxLength={60}
              />
            </Field>

            <Field label="Colour" htmlFor="widgetColor" error={widgetFieldError}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick a launcher colour"
                  value={/^#[0-9a-fA-F]{6}$/.test(widget.color) ? widget.color : BRAND.color}
                  onChange={(event) => onWidgetChange({ color: event.target.value })}
                  className="size-10 shrink-0 cursor-pointer rounded-md border border-line-strong bg-surface p-1"
                />
                <Input
                  value={widget.color}
                  onChange={(event) => onWidgetChange({ color: event.target.value })}
                  placeholder={BRAND.color}
                  className="font-mono text-xs"
                />
              </div>
            </Field>

            <div className="space-y-2">
              <label htmlFor="widgetSide" className="text-sm font-medium leading-none text-ink">
                Position
              </label>
              <Select
                value={widget.side}
                onValueChange={(value) => onWidgetChange({ side: value as "right" | "left" })}
              >
                <SelectTrigger id="widgetSide">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">Bottom right</SelectItem>
                  <SelectItem value="left">Bottom left</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </fieldset>

        <Field
          label="Passcode"
          htmlFor="passcode"
          hint="Optional. When set, clients must enter it before the chat opens. Leave blank for an open link."
        >
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle"
              aria-hidden
            />
            <Input
              value={passcode}
              onChange={(event) => onPasscodeChange(event.target.value)}
              placeholder="No passcode"
              autoComplete="off"
              className="pl-9"
            />
          </div>
        </Field>
      </PanelBody>
    </Panel>
  );
}
