"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api-client";
import type { SpaceKind } from "@/lib/space";

/**
 * Adds the other kind of space to an account: a personal space next to a
 * business, or a business next to a personal space. Lands on its welcome
 * questions, which is where every new space starts.
 */
export function NewSpaceDialog({
  kind,
  open,
  onOpenChange,
}: {
  kind: SpaceKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const create = useMutation({
    mutationFn: () =>
      api<{ project: { slug: string } }>("/api/spaces", {
        method: "POST",
        body: JSON.stringify(kind === "personal" ? { kind } : { kind, name: name.trim() }),
      }),
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const space = await create.mutateAsync();
      onOpenChange(false);
      setName("");
      router.push(`/p/${space.project.slug}/welcome`);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const personal = kind === "personal";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogTitle>{personal ? "Add your personal space" : "Add a business"}</DialogTitle>
          <DialogDescription>
            {personal
              ? "Assistants for your own life: money, plans, your week. Private to you - nobody can be invited in, its assistants have no public link, and nothing in it is shared with your business."
              : "AI staff for a business, with its own roster, Needs you queue, team and billing. Nothing is shared with your personal space."}
          </DialogDescription>
          <div className="mt-5 space-y-4">
            <FormError message={error} />
            {personal ? null : (
              <Field label="Business name" htmlFor="space-name" required>
                <Input id="space-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Chen Studio" />
              </Field>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={create.isPending} disabled={!personal && !name.trim()}>
              {personal ? "Create my personal space" : "Create business"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
