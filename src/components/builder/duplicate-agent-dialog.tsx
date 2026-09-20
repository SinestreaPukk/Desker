"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/ui/states";
import { useDuplicateAgent, useProjects } from "@/hooks/use-admin-data";
import { errorMessage } from "@/lib/api-client";

export function DuplicateAgentDialog({
  agentId,
  agentName,
  currentProjectSlug,
  open,
  onOpenChange,
}: {
  agentId: string;
  agentName: string;
  currentProjectSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { data: projects } = useProjects();
  const duplicate = useDuplicateAgent(agentId);
  const [projectId, setProjectId] = React.useState<string>("");
  const [includeDocuments, setIncludeDocuments] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const current = projects?.find((project) => project.slug === currentProjectSlug);
  const target = projectId || current?.id || "";

  async function submit() {
    setError(null);
    try {
      const result = await duplicate.mutateAsync({
        projectId: target || undefined,
        includeDocuments,
      });
      onOpenChange(false);
      toast.success(
        `${result.agent.name} created as a draft in ${result.project.name}` +
          (result.copiedDocuments > 0
            ? ` with ${result.copiedDocuments} document${result.copiedDocuments === 1 ? "" : "s"}`
            : ""),
      );
      router.push(`/p/${result.project.slug}/agents/${result.agent.id}`);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Duplicate {agentName}</DialogTitle>
        <DialogDescription>
          Copies the persona, permissions and settings as a new draft. The copy is
          not reachable by clients until you publish it.
        </DialogDescription>

        <div className="mt-5 space-y-4">
          <FormError message={error} />

          <div className="space-y-2">
            <Label htmlFor="duplicate-project">Into project</Label>
            <Select value={target} onValueChange={setProjectId}>
              <SelectTrigger id="duplicate-project">
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                {(projects ?? []).map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                    {project.slug === currentProjectSlug ? " (this project)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label htmlFor="duplicate-docs" className="flex cursor-pointer items-start gap-3">
            <Checkbox
              id="duplicate-docs"
              checked={includeDocuments}
              onCheckedChange={(next) => setIncludeDocuments(next === true)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-[0.8125rem] font-medium text-ink">
                Copy its documents too
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                Indexed chunks are copied as they are, so the copy can answer
                immediately without re-uploading anything.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button loading={duplicate.isPending} disabled={!target} onClick={() => void submit()}>
            Duplicate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
