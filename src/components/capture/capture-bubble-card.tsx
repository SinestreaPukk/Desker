"use client";

import * as React from "react";
import { AlertCircle, ArrowRightLeft, FileText, Calendar, CheckSquare, Receipt, HelpCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CapturedItemDto, CaptureClassification } from "@/lib/capture/types";

interface CaptureBubbleCardProps {
  item: CapturedItemDto;
  onSwitch?: (newClassification: CaptureClassification) => void;
  onConfirm?: () => void;
}

const CLASSIFICATION_ICONS: Record<CaptureClassification, React.ComponentType<{ className?: string }>> = {
  bill: Receipt,
  event: Calendar,
  task: CheckSquare,
  note: FileText,
  question: HelpCircle,
  vault_file: FileText,
};

const CLASSIFICATION_LABELS: Record<CaptureClassification, string> = {
  bill: "Bill / Receipt",
  event: "Calendar Event",
  task: "Task",
  note: "Note / Memory",
  question: "Question",
  vault_file: "Vault Document",
};

/**
 * Bubble Card for Captured Items:
 * Highlights low-confidence extractions, uncertain fields, and provides
 * one-tap switching for ambiguous items.
 */
export function CaptureBubbleCard({ item, onSwitch, onConfirm }: CaptureBubbleCardProps) {
  const Icon = CLASSIFICATION_ICONS[item.classification as CaptureClassification] || FileText;
  const isNeedsConfirmation = item.status === "needs_confirmation";
  const uncertainSet = new Set(item.uncertainFields || []);

  const data = (item.extractedData ?? {}) as Record<string, unknown>;

  return (
    <div
      className={`rounded-panel border p-4 shadow-xs transition-all ${
        isNeedsConfirmation
          ? "border-warning-line bg-warning-soft/25"
          : "border-line/70 bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-surface-2 text-ink">
            <Icon className="size-4 text-accent" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink">
                {CLASSIFICATION_LABELS[item.classification as CaptureClassification] || item.classification}
              </span>
              <Badge tone={isNeedsConfirmation ? "warning" : "positive"}>
                {isNeedsConfirmation ? "Check details" : "Captured"}
              </Badge>
            </div>
            <p className="text-sm font-medium text-ink mt-0.5">{item.headline}</p>
          </div>
        </div>

        {item.sourceRef ? (
          <span className="inline-flex items-center gap-1 text-meta text-ink-subtle">
            <ExternalLink className="size-3" aria-hidden />
            {item.sourceChannel.toUpperCase()}
          </span>
        ) : null}
      </div>

      {/* Extracted Fields Table */}
      {Object.keys(data).length > 0 ? (
        <div className="mt-3 rounded-lg border border-line/50 bg-surface/80 p-2.5 text-xs space-y-1.5">
          {Object.entries(data).map(([key, val]) => {
            if (val === null || val === undefined || typeof val === "object") return null;
            const isUncertain = uncertainSet.has(key);
            return (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-ink-muted capitalize flex items-center gap-1">
                  {key}
                  {isUncertain ? (
                    <span className="inline-flex items-center gap-0.5 text-warning font-medium">
                      <AlertCircle className="size-3" aria-hidden />
                      unsure
                    </span>
                  ) : null}
                </span>
                <span
                  className={`font-mono text-ink ${
                    isUncertain ? "rounded-sm bg-warning-soft/60 px-1 font-semibold text-warning-fg" : ""
                  }`}
                >
                  {String(val)}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Action Chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2 pt-1 border-t border-line/40">
        {item.altClassification && onSwitch ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onSwitch(item.altClassification!)}
            className="h-7 text-xs"
          >
            <ArrowRightLeft className="size-3 mr-1" aria-hidden />
            Make it a {item.altClassification} instead
          </Button>
        ) : null}

        {isNeedsConfirmation && onConfirm ? (
          <Button size="sm" onClick={onConfirm} className="h-7 text-xs">
            Confirm details
          </Button>
        ) : null}
      </div>
    </div>
  );
}
