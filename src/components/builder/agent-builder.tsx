"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  Bug,
  Copy,
  FileCode2,
  Eye,
  Lightbulb,
  MoreVertical,
  RotateCcw,
  Search,
  Sliders,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input, Label, Textarea } from "@/components/ui/field";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/ui/states";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatSurface } from "@/components/chat/chat-surface";
import type { ChatBubble } from "@/hooks/use-chat-stream";
import { AvatarPicker } from "./avatar-picker";
import { PromptPreviewDialog } from "./prompt-preview-dialog";
import { DuplicateAgentDialog } from "./duplicate-agent-dialog";
import { DocumentsPanel } from "./documents-panel";
import { SharePanel } from "./share-panel";
import { useDeleteAgent, useUpdateAgent } from "@/hooks/use-admin-data";
import { errorMessage, ApiError } from "@/lib/api-client";
import { parseLines } from "@/lib/agent-fields";
import { TOOL_IDS, TOOL_METADATA, type ToolId } from "@/lib/tools/registry";
import type { AgentDetailDto } from "@/lib/serialize";
import type { AgentInput } from "@/lib/validation";
import { cn } from "@/lib/utils";

const TOOL_ICONS = {
  search: Search,
  bug: Bug,
  lightbulb: Lightbulb,
  handoff: UserRoundCheck,
  transfer: ArrowLeftRight,
} as const;

interface FormState {
  name: string;
  jobTitle: string;
  department: string;
  avatarUrl: string | null;
  personality: string;
  responsibilitiesText: string;
  allowedTools: ToolId[];
  escalationRule: string;
  welcomeMessage: string;
  modelProvider: "anthropic" | "openai";
  model: string;
  publicPasscode: string;
  widgetLabel: string;
  widgetColor: string;
  widgetSide: "right" | "left";
}

function toFormState(agent: AgentDetailDto): FormState {
  return {
    name: agent.name,
    jobTitle: agent.jobTitle,
    department: agent.department ?? "",
    avatarUrl: agent.avatarUrl,
    personality: agent.personality,
    responsibilitiesText: agent.responsibilities.join("\n"),
    allowedTools: agent.allowedTools.filter((tool): tool is ToolId =>
      (TOOL_IDS as readonly string[]).includes(tool),
    ),
    escalationRule: agent.escalationRule ?? "",
    welcomeMessage: agent.welcomeMessage ?? "",
    modelProvider: agent.modelProvider === "openai" ? "openai" : "anthropic",
    model: agent.model ?? "",
    publicPasscode: agent.publicPasscode ?? "",
    widgetLabel: agent.widgetLabel ?? "",
    widgetColor: agent.widgetColor ?? "",
    widgetSide: agent.widgetSide === "left" ? "left" : "right",
  };
}

function toPayload(form: FormState) {
  return {
    name: form.name.trim(),
    jobTitle: form.jobTitle.trim(),
    department: form.department.trim(),
    avatarUrl: form.avatarUrl ?? "",
    personality: form.personality.trim(),
    responsibilities: parseLines(form.responsibilitiesText),
    allowedTools: form.allowedTools,
    escalationRule: form.escalationRule.trim(),
    welcomeMessage: form.welcomeMessage.trim(),
    modelProvider: form.modelProvider,
    model: form.model.trim(),
    publicPasscode: form.publicPasscode.trim(),
    widgetLabel: form.widgetLabel.trim(),
    widgetColor: form.widgetColor.trim(),
    widgetSide: form.widgetSide,
  };
}

export function AgentBuilder({
  agent,
  project,
  onboarding,
}: {
  agent: AgentDetailDto;
  project: string;
  onboarding: boolean;
}) {
  const router = useRouter();
  const update = useUpdateAgent(agent.id);
  const remove = useDeleteAgent();

  const [form, setForm] = React.useState<FormState>(() => toFormState(agent));
  const [saved, setSaved] = React.useState<FormState>(() => toFormState(agent));
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [mobilePane, setMobilePane] = React.useState<"configure" | "preview">(
    "configure",
  );
  const [showPrompt, setShowPrompt] = React.useState(false);
  const [showDuplicate, setShowDuplicate] = React.useState(false);

  // Preview conversations are keyed per mounted builder so two open tabs do not
  // share a thread. useId is stable across renders and unique per instance,
  // unlike a random value computed during render.
  const instanceId = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const previewId = `${agent.id}-${instanceId}`;
  const previewControls = React.useRef<{ reset: (next?: ChatBubble[]) => void } | null>(
    null,
  );

  const dirty = React.useMemo(
    () => JSON.stringify(form) !== JSON.stringify(saved),
    [form, saved],
  );

  // Warn before losing edits on a reload or tab close.
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = React.useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) =>
      setForm((current) => ({ ...current, [key]: value })),
    [],
  );

  async function save(overrides: Partial<AgentInput> = {}) {
    setSaveError(null);
    setFieldErrors({});
    try {
      const result = await update.mutateAsync({ ...toPayload(form), ...overrides });
      setSaved(toFormState(result));
      setForm(toFormState(result));
      return result;
    } catch (caught) {
      if (caught instanceof ApiError) {
        setSaveError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setSaveError(errorMessage(caught));
      }
      return null;
    }
  }

  async function onSave() {
    const result = await save();
    if (result) toast.success("Changes saved");
  }

  async function togglePublish() {
    const next = agent.status === "published" ? "draft" : "published";
    const result = await save({ status: next });
    if (!result) return;
    toast.success(
      next === "published"
        ? `${result.name} is live — clients can reach them now.`
        : `${result.name} is back to draft. Client links now return 404.`,
    );
    router.refresh();
  }

  const escalationEnabled = form.allowedTools.includes("escalate_to_human");

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      {/* --- header ---------------------------------------------------- */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        {/* Wraps on a phone: the actions need the full width, and without the
            wrap they squeeze the name to zero and push the overflow menu off
            the right edge. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-6">
          <Button asChild variant="ghost" size="icon" aria-label="Back to roster">
            <Link href={`/p/${project}/roster`}>
              <ArrowLeft aria-hidden />
            </Link>
          </Button>

          <AgentAvatar
            name={form.name || "?"}
            src={form.avatarUrl}
            seed={agent.id}
            size="md"
          />

          <div className="min-w-0 flex-1 basis-24">
            <h1 className="truncate text-[0.9375rem] font-semibold text-ink">
              {form.name || "Untitled agent"}
            </h1>
            <p className="truncate text-xs text-ink-muted">
              {form.jobTitle || "No job title yet"}
            </p>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <StatusBadge status={agent.status} />
            {dirty ? <Badge tone="warning">Unsaved</Badge> : null}
            {/* Pushes the buttons to the right edge once the row has wrapped. */}
            <span className="flex-1 sm:hidden" />

            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onSave()}
              loading={update.isPending}
              disabled={!dirty}
            >
              Save
            </Button>

            <Button
              size="sm"
              variant={agent.status === "published" ? "subtle" : "primary"}
              onClick={() => void togglePublish()}
              loading={update.isPending}
            >
              {agent.status === "published" ? "Unpublish" : "Publish"}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreVertical aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setShowPrompt(true)}>
                  <FileCode2 aria-hidden />
                  View system prompt
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShowDuplicate(true)}>
                  <Copy aria-hidden />
                  Duplicate…
                </DropdownMenuItem>
                <DeleteAgentItem
                  name={agent.name}
                  pending={remove.isPending}
                  onConfirm={async () => {
                    await remove.mutateAsync(agent.id);
                    toast.success(`${agent.name} removed from the roster`);
                    router.push(`/p/${project}/roster`);
                  }}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Pane switcher, mobile and tablet only. */}
        <div className="border-t border-line px-4 py-2 lg:hidden">
          <Tabs
            value={mobilePane}
            onValueChange={(value) => setMobilePane(value as typeof mobilePane)}
          >
            <TabsList className="w-full">
              <TabsTrigger value="configure" className="flex-1">
                <Sliders aria-hidden />
                Configure
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex-1">
                <Eye aria-hidden />
                Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <PromptPreviewDialog
        agentId={agent.id}
        open={showPrompt}
        onOpenChange={setShowPrompt}
        dirty={dirty}
      />
      <DuplicateAgentDialog
        agentId={agent.id}
        agentName={agent.name}
        currentProjectSlug={project}
        open={showDuplicate}
        onOpenChange={setShowDuplicate}
      />

      {onboarding ? <OnboardingChecklist agent={agent} /> : null}

      {/* --- body ------------------------------------------------------ */}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_30rem]">
        <div
          className={cn(
            "min-w-0 overflow-y-auto p-4 sm:p-6",
            mobilePane === "preview" && "hidden lg:block",
          )}
        >
          <div className="mx-auto max-w-3xl space-y-5 pb-16">
            <FormError message={saveError} />

            {/* Identity ------------------------------------------------- */}
            <Panel>
              <PanelHeader>
                <div>
                  <PanelTitle>Identity</PanelTitle>
                  <PanelDescription>
                    How this agent introduces itself to clients.
                  </PanelDescription>
                </div>
              </PanelHeader>
              <PanelBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Name"
                    htmlFor="name"
                    required
                    error={fieldErrors.name?.[0]}
                  >
                    <Input
                      value={form.name}
                      onChange={(event) => set("name", event.target.value)}
                      placeholder="Mia"
                    />
                  </Field>

                  <Field
                    label="Job title"
                    htmlFor="jobTitle"
                    required
                    error={fieldErrors.jobTitle?.[0]}
                  >
                    <Input
                      value={form.jobTitle}
                      onChange={(event) => set("jobTitle", event.target.value)}
                      placeholder="Customer Support Lead"
                    />
                  </Field>
                </div>

                <Field label="Team" htmlFor="department" hint="Optional.">
                  <Input
                    value={form.department}
                    onChange={(event) => set("department", event.target.value)}
                    placeholder="Customer Experience"
                  />
                </Field>

                <div className="space-y-2">
                  <Label>Avatar</Label>
                  <AvatarPicker
                    name={form.name}
                    seed={agent.id}
                    value={form.avatarUrl}
                    onChange={(next) => set("avatarUrl", next)}
                  />
                </div>

                <Field
                  label="Opening message"
                  htmlFor="welcomeMessage"
                  hint="Shown before the client says anything. Leave blank to open with a quiet screen."
                >
                  <Textarea
                    value={form.welcomeMessage}
                    onChange={(event) => set("welcomeMessage", event.target.value)}
                    rows={2}
                    placeholder="Hi, I'm Mia. Ask me anything about orders, returns or your account."
                  />
                </Field>
              </PanelBody>
            </Panel>

            {/* Character ------------------------------------------------ */}
            <Panel>
              <PanelHeader>
                <div>
                  <PanelTitle>Character &amp; scope</PanelTitle>
                  <PanelDescription>
                    Both go into the system prompt verbatim. Be specific — vague
                    personas produce vague agents.
                  </PanelDescription>
                </div>
              </PanelHeader>
              <PanelBody className="space-y-4">
                <Field
                  label="Personality and tone"
                  htmlFor="personality"
                  required
                  error={fieldErrors.personality?.[0]}
                  hint="How they speak, what they're like to deal with, what they never do."
                  aside={
                    <span className="meta tabular-nums">
                      {form.personality.length}/4000
                    </span>
                  }
                >
                  <Textarea
                    value={form.personality}
                    onChange={(event) => set("personality", event.target.value)}
                    rows={5}
                    maxLength={4000}
                    placeholder={
                      "Warm but efficient. Gets to the point in two sentences, never uses corporate filler, and always says plainly when something isn't possible. Uses the client's name once, not repeatedly."
                    }
                  />
                </Field>

                <Field
                  label="Responsibilities"
                  htmlFor="responsibilities"
                  hint="One per line. Anything not listed here is explicitly out of scope for this agent."
                >
                  <Textarea
                    value={form.responsibilitiesText}
                    onChange={(event) =>
                      set("responsibilitiesText", event.target.value)
                    }
                    rows={5}
                    placeholder={
                      "Answer questions about orders, shipping and returns\nHelp clients find the right product\nCollect enough detail on a bug for engineering to reproduce it"
                    }
                  />
                </Field>
              </PanelBody>
            </Panel>

            {/* Permissions ---------------------------------------------- */}
            <Panel>
              <PanelHeader>
                <div>
                  <PanelTitle>What they&apos;re allowed to do</PanelTitle>
                  <PanelDescription>
                    Unchecked actions are not offered to the model and are refused
                    server-side if it asks for them anyway.
                  </PanelDescription>
                </div>
              </PanelHeader>
              <PanelBody className="space-y-4">
                <fieldset className="space-y-2">
                  <legend className="sr-only">Permitted actions</legend>
                  {TOOL_IDS.map((tool) => {
                    const meta = TOOL_METADATA[tool];
                    const Icon = TOOL_ICONS[meta.icon];
                    const checked = form.allowedTools.includes(tool);
                    return (
                      <label
                        key={tool}
                        htmlFor={`tool-${tool}`}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                          checked
                            ? "border-accent-line bg-accent-soft/40"
                            : "border-line hover:bg-surface-2",
                        )}
                      >
                        <Checkbox
                          id={`tool-${tool}`}
                          checked={checked}
                          onCheckedChange={(next) =>
                            set(
                              "allowedTools",
                              next
                                ? [...form.allowedTools, tool]
                                : form.allowedTools.filter((item) => item !== tool),
                            )
                          }
                          className="mt-0.5"
                        />
                        <Icon
                          className="mt-0.5 size-4 shrink-0 text-ink-subtle"
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="block text-[0.8125rem] font-medium text-ink">
                            {meta.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                            {meta.blurb}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>

                <Field
                  label="Escalation rule"
                  htmlFor="escalationRule"
                  hint={
                    escalationEnabled
                      ? "Written in plain language. The agent judges it from the meaning of the conversation, not by keyword matching."
                      : "Enable “Escalate to a human” above to use an escalation rule."
                  }
                >
                  <Textarea
                    value={form.escalationRule}
                    disabled={!escalationEnabled}
                    onChange={(event) => set("escalationRule", event.target.value)}
                    rows={3}
                    placeholder="Escalate if the client is angry, asks for a refund over $200, or mentions legal action."
                  />
                </Field>
              </PanelBody>
            </Panel>

            {/* Model ---------------------------------------------------- */}
            <Panel>
              <PanelHeader>
                <div>
                  <PanelTitle>Model</PanelTitle>
                  <PanelDescription>
                    Which provider answers for this agent. Switching providers
                    changes nothing else about the configuration.
                  </PanelDescription>
                </div>
              </PanelHeader>
              <PanelBody className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="modelProvider">Provider</Label>
                  <Select
                    value={form.modelProvider}
                    onValueChange={(value) =>
                      set("modelProvider", value as FormState["modelProvider"])
                    }
                  >
                    <SelectTrigger id="modelProvider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Field
                  label="Model override"
                  htmlFor="model"
                  hint="Blank uses the deployment default."
                >
                  <Input
                    value={form.model}
                    onChange={(event) => set("model", event.target.value)}
                    placeholder="claude-sonnet-4-6"
                    className="font-mono text-xs"
                  />
                </Field>
              </PanelBody>
            </Panel>

            <DocumentsPanel agentId={agent.id} />

            <SharePanel
              agentId={agent.id}
              published={agent.status === "published"}
              passcode={form.publicPasscode}
              onPasscodeChange={(value) => set("publicPasscode", value)}
              widget={{
                label: form.widgetLabel,
                color: form.widgetColor,
                side: form.widgetSide,
              }}
              onWidgetChange={(next) => {
                if (next.label !== undefined) set("widgetLabel", next.label);
                if (next.color !== undefined) set("widgetColor", next.color);
                if (next.side !== undefined) set("widgetSide", next.side);
              }}
              widgetFieldError={fieldErrors.widgetColor?.[0]}
            />
          </div>
        </div>

        {/* --- preview -------------------------------------------------- */}
        <aside
          className={cn(
            "flex min-h-0 flex-col border-line bg-surface lg:border-l",
            mobilePane === "configure" && "hidden lg:flex",
          )}
          aria-label="Live preview"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-[0.8125rem] font-semibold text-ink">Live preview</h2>
              <p className="truncate text-xs text-ink-muted">
                {dirty
                  ? "Save to test your latest edits"
                  : "The same runtime clients get"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => previewControls.current?.reset([])}
            >
              <RotateCcw aria-hidden />
              Restart
            </Button>
          </div>

          <ChatSurface
            agent={{
              id: agent.id,
              name: saved.name,
              jobTitle: saved.jobTitle,
              department: saved.department,
              avatarUrl: saved.avatarUrl,
              welcomeMessage: saved.welcomeMessage,
            }}
            endpoint="/api/preview"
            payload={{ agentId: agent.id, previewId }}
            controlsRef={previewControls}
            composerPlaceholder="Try what a client would ask…"
            className="min-h-[28rem] lg:min-h-0"
          />
        </aside>
      </div>
    </div>
  );
}

function DeleteAgentItem({
  name,
  pending,
  onConfirm,
}: {
  name: string;
  pending: boolean;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <DropdownMenuItem destructive onSelect={(event) => event.preventDefault()}>
          <Trash2 aria-hidden />
          Delete agent
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete {name}?</DialogTitle>
        <DialogDescription>
          This removes the agent along with every uploaded document, conversation
          transcript and logged issue. It cannot be undone.
        </DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button variant="danger" loading={pending} onClick={() => void onConfirm()}>
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OnboardingChecklist({ agent }: { agent: AgentDetailDto }) {
  return (
    <div className="border-b border-accent-line bg-accent-soft px-4 py-3 sm:px-6">
      <p className="text-[0.8125rem] font-medium text-accent-soft-fg">
        {agent.name} is created. Two steps left:
      </p>
      <ol className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-accent-soft-fg/90">
        <li>1. Upload a document under “Company context”</li>
        <li>2. Try a question in the preview, then hit Publish</li>
      </ol>
    </div>
  );
}
