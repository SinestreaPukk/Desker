"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { MessageSquareHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/shared/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/shared/api-client";

/**
 * The feedback channel: one button, always there, two fields. What people
 * write here decides what gets built next, so it has to cost them nothing.
 */
export function FeedbackButton({ project, className }: { project: string; className?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" className={cn("justify-start", className)} onClick={() => setOpen(true)}>
        <MessageSquareHeart aria-hidden />
        Send feedback
      </Button>
      <FeedbackDialog open={open} onOpenChange={setOpen} project={project} />
    </>
  );
}

function FeedbackDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: string;
}) {
  const pathname = usePathname();
  const [kind, setKind] = React.useState("idea");
  const [heuristic, setHeuristic] = React.useState("general");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [state, setState] = React.useState<"idle" | "sending" | "sent">("idle");

  const HEURISTIC_LABELS: Record<string, string> = {
    general: "General feedback",
    visibility: "System status & feedback (Doherty)",
    real_world: "Real-world phrasing & clarity",
    control: "User control & undo",
    consistency: "Consistency & navigation (Jakob's Law)",
    error_prevention: "Error prevention & guardrails",
    recognition: "Recognition over recall",
    efficiency: "Speed & shortcuts",
    minimalism: "Visual hierarchy & choices (Hick's Law)",
    accessibility: "Accessibility & contrast (WCAG)",
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setState("sending");
    const formattedMessage =
      heuristic !== "general"
        ? `[Heuristic: ${HEURISTIC_LABELS[heuristic]}]\n${message.trim()}`
        : message.trim();
    try {
      await api("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ kind, message: formattedMessage, path: pathname, project }),
      });
      setState("sent");
      setMessage("");
      setTimeout(() => {
        onOpenChange(false);
        setState("idle");
      }, 1200);
    } catch (caught) {
      setError(errorMessage(caught));
      setState("idle");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Something broken, something missing, or something you wish worked differently. It goes
              straight to the people building this.
            </DialogDescription>
          </div>
          <FormError message={error} />

          <div className="flex items-center justify-between rounded-md border border-line bg-surface-2/60 px-3 py-1.5 text-xs text-ink-muted">
            <span>Tagged to screen:</span>
            <code className="font-mono text-ink">{pathname}</code>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="This is" htmlFor="feedback-kind">
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="feedback-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">a bug</SelectItem>
                  <SelectItem value="idea">an idea</SelectItem>
                  <SelectItem value="question">a question</SelectItem>
                  <SelectItem value="other">something else</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Design &amp; usability area" htmlFor="feedback-heuristic">
              <Select value={heuristic} onValueChange={setHeuristic}>
                <SelectTrigger id="feedback-heuristic">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(HEURISTIC_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="What happened, or what would help?" htmlFor="feedback-message" required>
            <Textarea
              id="feedback-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={state !== "idle" || message.trim().length < 3}>
              {state === "sent" ? "Thank you" : state === "sending" ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
