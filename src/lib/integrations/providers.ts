/**
 * The handful of provider calls agents make, each a thin fetch with the
 * connection's own token. Reads return trimmed text for the model; writes
 * return a DeliveryResult like publishing and email, so approvals, the run
 * report and integration health treat every outbound action the same way.
 */
import "server-only";
import type { DeliveryResult } from "@/lib/work/integrations";

const TIMEOUT_MS = 15_000;

async function call(url: string, token: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "user-agent": "Desker",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: response.ok && data.ok !== false, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function failure(provider: string, status: number, data: Record<string, unknown>): string {
  const message =
    (data.error as { message?: string } | undefined)?.message ?? data.message ?? data.error ?? `status ${status}`;
  return `${provider} answered: ${String(message).slice(0, 200)}`;
}

// --- Google Calendar -----------------------------------------------------------

export async function listCalendarEvents(
  token: string,
  window: { from: string; to: string },
): Promise<string> {
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", window.from);
  url.searchParams.set("timeMax", window.to);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "50");
  const { ok, status, data } = await call(url.toString(), token);
  if (!ok) throw new Error(failure("Google Calendar", status, data));
  const items = (data.items as Array<Record<string, unknown>> | undefined) ?? [];
  if (items.length === 0) return "No events in that window.";
  return items
    .map((event) => {
      const start = (event.start as { dateTime?: string; date?: string } | undefined) ?? {};
      const end = (event.end as { dateTime?: string; date?: string } | undefined) ?? {};
      const attendees = ((event.attendees as Array<{ email?: string }> | undefined) ?? [])
        .map((a) => a.email)
        .filter(Boolean)
        .slice(0, 8);
      return `- ${start.dateTime ?? start.date} → ${end.dateTime ?? end.date}: ${String(event.summary ?? "(no title)")}` +
        (attendees.length ? ` (with ${attendees.join(", ")})` : "");
    })
    .join("\n");
}

interface CalendarEventInput {
  summary: string;
  start: string;
  end: string;
  description?: string;
  attendees?: string[];
}

export async function createCalendarEvent(token: string, event: CalendarEventInput): Promise<DeliveryResult> {
  const { ok, status, data } = await call(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    token,
    {
      method: "POST",
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.start },
        end: { dateTime: event.end },
        attendees: event.attendees?.map((email) => ({ email })),
      }),
    },
  );
  return ok
    ? { ok, status, detail: `Added "${event.summary}" to the calendar` }
    : { ok: false, status, detail: failure("Google Calendar", status, data) };
}

// --- Slack -------------------------------------------------------------------

export async function postSlackMessage(
  token: string,
  message: { channel: string; text: string },
): Promise<DeliveryResult> {
  const post = (channel: string) =>
    call("https://slack.com/api/chat.postMessage", token, {
      method: "POST",
      body: JSON.stringify({ channel, text: message.text }),
    });
  let result = await post(message.channel);
  // A #name the bot cannot resolve directly: look the id up among channels it can see.
  if (!result.ok && result.data.error === "channel_not_found" && message.channel.startsWith("#")) {
    const list = await call("https://slack.com/api/conversations.list?limit=500&exclude_archived=true", token);
    const name = message.channel.slice(1);
    const found = ((list.data.channels as Array<{ id: string; name: string }> | undefined) ?? []).find(
      (c) => c.name === name,
    );
    if (found) result = await post(found.id);
  }
  if (result.ok) return { ok: true, status: 200, detail: `Posted to ${message.channel}` };
  const hint =
    result.data.error === "not_in_channel" || result.data.error === "channel_not_found"
      ? " - invite the Desker app to that channel first"
      : "";
  return { ok: false, status: result.status, detail: failure("Slack", result.status, result.data) + hint };
}

// --- GitHub (read-only) ------------------------------------------------------

type GithubAction = "list_repos" | "list_issues" | "get_issue" | "read_file" | "search_code";

const MAX_TEXT = 12_000;

export async function readGithub(
  token: string,
  input: { action: GithubAction; repo?: string; path?: string; number?: number; query?: string },
): Promise<string> {
  const api = (path: string) => call(`https://api.github.com${path}`, token, {
    headers: { accept: "application/vnd.github+json" },
  });
  const repo = input.repo?.replace(/^https:\/\/github\.com\//, "").replace(/\/+$/, "");
  if (input.action !== "list_repos" && !(repo && /^[\w.-]+\/[\w.-]+$/.test(repo))) {
    throw new Error('Name the repository as "owner/name".');
  }

  switch (input.action) {
    case "list_repos": {
      const { ok, status, data } = await api("/user/repos?per_page=50&sort=updated");
      if (!ok) throw new Error(failure("GitHub", status, data));
      const repos = data as unknown as Array<{ full_name: string; description: string | null }>;
      return repos.length ? repos.map((r) => `- ${r.full_name}${r.description ? `: ${r.description}` : ""}`).join("\n") : "No repositories are shared with Desker.";
    }
    case "list_issues": {
      const { ok, status, data } = await api(`/repos/${repo}/issues?state=open&per_page=30`);
      if (!ok) throw new Error(failure("GitHub", status, data));
      const issues = data as unknown as Array<{ number: number; title: string; pull_request?: unknown; labels: { name: string }[] }>;
      return issues.length
        ? issues.map((i) => `- #${i.number}${i.pull_request ? " (PR)" : ""} ${i.title}${i.labels.length ? ` [${i.labels.map((l) => l.name).join(", ")}]` : ""}`).join("\n")
        : "No open issues.";
    }
    case "get_issue": {
      if (!input.number) throw new Error("Give the issue number.");
      const [issue, comments] = await Promise.all([
        api(`/repos/${repo}/issues/${input.number}`),
        api(`/repos/${repo}/issues/${input.number}/comments?per_page=20`),
      ]);
      if (!issue.ok) throw new Error(failure("GitHub", issue.status, issue.data));
      const thread = ((comments.data as unknown as Array<{ user: { login: string }; body: string }>) ?? [])
        .map((c) => `@${c.user.login}: ${c.body}`)
        .join("\n\n");
      return `#${input.number} ${String(issue.data.title)} (${String(issue.data.state)})\n\n${String(issue.data.body ?? "")}\n\n${thread}`.slice(0, MAX_TEXT);
    }
    case "read_file": {
      if (!input.path) throw new Error("Give the file path.");
      const { ok, status, data } = await api(`/repos/${repo}/contents/${input.path.split("/").map(encodeURIComponent).join("/")}`);
      if (!ok) throw new Error(failure("GitHub", status, data));
      if (Array.isArray(data)) {
        return (data as Array<{ path: string; type: string }>).map((entry) => `- ${entry.path}${entry.type === "dir" ? "/" : ""}`).join("\n");
      }
      const text = Buffer.from(String(data.content ?? ""), "base64").toString("utf8");
      return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n… (truncated)` : text;
    }
    case "search_code": {
      if (!input.query) throw new Error("Give something to search for.");
      const { ok, status, data } = await api(`/search/code?per_page=20&q=${encodeURIComponent(`${input.query} repo:${repo}`)}`);
      if (!ok) throw new Error(failure("GitHub", status, data));
      const hits = (data.items as Array<{ path: string }> | undefined) ?? [];
      return hits.length ? hits.map((h) => `- ${h.path}`).join("\n") : "No matches.";
    }
  }
}
