import type { ToolDefinition } from "@/lib/llm/provider";

export const REMEMBER_TOOL: ToolDefinition = {
  name: "remember",
  description: "Save one fact the user told you or you inferred about them, their preferences, routines, or people in their life. Stated facts save immediately.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      fact: { type: "string", description: "The fact to remember, written clearly in one sentence." },
      kind: { type: "string", enum: ["preference", "person", "routine", "standing_instruction", "fact"], description: "The kind of memory." },
      personName: { type: "string", description: "Optional name of the person this relates to (e.g. 'Mom', 'Nok')." },
      inferred: { type: "boolean", description: "Set to true if this was only inferred by you rather than explicitly stated by the user." },
    },
    required: ["fact"],
  },
};

export const FORGET_TOOL: ToolDefinition = {
  name: "forget",
  description: "Delete a stored memory or fact. Use when the user says 'forget that' or asks you to forget a specific fact or preference.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      query: { type: "string", description: "The fact or topic to forget, or 'that' to forget the most recent memory." },
      memoryId: { type: "string", description: "Optional specific memory ID to delete." },
    },
  },
};

export const RECALL_TOOL: ToolDefinition = {
  name: "recall",
  description: "Search the person's stored memories by meaning to find facts, preferences, routines, or contacts.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      query: { type: "string", description: "The meaning or topic to recall." },
      personName: { type: "string", description: "Optional person to scope the recall to (e.g. 'Mom')." },
      kind: { type: "string", description: "Optional kind filter: preference, person, routine, standing_instruction, fact." },
    },
    required: ["query"],
  },
};

export const CREATE_COMMITMENT_TOOL: ToolDefinition = {
  name: "create_commitment",
  description: "Create an open commitment or loop that stays open until verified done: things the user must do, things the user is waiting on from others, or recurring obligations.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", enum: ["to_do", "waiting_on", "recurring"], description: "Type of commitment: things user must do (to_do), waiting on others (waiting_on), or recurring obligation (recurring)." },
      outcome: { type: "string", description: "The outcome in plain words, e.g. 'Nok sends signed contract'." },
      dueAt: { type: "string", description: "Optional due date and time as ISO 8601 string." },
      ownerRole: { type: "string", enum: ["user", "other"], description: "Who owns this outcome: 'user' or 'other'." },
      ownerName: { type: "string", description: "If waiting on someone else, their name (e.g. 'Nok')." },
      sourceRef: { type: "string", description: "Optional link back to message or file." },
    },
    required: ["type", "outcome"],
  },
};

export const UPDATE_COMMITMENT_TOOL: ToolDefinition = {
  name: "update_commitment",
  description: "Update an existing commitment's outcome, due date, status, snooze, or add an activity note.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", description: "The commitment ID." },
      outcome: { type: "string", description: "Updated outcome description." },
      dueAt: { type: "string", description: "Updated due date as ISO 8601 string." },
      status: { type: "string", enum: ["open", "waiting", "snoozed", "done", "dropped"], description: "Updated status." },
      snoozedUntil: { type: "string", description: "If snoozing, date until which to snooze as ISO 8601 string." },
      note: { type: "string", description: "Activity note explaining the update." },
    },
    required: ["id"],
  },
};

export const LIST_COMMITMENTS_TOOL: ToolDefinition = {
  name: "list_commitments",
  description: "List the person's commitments and open loops (things to do, things waiting on others, recurring obligations).",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: { type: "string", enum: ["open", "waiting", "snoozed", "done", "dropped", "active"], description: "Status filter. 'active' returns open, waiting, and snoozed." },
      type: { type: "string", enum: ["to_do", "waiting_on", "recurring"], description: "Type filter." },
      ownerName: { type: "string", description: "Filter by person waiting on." },
    },
  },
};

export const CLOSE_COMMITMENT_TOOL: ToolDefinition = {
  name: "close_commitment",
  description: "Close an open commitment when the outcome has happened (done) or is abandoned (dropped).",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", description: "The commitment ID." },
      status: { type: "string", enum: ["done", "dropped"], description: "Closing status: 'done' when outcome happened, 'dropped' when cancelled." },
      reason: { type: "string", description: "Why it is being closed." },
    },
    required: ["id", "status"],
  },
};

export const CAPTURE_ITEM_TOOL: ToolDefinition = {
  name: "capture_item",
  description: "Intake and classify any captured input: bill, task, event, note, question, or vault file.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      content: { type: "string", description: "The text content or description of the captured input." },
      classification: { type: "string", enum: ["task", "event", "bill", "note", "question", "vault_file"], description: "Classification of the input." },
      details: { type: "object", description: "Structured details (payee, amount, due date, etc.)." },
    },
    required: ["content"],
  },
};

export const UPDATE_TRIGGER_RULE_TOOL: ToolDefinition = {
  name: "update_trigger_rule",
  description: "Update user trigger rules and notification settings (brief time, quiet hours, enable/disable topics).",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      ruleName: { type: "string", description: "Name of rule, e.g. 'morning_brief', 'due_soon', 'conflict_alert', 'quiet_hours'." },
      enabled: { type: "boolean", description: "Enable or disable this proactive trigger." },
      time: { type: "string", description: "Time of day (e.g. '07:30')." },
      quietHoursStart: { type: "string", description: "Quiet hours start time (e.g. '22:00')." },
      quietHoursEnd: { type: "string", description: "Quiet hours end time (e.g. '07:00')." },
      description: { type: "string", description: "Description or user adjustment." },
    },
    required: ["ruleName"],
  },
};

export const LIST_TRIGGER_RULES_TOOL: ToolDefinition = {
  name: "list_trigger_rules",
  description: "List the person's proactive trigger rules, scheduled briefings, and quiet hour rules.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
};
