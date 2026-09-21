"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { MessageSquareHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { api, errorMessage } from "@/lib/api-client";

/**
 * The feedback channel: one button, always there, two fields. What people
 * write here decides what gets built next, so it has to cost them nothing.
 */
export function FeedbackButton({ project }: { project: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" className="justify-start" onClick={() => setOpen(true)}>
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
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [state, setState] = React.useState<"idle" | "sending" | "sent">("idle");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setState("sending");
    try {
      await api("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ kind, message: message.trim(), path: pathname, project }),
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
        <form onSubmit={submit} className="space-y-4">
          <div>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Something broken, something missing, or something you wish worked differently. It goes
              straight to the people building this.
            </DialogDescription>
          </div>
          <FormError message={error} />
          <div>
            <label htmlFor="feedback-kind" className="text-sm font-medium text-ink">
              This is
            </label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger id="feedback-kind" className="mt-1.5 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">a bug</SelectItem>
                <SelectItem value="idea">an idea</SelectItem>
                <SelectItem value="question">a question</SelectItem>
                <SelectItem value="other">something else</SelectItem>
              </SelectContent>
            </Select>
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
