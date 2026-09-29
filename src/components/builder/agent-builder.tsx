"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  BookOpen,
  BotMessageSquare,
  CalendarClock,
  Check,
  Copy,
  FileCode2,
  Hand,
  MoreVertical,
  Pause,
  Play,
  RotateCcw,
  Search,
  Shuffle,
  Sliders,
  Sparkles,
  Trash2,
  UserCheck,
  UserRoundCheck,
  Workflow,
  Zap,
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
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
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
import { ScopeOfWorkPanel } from "./scope-of-work-panel";
import { BoundariesCard } from "./boundaries-card";
import { PromptPreviewDialog } from "./prompt-preview-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EscalationRuleHelper } from "./live-example";
import { HelpLink } from "@/components/help/help-panel";
import { DuplicateAgentDialog } from "./duplicate-agent-dialog";
import { DocumentsPanel } from "./documents-panel";
import { ProjectContextPanel } from "./project-context-panel";
import { SharePanel } from "./share-panel";
import { AgentHealth } from "@/components/work/agent-health";
import { RulesPanel } from "./rules-panel";
import { useSpaceKind } from "@/components/space-kind";
import { spaceCopy } from "@/lib/space-copy";
import { useAgents, useDeleteAgent, useUpdateAgent } from "@/hooks/use-admin-data";
import { useRunScope, useScope } from "@/hooks/use-work-data";
import { describeCadence } from "@/lib/work/cadence";
import { errorMessage, ApiError } from "@/lib/api-client";
import { parseLines, randomAgentName } from "@/lib/agent-fields";
import { TOOL_IDS, TOOL_METADATA, type ToolId } from "@/lib/tools/registry";
import type { AgentDetailDto } from "@/lib/serialize";
import type { AgentInput } from "@/lib/validation";
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils";

const TOOL_ICONS = {
  search: Search,
  bug: AlertCircle,
  lightbulb: Sparkles,
  handoff: UserRoundCheck,
  transfer: ArrowRightLeft,
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
    modelProvider: form.modelProvider,
    model: form.model.trim(),
    publicPasscode: form.publicPasscode.trim(),
    widgetLabel: form.widgetLabel.trim(),
    widgetColor: form.widgetColor.trim(),
    widgetSide: form.widgetSide,
  };
}

type EditorSection = "work" | "knowledge" | "profile" | "settings";

const SECTIONS: {
  id: EditorSection;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}[] = [
  { id: "work", label: "Work & schedule", hint: "When it runs, what it works on, what needs approval", icon: Workflow },
  { id: "knowledge", label: "Knowledge", hint: "Company context and reference documents", icon: BookOpen },
  { id: "profile", label: "Profile", hint: "Name, character, responsibilities, chat abilities", icon: UserCheck },
  { id: "settings", label: "Sharing & model", hint: "Public link, widget, passcode, model", icon: Sliders },
];

/** Fields the server can reject, and the section that owns each. */
const FIELD_SECTION: Record<string, EditorSection> = {
  name: "profile",
  jobTitle: "profile",
  department: "profile",
  avatarUrl: "profile",
  personality: "profile",
  responsibilities: "profile",
  escalationRule: "profile",
  allowedTools: "profile",
  widgetColor: "settings",
  publicPasscode: "settings",
  model: "settings",
  modelProvider: "settings",
};

/** A personal assistant has no public link or widget: its last section is only the model. */
const PERSONAL_SECTIONS = SECTIONS.map((item) =>
  item.id === "settings"
    ? { ...item, label: "Model", hint: "Which AI model it uses" }
    : item.id === "knowledge"
      ? { ...item, hint: "About you and your documents" }
      : item,
);

function SectionNav({ value, onChange }: { value: EditorSection; onChange: (next: EditorSection) => void }) {
  const sections = useSpaceKind() === "personal" ? PERSONAL_SECTIONS : SECTIONS;
  return (
    <nav aria-label="Editor sections" className="-mx-1 overflow-x-auto pb-1">
      <ul className="inline-flex min-w-max items-center gap-1 rounded-lg border border-line bg-surface-2/80 p-1">
        {sections.map((item) => {
          const active = item.id === value;
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onChange(item.id)}
                title={item.hint}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition duration-150",
                  active
                    ? "bg-surface font-semibold text-ink shadow-xs"
                    : "text-ink-muted hover:bg-surface/40 hover:text-ink",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-ink-subtle")} aria-hidden />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
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
  // How it is doing - last run, next run, what waits, what broke - from the roster's own list.
  const health = useAgents(project).data?.find((entry) => entry.id === agent.id)?.health;

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

  const previewAgent = React.useMemo(
    () => ({
      id: agent.id,
      name: saved.name,
      jobTitle: saved.jobTitle,
      department: saved.department,
      avatarUrl: saved.avatarUrl,
    }),
    [agent.id, saved.name, saved.jobTitle, saved.department, saved.avatarUrl],
  );

  const contextGreeting = React.useMemo<ChatBubble[]>(
    () => [
      {
        id: "greeting",
        role: "assistant",
        content: `Hi! I'm ${form.name || agent.name}, your ${form.jobTitle || agent.jobTitle}. What would you like to work on together?`,
      },
    ],
    [form.name, agent.name, form.jobTitle, agent.jobTitle],
  );

  const previewPayload = React.useMemo(
    () => ({ agentId: agent.id, previewId }),
    [agent.id, previewId],
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
        // Land on the section that owns the first rejected field.
        const first = Object.keys(caught.fieldErrors ?? {}).find((field) => FIELD_SECTION[field]);
        if (first) setSection(FIELD_SECTION[first]!);
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

  const [confirmUnpublish, setConfirmUnpublish] = React.useState(false);
  const kind = useSpaceKind();
  const personal = kind === "personal";
  const copy = spaceCopy(kind);
  // One decision at a time: the form is grouped into sections and only the
  // current one is on screen. Edits in every section persist until saved.
  // A new agent still needs its grounding; an existing one is usually opened
  // to change what it does and when.
  const [section, setSection] = React.useState<EditorSection>(onboarding ? "knowledge" : "work");

  async function togglePublish() {
    if (agent.status === "published") {
      setConfirmUnpublish(true);
      return;
    }
    const result = await save({ status: "published" });
    if (!result) return;
    toast.success(personal ? `${result.name} is on` : `${result.name} is live`, {
      description: personal
        ? "They work on their schedule and answer you in Chat. Only you can reach them."
        : "They work on their schedule and join the team chat. Share their link or widget if the role talks to clients.",
    });
    router.refresh();
  }

  async function unpublish() {
    const result = await save({ status: "draft" });
    if (!result) return;
    router.refresh();
    toast(personal ? `${result.name} is off` : `${result.name} is unpublished`, {
      description: personal
        ? "They stop working on their schedule until you switch them back on."
        : "The public link and widget stop working immediately.",
      action: {
        label: "Undo",
        onClick: () => {
          void save({ status: "published" }).then((again) => {
            if (again) {
              toast.success(`${again.name} is live again`);
              router.refresh();
            }
          });
        },
      },
    });
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
          <Button asChild variant="ghost" size="icon" aria-label="Back to roster" className="rounded-lg">
            <Link href={`/p/${project}/roster`}>
              <ArrowLeft aria-hidden />
            </Link>
          </Button>

          <AgentAvatar
            name={form.name || "?"}
            src={form.avatarUrl}
            seed={agent.id}
            size="md"
            className="ring-2 ring-line/50"
          />

          <div className="min-w-0 flex-1 basis-24">
            <Breadcrumbs
              items={[
                { label: "Roster", href: `/p/${project}/roster` },
                { label: form.name || "Untitled agent" },
              ]}
              className="mb-0.5"
            />
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-bold text-ink">
                {form.name || "Untitled agent"}
              </h1>
              <span className="hidden text-xs text-ink-subtle sm:inline">·</span>
              <span className="hidden truncate text-xs text-ink-muted sm:inline">
                {form.jobTitle || "Agent Studio"}
              </span>
            </div>
          </div>

          <div className="flex w-full items-center gap-2.5 sm:w-auto">
            <StatusBadge status={agent.status} />
            {dirty ? (
              <Badge tone="warning">Unsaved</Badge>
            ) : (
              <span className="hidden items-center gap-1 text-xs font-medium text-positive sm:inline-flex">
                <Check className="size-3" aria-hidden />
                Saved
              </span>
            )}
            {/* Pushes the buttons to the right edge once the row has wrapped. */}
            <span className="flex-1 sm:hidden" />

            <Button
              variant={dirty ? "primary" : "secondary"}
              size="sm"
              onClick={() => void onSave()}
              loading={update.isPending}
              disabled={!dirty}
            >
              Save
            </Button>

            <Button
              size="sm"
              variant={!dirty && agent.status !== "published" ? "primary" : "secondary"}
              onClick={() => void togglePublish()}
              loading={update.isPending}
            >
              {agent.status === "published" ? (personal ? "Switch off" : "Unpublish") : personal ? "Switch on" : "Publish"}
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
                  View the agent&apos;s instructions
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
                <BotMessageSquare aria-hidden />
                Chat
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <ConfirmDialog
        open={confirmUnpublish}
        onOpenChange={setConfirmUnpublish}
        title={personal ? `Switch ${agent.name} off?` : `Unpublish ${agent.name}?`}
        description="Anyone using the public link or the widget gets a 404 from the moment you confirm. Conversations and documents are kept, and you can undo right after."
        confirmLabel={personal ? "Switch off" : "Unpublish"}
        onConfirm={unpublish}
      />
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

            {health ? <AgentHealth status={health} project={project} /> : null}
            <ScheduleSummary agentId={agent.id} onEdit={() => setSection("work")} />
            <BoundariesCard
              agentId={agent.id}
              escalationRule={saved.escalationRule}
              onEdit={() => setSection("work")}
              onRules={() => setSection("profile")}
            />

            <SectionNav value={section} onChange={setSection} />

            {/* Work & schedule ------------------------------------------ */}
            {section === "work" ? (
              <ScopeOfWorkPanel
                agentId={agent.id}
                project={project}
                agent={{ name: form.name, jobTitle: form.jobTitle }}
              />
            ) : null}

            {/* Knowledge: what every agent shares, then this agent's files. */}
            {section === "knowledge" ? (
              <>
                <ProjectContextPanel project={project} embedded />
                <DocumentsPanel agentId={agent.id} />
              </>
            ) : null}

            {/* Profile ---------------------------------------------------- */}
            {section === "profile" ? (
            <>
            <RulesPanel agentId={agent.id} agentName={agent.name} project={project} />
            <Panel>
              <PanelHeader>
                <div>
                  <PanelTitle>Profile</PanelTitle>
                  <PanelDescription>
                    Who this agent is and how it behaves. It follows these word for word, so
                    be specific.
                  </PanelDescription>
                </div>
              </PanelHeader>
              <PanelBody className="space-y-6">
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field
                    label="Name"
                    htmlFor="name"
                    required
                    error={fieldErrors.name?.[0]}
                    action={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => set("name", randomAgentName())}
                        className="shrink-0"
                        title="Randomize name"
                        aria-label="Randomize name"
                      >
                        <Shuffle aria-hidden />
                      </Button>
                    }
                  >
                    <Input
                      value={form.name}
                      onChange={(event) => set("name", event.target.value)}
                      placeholder={agent.name || "e.g. Bright"}
                    />
                  </Field>

                  <Field
                    label={copy.roleLabel}
                    htmlFor="jobTitle"
                    required
                    error={fieldErrors.jobTitle?.[0]}
                  >
                    <Input
                      value={form.jobTitle}
                      onChange={(event) => set("jobTitle", event.target.value)}
                      placeholder={copy.rolePlaceholder}
                    />
                  </Field>

                  {copy.showTeam ? (
                    <Field
                      label="Team"
                      htmlFor="department"
                      hint="Optional. Groups the roster."
                    >
                      <Input
                        value={form.department}
                        onChange={(event) => set("department", event.target.value)}
                        placeholder={copy.teamPlaceholder}
                      />
                    </Field>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label>Avatar</Label>
                  <AvatarPicker
                    name={form.name}
                    seed={agent.id}
                    value={form.avatarUrl}
                    onChange={(next) => set("avatarUrl", next)}
                  />
                </div>

                <Field
                  label="Personality and tone"
                  htmlFor="personality"
                  required
                  error={fieldErrors.personality?.[0]}
                  hint="How it speaks and what it is like to deal with. Two or three sentences is plenty."
                  aside={
                    <span className="meta tabular-nums">
                      {form.personality.length}/4000
                    </span>
                  }
                >
                  <Textarea
                    value={form.personality}
                    onChange={(event) => set("personality", event.target.value)}
                    rows={4}
                    maxLength={4000}
                    placeholder={
                      "Warm but efficient. Gets to the point in two sentences, never uses corporate filler, and always says plainly when something isn't possible."
                    }
                  />
                </Field>

                <Field
                  label="Responsibilities"
                  htmlFor="responsibilities"
                  hint="One per line. Anything not on this list is out of scope for this agent."
                >
                  <Textarea
                    value={form.responsibilitiesText}
                    onChange={(event) =>
                      set("responsibilitiesText", event.target.value)
                    }
                    rows={4}
                    placeholder={copy.responsibilitiesPlaceholder}
                  />
                </Field>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-ink">
                    What it may do when chatting
                  </legend>
                  <p className="text-xs text-ink-muted">
                    Unchecked actions are not offered to the model and are refused if it asks
                    anyway. What it does on its own is set under Work &amp; schedule.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                  {/* In a personal space nobody but you chats with it, so the
                      client-facing actions (log a bug, transfer) do not apply. */}
                  {TOOL_IDS.filter((tool) => !personal || tool === "search_documents").map((tool) => {
                    const meta = TOOL_METADATA[tool];
                    const Icon = TOOL_ICONS[meta.icon];
                    const checked = form.allowedTools.includes(tool);
                    return (
                      <label
                        key={tool}
                        htmlFor={`tool-${tool}`}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
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
                          <span className="block text-sm font-medium text-ink">
                            {meta.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                            {meta.blurb}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  </div>
                </fieldset>

                {escalationEnabled ? (
                  <div className="space-y-2">
                    <Field
                      label="When to hand over to a person"
                      htmlFor="escalationRule"
                      aside={<HelpLink topic="escalationRule" label="When does an agent escalate?" />}
                      hint="Plain language. The agent judges it from the meaning of the conversation, not by keyword matching."
                    >
                      <Textarea
                        value={form.escalationRule}
                        onChange={(event) => set("escalationRule", event.target.value)}
                        rows={3}
                        placeholder={copy.escalationPlaceholder}
                      />
                    </Field>
                    <EscalationRuleHelper
                      value={form.escalationRule}
                      onPick={(text) => set("escalationRule", text)}
                    />
                  </div>
                ) : null}
              </PanelBody>
            </Panel>
            </>
            ) : null}

            {/* Sharing & model ------------------------------------------- */}
            {section === "settings" ? (
              <>
                {personal ? (
                  <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
                    <span className="font-medium text-ink">Private to you.</span> Assistants in your personal space have
                    no public link or widget, and nobody else can chat with them.
                  </p>
                ) : (
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
                )}

                <Panel>
                  <PanelHeader>
                    <div>
                      <PanelTitle>Model</PanelTitle>
                      <PanelDescription>
                        Which provider answers for this agent. Switching changes nothing else.
                      </PanelDescription>
                    </div>
                  </PanelHeader>
                  <PanelBody className="space-y-5">
                    <div className="max-w-sm space-y-1.5">
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
                          <SelectItem value="anthropic">Anthropic (Claude - Recommended)</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <details className="group rounded-lg border border-line p-3.5 text-sm" open={Boolean(form.model.trim())}>
                      <summary className="flex cursor-pointer select-none items-center justify-between font-medium text-ink-muted hover:text-ink">
                        <span>Advanced: choose a specific model</span>
                        <span className="text-xs text-ink-subtle transition-transform group-open:rotate-180">▼</span>
                      </summary>
                      <div className="mt-3 border-t border-line pt-3">
                        <Field
                          label="Model name or version"
                          htmlFor="model"
                          hint="Leave blank unless you have been told to use a particular model."
                        >
                          <Input
                            value={form.model}
                            onChange={(event) => set("model", event.target.value)}
                            placeholder="claude-sonnet-4-6"
                            className="font-mono text-xs"
                          />
                        </Field>
                      </div>
                    </details>
                  </PanelBody>
                </Panel>
              </>
            ) : null}
          </div>
        </div>

        {/* --- colleague collaboration chat -------------------------------- */}
        <aside
          className={cn(
            "flex min-h-0 flex-col border-line bg-surface lg:border-l",
            mobilePane === "configure" && "hidden lg:flex",
          )}
          aria-label={`Chat with ${form.name || agent.name}`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-line bg-surface/80 px-4 py-3 backdrop-blur-xs">
            <div className="flex min-w-0 items-center gap-2">
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold leading-tight text-ink">
                  Chat with {form.name || agent.name}
                </h2>
                <p className="mt-0.5 truncate text-xs leading-tight text-ink-muted">
                  {dirty
                    ? "Save to test your latest edits"
                    : `${form.jobTitle || agent.jobTitle} · Ready to collaborate`}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                previewControls.current?.reset(contextGreeting);
                fetch(`/api/preview?previewId=${encodeURIComponent(previewId)}`, {
                  method: "DELETE",
                }).catch(() => {});
              }}
            >
              <RotateCcw aria-hidden />
              Restart
            </Button>
          </div>

          <ChatSurface
            agent={previewAgent}
            endpoint="/api/preview"
            payload={previewPayload}
            controlsRef={previewControls}
            initialMessages={contextGreeting}
            composerPlaceholder={`Message ${form.name || agent.name}…`}
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
  const personal = useSpaceKind() === "personal";
  return (
    <div className="border-b border-accent-line bg-accent-soft px-4 py-3 sm:px-6">
      <p className="text-sm font-medium text-accent-soft-fg">
        {agent.name} is created. Two steps left:
      </p>
      <ol className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-accent-soft-fg/90">
        <li>
          {personal
            ? "1. Answer the questions about you & upload what it should read (a statement, your CV, notes)"
            : "1. Answer company context & upload reference documents"}
        </li>
        <li>
          {personal
            ? "2. Try it in the chat beside the editor, then switch it on"
            : "2. Chat with your agent to test work & collaborate, then hit Publish"}
        </li>
      </ol>
    </div>
  );
}

/**
 * When this agent works, visible from every tab: the one setting an owner
 * most often comes back to check, and the one that decides whether the agent
 * works on its own at all.
 */
function ScheduleSummary({ agentId, onEdit }: { agentId: string; onEdit: () => void }) {
  const scope = useScope(agentId);
  const run = useRunScope(agentId);
  if (!scope.data) return null;
  const s = scope.data;

  const paused = s.triggerType !== "manual" && !s.enabled;
  const { Icon, title, detail } =
    paused
      ? { Icon: Pause, title: "Paused", detail: "Its trigger is turned off, so it only runs when you start it." }
      : s.triggerType === "cron"
        ? {
            Icon: CalendarClock,
            title: describeCadence(s.cron, s.timezone),
            detail: s.nextFireAt ? `Next run ${formatRelativeTime(s.nextFireAt)} (${formatDateTime(s.nextFireAt)}).` : "Runs on its own.",
          }
        : s.triggerType === "webhook"
          ? { Icon: Zap, title: "Runs when triggered", detail: "Starts whenever its webhook receives an event." }
          : { Icon: Hand, title: "Only when you run it", detail: "Give it a schedule to have it work on its own." };

  async function onRun() {
    try {
      const item = await run.mutateAsync();
      if (item.error) toast.error("The run could not start", { description: item.error });
      else toast.success("Run started", { description: "Progress shows under Work & schedule." });
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
      <span
        aria-hidden
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4.5",
          s.triggerType === "manual" || paused
            ? "bg-surface-2 text-ink-muted"
            : "bg-accent-soft text-accent-soft-fg",
        )}
      >
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{title}</p>
        <p className="truncate text-xs text-ink-muted">{detail}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Change
        </Button>
        <Button variant="secondary" size="sm" onClick={() => void onRun()} loading={run.isPending}>
          <Play aria-hidden />
          Run now
        </Button>
      </div>
    </div>
  );
}
