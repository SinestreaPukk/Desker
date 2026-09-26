"use client";

import * as React from "react";
import { Ban, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCancelRun, useRemove, type RemoveTarget } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";

/**
 * Remove one item, or clear a whole list, after a confirmation - removal is
 * permanent. As an icon button in a row, or as a labelled "Clear all".
 */
export function RemoveButton({
  targets,
  what,
  label,
  onRemoved,
}: {
  targets: RemoveTarget[];
  /** "this run", "5 conversations": finishes the sentence "Remove …?" */
  what: string;
  /** Shown as a text button (e.g. "Clear all"); omitted, it is a trash icon. */
  label?: string;
  onRemoved?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const remove = useRemove();

  return (
    <>
      {label ? (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)} disabled={targets.length === 0}>
          <Trash2 aria-hidden />
          {label}
        </Button>
      ) : (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Remove ${what}`}
          title="Remove"
          onClick={(event) => {
            // Rows are clickable; the button must not open them.
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }}
          className="hover:text-danger"
        >
          <Trash2 aria-hidden />
        </Button>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Remove ${what}?`}
        description="It is deleted for good and cannot be brought back."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={async () => {
          try {
            await remove.mutateAsync(targets);
            toast.success(targets.length > 1 ? `Removed ${targets.length} items` : "Removed");
            setOpen(false);
            onRemoved?.();
          } catch (caught) {
            toast.error(errorMessage(caught));
          }
        }}
      />
    </>
  );
}

/** Calls off queued or running work. It stays in the list as Cancelled, removable later. */
export function CancelRunButton({ id }: { id: string }) {
  const [open, setOpen] = React.useState(false);
  const cancel = useCancelRun();

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Ban aria-hidden />
        Cancel
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel this run?"
        description="The agent stops here. Anything it already drafted stays, and nothing new is sent."
        confirmLabel="Cancel run"
        tone="danger"
        onConfirm={async () => {
          try {
            await cancel.mutateAsync(id);
            toast.success("Run cancelled");
            setOpen(false);
          } catch (caught) {
            toast.error(errorMessage(caught));
          }
        }}
      />
    </>
  );
}
