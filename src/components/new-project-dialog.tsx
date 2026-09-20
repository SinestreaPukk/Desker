"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/states";
import { api, ApiError, errorMessage } from "@/lib/api-client";

interface CreatedProject {
  id: string;
  name: string;
  slug: string;
}

export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const create = useMutation({
    mutationFn: (value: string) =>
      api<CreatedProject>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: value }),
      }),
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    setError(null);
    try {
      const project = await create.mutateAsync(value);
      onOpenChange(false);
      setName("");
      // A new project has no agents, so its roster is the only useful landing
      // spot - and it opens on the empty state that invites creating one.
      router.push(`/p/${project.slug}/roster`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : errorMessage(caught),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            A project has its own roster, inbox and insights. Use one per client
            or per product line — nothing is shared between them.
          </DialogDescription>

          <div className="mt-5 space-y-4">
            <FormError message={error} />
            <Field label="Name" htmlFor="project-name" required>
              <Input
                value={name}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                placeholder="Northwind Supply"
              />
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
