/**
 * The person's own to-do list: Google Tasks or Microsoft To Do. Read back
 * into the life context, and written to (after approval) so a reminder an
 * agent sets shows up on their phone, not only inside Desker.
 */
import "server-only";
import type { DeliveryResult } from "@/lib/work/integrations";
import { connectorAccess } from "./oauth";
import { call, failure } from "./providers";
import type { Access } from "./mail-calendar";

const GTASKS = "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks";
const GRAPH = "https://graph.microsoft.com/v1.0/me/todo/lists";

export async function tasksAccess(organizationId: string): Promise<Access | null> {
  const google = await connectorAccess(organizationId, "google_tasks");
  if (google) return { provider: "google", token: google.accessToken, account: google.account };
  const ms = await connectorAccess(organizationId, "microsoft_todo");
  return ms ? { provider: "microsoft", token: ms.accessToken, account: ms.account } : null;
}

export interface RemoteTask {
  id: string;
  title: string;
  due: string | null;
}

const label = (a: Access) => (a.provider === "google" ? "Google Tasks" : "Microsoft To Do");

async function msList(a: Access): Promise<string> {
  const { ok, status, data } = await call(GRAPH, a.token);
  if (!ok) throw new Error(failure(label(a), status, data));
  const lists = (data.value as Array<{ id: string; wellknownListName?: string }> | undefined) ?? [];
  const id = (lists.find((l) => l.wellknownListName === "defaultList") ?? lists[0])?.id;
  if (!id) throw new Error("Microsoft To Do has no list yet.");
  return id;
}

/** Open (not completed) tasks. */
export async function listTasks(a: Access): Promise<RemoteTask[]> {
  if (a.provider === "google") {
    const { ok, status, data } = await call(`${GTASKS}?showCompleted=false&maxResults=100`, a.token);
    if (!ok) throw new Error(failure(label(a), status, data));
    return ((data.items as Array<Record<string, string>> | undefined) ?? []).map((t) => ({ id: t.id!, title: t.title ?? "", due: t.due ?? null }));
  }
  const { ok, status, data } = await call(`${GRAPH}/${await msList(a)}/tasks?$filter=status ne 'completed'&$top=100`, a.token);
  if (!ok) throw new Error(failure(label(a), status, data));
  return ((data.value as Array<Record<string, unknown>> | undefined) ?? []).map((t) => ({
    id: String(t.id),
    title: String(t.title ?? ""),
    due: (t.dueDateTime as { dateTime?: string } | undefined)?.dateTime ? `${(t.dueDateTime as { dateTime: string }).dateTime.slice(0, 19)}Z` : null,
  }));
}

export async function createTask(a: Access, task: { title: string; due?: string }): Promise<DeliveryResult> {
  const { ok, status, data } =
    a.provider === "google"
      ? await call(GTASKS, a.token, { method: "POST", body: JSON.stringify({ title: task.title, ...(task.due ? { due: new Date(task.due).toISOString() } : {}) }) })
      : await call(`${GRAPH}/${await msList(a)}/tasks`, a.token, {
          method: "POST",
          body: JSON.stringify({ title: task.title, ...(task.due ? { dueDateTime: { dateTime: new Date(task.due).toISOString().slice(0, 19), timeZone: "UTC" } } : {}) }),
        });
  return ok ? { ok, status, detail: `Added "${task.title}" to ${label(a)}` } : { ok: false, status, detail: failure(label(a), status, data) };
}

export async function completeTask(a: Access, id: string): Promise<DeliveryResult> {
  const { ok, status, data } =
    a.provider === "google"
      ? await call(`${GTASKS}/${encodeURIComponent(id)}`, a.token, { method: "PATCH", body: JSON.stringify({ status: "completed" }) })
      : await call(`${GRAPH}/${await msList(a)}/tasks/${encodeURIComponent(id)}`, a.token, { method: "PATCH", body: JSON.stringify({ status: "completed" }) });
  return ok ? { ok, status, detail: `Marked the task done in ${label(a)}` } : { ok: false, status, detail: failure(label(a), status, data) };
}
