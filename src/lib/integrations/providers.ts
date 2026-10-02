/**
 * The handful of provider calls agents make, each a thin fetch with the
 * connection's own token. Reads return trimmed text for the model; writes
 * return a DeliveryResult like publishing and email, so approvals, the run
 * report and integration health treat every outbound action the same way.
 */
import "server-only";
import type { DeliveryResult } from "@/lib/work/integrations";

const TIMEOUT_MS = 15_000;

export async function call(url: string, token: string, init: RequestInit = {}) {
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

export function failure(provider: string, status: number, data: Record<string, unknown>): string {
  const message =
    (data.error as { message?: string } | undefined)?.message ?? data.message ?? data.error ?? `status ${status}`;
  return `${provider} answered: ${String(message).slice(0, 200)}`;
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

// --- GitHub --------------------------------------------------------------------
//
// Reading and writing, through the GitHub App the owner installed on the
// repositories they chose. Writes arrive here only after the approval gate.
// Two limits hold whatever an agent is told: it never pushes straight to a
// repository's default branch (work lands on a branch, merged by its own
// approved action), and it never edits .github/workflows (the app is not
// granted that permission, since a workflow runs with the repository's secrets).

type GithubAction =
  | "list_repos"
  | "list_issues"
  | "get_issue"
  | "list_pulls"
  | "get_pull"
  | "list_branches"
  | "list_commits"
  | "get_checks"
  | "read_file"
  | "search_code";

const MAX_TEXT = 12_000;
const GITHUB = "https://api.github.com";

function githubApi(token: string) {
  return (path: string, init: RequestInit = {}) =>
    call(`${GITHUB}${path}`, token, { ...init, headers: { accept: "application/vnd.github+json", ...init.headers } });
}

/** "owner/name", from that or a github.com URL; null when it isn't one. */
export function repoName(value: string | undefined): string | null {
  const repo = value?.trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/+$/, "");
  return repo && /^[\w.-]+\/[\w.-]+$/.test(repo) && !repo.split("/").some((part) => /^\.+$/.test(part)) ? repo : null;
}

const clip = (text: string) => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n… (truncated)` : text);
const path = (value: string) => value.split("/").map(encodeURIComponent).join("/");

export async function readGithub(
  token: string,
  input: { action: GithubAction; repo?: string; path?: string; number?: number; query?: string; ref?: string },
): Promise<string> {
  const api = githubApi(token);
  const repo = repoName(input.repo);
  if (input.action !== "list_repos" && !repo) throw new Error('Name the repository as "owner/name".');
  const need = <T,>(value: T | undefined, what: string): T => {
    if (value === undefined || value === "") throw new Error(`Give the ${what}.`);
    return value;
  };
  const ok = async (request: Promise<{ ok: boolean; status: number; data: Record<string, unknown> }>) => {
    const result = await request;
    // GitHub answers 404 for a repository the app can't see as well as one that doesn't exist: never guess names.
    if (result.status === 404 && repo) {
      throw new Error(`GitHub can't find ${repo}, or it isn't shared with Desker. Call list_repos for the exact names - don't guess.`);
    }
    if (!result.ok) throw new Error(failure("GitHub", result.status, result.data));
    return result.data;
  };
  const ref = input.ref ? `?ref=${encodeURIComponent(input.ref)}` : "";

  switch (input.action) {
    case "list_repos": {
      // The connection holds a user token from the Desker GitHub App: the
      // repositories it reaches are those of each installation the owner can see.
      // (/installation/repositories takes an installation token and refuses this one.)
      const installs = await ok(api("/user/installations?per_page=100"));
      const installations = (installs.installations as Array<{ id: number }> | undefined) ?? [];
      if (installations.length === 0) {
        return "The Desker GitHub App isn't installed on any account yet. Tell the owner to open Integrations → GitHub → Connect and pick the repositories to share.";
      }
      type Repo = { full_name: string; description: string | null; default_branch: string; private: boolean };
      const pages = await Promise.all(
        installations.map((installation) => ok(api(`/user/installations/${installation.id}/repositories?per_page=100`))),
      );
      const repos = pages.flatMap((page) => (page.repositories as Repo[] | undefined) ?? []);
      return repos.length
        ? repos
            .map((r) => `- ${r.full_name}${r.private ? " (private)" : ""}, default branch ${r.default_branch}${r.description ? `: ${r.description}` : ""}`)
            .join("\n")
        : "The Desker GitHub App is installed, but no repositories are shared with it. Tell the owner to add some in the app's installation settings on GitHub.";
    }
    case "list_issues": {
      const issues = (await ok(api(`/repos/${repo}/issues?state=open&per_page=30`))) as unknown as Array<{ number: number; title: string; pull_request?: unknown; labels: { name: string }[] }>;
      return issues.length
        ? issues.map((i) => `- #${i.number}${i.pull_request ? " (PR)" : ""} ${i.title}${i.labels.length ? ` [${i.labels.map((l) => l.name).join(", ")}]` : ""}`).join("\n")
        : "No open issues.";
    }
    case "get_issue": {
      const number = need(input.number, "issue or pull request number");
      const [issue, comments] = await Promise.all([api(`/repos/${repo}/issues/${number}`), api(`/repos/${repo}/issues/${number}/comments?per_page=30`)]);
      if (!issue.ok) throw new Error(failure("GitHub", issue.status, issue.data));
      const thread = ((comments.data as unknown as Array<{ user: { login: string }; body: string }>) ?? []).map((c) => `@${c.user.login}: ${c.body}`).join("\n\n");
      return clip(`#${number} ${String(issue.data.title)} (${String(issue.data.state)})\n\n${String(issue.data.body ?? "")}\n\n${thread}`);
    }
    case "list_pulls": {
      const pulls = (await ok(api(`/repos/${repo}/pulls?state=open&per_page=30`))) as unknown as Array<{ number: number; title: string; head: { ref: string }; base: { ref: string }; draft: boolean; user: { login: string } }>;
      return pulls.length
        ? pulls.map((p) => `- #${p.number} ${p.title} (${p.head.ref} → ${p.base.ref}${p.draft ? ", draft" : ""}) by @${p.user.login}`).join("\n")
        : "No open pull requests.";
    }
    case "get_pull": {
      const number = need(input.number, "pull request number");
      const [pull, files, reviews] = await Promise.all([
        api(`/repos/${repo}/pulls/${number}`),
        api(`/repos/${repo}/pulls/${number}/files?per_page=100`),
        api(`/repos/${repo}/pulls/${number}/reviews?per_page=30`),
      ]);
      if (!pull.ok) throw new Error(failure("GitHub", pull.status, pull.data));
      const changed = ((files.data as unknown as Array<{ filename: string; status: string; additions: number; deletions: number; patch?: string }>) ?? [])
        .map((f) => `--- ${f.filename} (${f.status}, +${f.additions} -${f.deletions})\n${f.patch ?? "(binary or too large to show)"}`)
        .join("\n\n");
      const verdicts = ((reviews.data as unknown as Array<{ user: { login: string }; state: string; body: string }>) ?? [])
        .map((r) => `@${r.user.login}: ${r.state}${r.body ? ` - ${r.body}` : ""}`)
        .join("\n");
      const head = pull.data.head as { ref: string; sha: string };
      const base = pull.data.base as { ref: string };
      return clip(
        `#${number} ${String(pull.data.title)} (${String(pull.data.state)}${pull.data.merged ? ", merged" : ""}; ${head.ref} → ${base.ref}; head ${head.sha.slice(0, 7)})\n\n` +
          `${String(pull.data.body ?? "")}\n\nReviews:\n${verdicts || "none"}\n\nChanges:\n${changed}`,
      );
    }
    case "list_branches": {
      const branches = (await ok(api(`/repos/${repo}/branches?per_page=100`))) as unknown as Array<{ name: string; commit: { sha: string }; protected: boolean }>;
      return branches.map((b) => `- ${b.name} (${b.commit.sha.slice(0, 7)}${b.protected ? ", protected" : ""})`).join("\n") || "No branches.";
    }
    case "list_commits": {
      const commits = (await ok(api(`/repos/${repo}/commits?per_page=20${input.ref ? `&sha=${encodeURIComponent(input.ref)}` : ""}`))) as unknown as Array<{ sha: string; commit: { message: string; author: { name: string; date: string } } }>;
      return commits.map((c) => `- ${c.sha.slice(0, 7)} ${c.commit.message.split("\n")[0]} (${c.commit.author.name}, ${c.commit.author.date})`).join("\n") || "No commits.";
    }
    case "get_checks": {
      const target = need(input.ref, "branch, tag or commit to check");
      const data = await ok(api(`/repos/${repo}/commits/${encodeURIComponent(target)}/check-runs?per_page=50`));
      const runs = (data.check_runs as Array<{ name: string; status: string; conclusion: string | null; output?: { summary?: string } }> | undefined) ?? [];
      return runs.length
        ? runs.map((r) => `- ${r.name}: ${r.conclusion ?? r.status}${r.output?.summary ? ` - ${r.output.summary.slice(0, 300)}` : ""}`).join("\n")
        : "No checks have run on that yet.";
    }
    case "read_file": {
      const data = (await ok(api(`/repos/${repo}/contents/${path(need(input.path, "file path"))}${ref}`))) as unknown;
      if (Array.isArray(data)) {
        return (data as Array<{ path: string; type: string }>).map((entry) => `- ${entry.path}${entry.type === "dir" ? "/" : ""}`).join("\n");
      }
      return clip(Buffer.from(String((data as { content?: string }).content ?? ""), "base64").toString("utf8"));
    }
    case "search_code": {
      const data = await ok(api(`/search/code?per_page=20&q=${encodeURIComponent(`${need(input.query, "search")} repo:${repo}`)}`));
      const hits = (data.items as Array<{ path: string }> | undefined) ?? [];
      return hits.length ? hits.map((h) => `- ${h.path}`).join("\n") : "No matches.";
    }
  }
}

export type GithubWrite =
  | { action: "create_issue"; repo: string; title: string; body?: string; labels?: string[] }
  | { action: "comment"; repo: string; number: number; body: string }
  | { action: "update_issue"; repo: string; number: number; title?: string; body?: string; state?: "open" | "closed"; labels?: string[] }
  | {
      action: "commit_files";
      repo: string;
      branch: string;
      /** The branch to start from when `branch` does not exist yet; the default branch otherwise. */
      base?: string;
      message: string;
      files: { path: string; content?: string; delete?: boolean }[];
      /** Open a pull request for the branch in the same approved step. */
      pull_request?: { title: string; body?: string; draft?: boolean };
    }
  | { action: "open_pull_request"; repo: string; head: string; base?: string; title: string; body?: string; draft?: boolean }
  | { action: "review_pull_request"; repo: string; number: number; event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES"; body: string }
  | { action: "merge_pull_request"; repo: string; number: number; method?: "merge" | "squash" | "rebase" };

/** Paths an agent may never write: workflows run with the repository's secrets. */
export function forbiddenPath(file: string): boolean {
  const clean = file.replace(/^\/+/, "");
  return clean.startsWith(".github/workflows/") || clean.includes("..");
}

async function defaultBranch(api: ReturnType<typeof githubApi>, repo: string): Promise<string> {
  const info = await api(`/repos/${repo}`);
  if (!info.ok) throw new Error(failure("GitHub", info.status, info.data));
  return String(info.data.default_branch);
}

/** Carries out one approved write. Returns a DeliveryResult like every other outbound action. */
export async function writeGithub(token: string, input: GithubWrite): Promise<DeliveryResult> {
  const api = githubApi(token);
  const repo = repoName(input.repo);
  if (!repo) return { ok: false, status: 0, detail: 'The repository must be "owner/name".' };
  const done = (detail: string, status = 200): DeliveryResult => ({ ok: true, status, detail });
  const fail = (result: { status: number; data: Record<string, unknown> }): DeliveryResult => ({
    ok: false,
    status: result.status,
    detail: failure("GitHub", result.status, result.data),
  });
  const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

  try {
    switch (input.action) {
      case "create_issue": {
        const r = await api(`/repos/${repo}/issues`, json("POST", { title: input.title, body: input.body, labels: input.labels }));
        return r.ok ? done(`Opened issue #${r.data.number}: ${String(r.data.html_url)}`) : fail(r);
      }
      case "comment": {
        const r = await api(`/repos/${repo}/issues/${input.number}/comments`, json("POST", { body: input.body }));
        return r.ok ? done(`Commented on #${input.number}: ${String(r.data.html_url)}`) : fail(r);
      }
      case "update_issue": {
        const { title, body, state, labels } = input;
        const r = await api(`/repos/${repo}/issues/${input.number}`, json("PATCH", { title, body, state, labels }));
        return r.ok ? done(`Updated #${input.number}${state ? ` (${state})` : ""}`) : fail(r);
      }
      case "commit_files": {
        const main = await defaultBranch(api, repo);
        if (input.branch === main) {
          return { ok: false, status: 0, detail: `Nothing committed: agents never push straight to ${main}. Use a working branch and a pull request.` };
        }
        const bad = input.files.find((file) => forbiddenPath(file.path));
        if (bad) return { ok: false, status: 0, detail: `Nothing committed: ${bad.path} is off limits (workflow files run with your secrets).` };

        // The branch's head, creating the branch from its base when it is new.
        let head = await api(`/repos/${repo}/git/ref/heads/${path(input.branch)}`);
        if (head.status === 404) {
          const base = await api(`/repos/${repo}/git/ref/heads/${path(input.base ?? main)}`);
          if (!base.ok) return fail(base);
          const sha = (base.data.object as { sha: string }).sha;
          const created = await api(`/repos/${repo}/git/refs`, json("POST", { ref: `refs/heads/${input.branch}`, sha }));
          if (!created.ok) return fail(created);
          head = created;
        } else if (!head.ok) return fail(head);
        const parent = (head.data.object as { sha: string }).sha;
        const parentCommit = await api(`/repos/${repo}/git/commits/${parent}`);
        if (!parentCommit.ok) return fail(parentCommit);

        const tree = await api(
          `/repos/${repo}/git/trees`,
          json("POST", {
            base_tree: (parentCommit.data.tree as { sha: string }).sha,
            tree: input.files.map((file) =>
              file.delete
                ? { path: file.path, mode: "100644", type: "blob", sha: null }
                : { path: file.path, mode: "100644", type: "blob", content: file.content ?? "" },
            ),
          }),
        );
        if (!tree.ok) return fail(tree);
        const commit = await api(`/repos/${repo}/git/commits`, json("POST", { message: input.message, tree: tree.data.sha, parents: [parent] }));
        if (!commit.ok) return fail(commit);
        const moved = await api(`/repos/${repo}/git/refs/heads/${path(input.branch)}`, json("PATCH", { sha: commit.data.sha }));
        if (!moved.ok) return fail(moved);

        let detail = `Committed ${input.files.length} file${input.files.length === 1 ? "" : "s"} to ${input.branch} (${String(commit.data.sha).slice(0, 7)})`;
        if (input.pull_request) {
          const pull = await api(
            `/repos/${repo}/pulls`,
            json("POST", { title: input.pull_request.title, body: input.pull_request.body, head: input.branch, base: input.base ?? main, draft: input.pull_request.draft ?? false }),
          );
          if (!pull.ok) return { ...fail(pull), detail: `${detail}, but the pull request could not be opened: ${failure("GitHub", pull.status, pull.data)}` };
          detail += ` and opened pull request #${pull.data.number}: ${String(pull.data.html_url)}`;
        }
        return done(detail);
      }
      case "open_pull_request": {
        const main = await defaultBranch(api, repo);
        const r = await api(`/repos/${repo}/pulls`, json("POST", { title: input.title, body: input.body, head: input.head, base: input.base ?? main, draft: input.draft ?? false }));
        return r.ok ? done(`Opened pull request #${r.data.number}: ${String(r.data.html_url)}`) : fail(r);
      }
      case "review_pull_request": {
        const r = await api(`/repos/${repo}/pulls/${input.number}/reviews`, json("POST", { event: input.event, body: input.body }));
        return r.ok ? done(`Reviewed #${input.number}: ${input.event.toLowerCase().replace("_", " ")}`) : fail(r);
      }
      case "merge_pull_request": {
        const r = await api(`/repos/${repo}/pulls/${input.number}/merge`, json("PUT", { merge_method: input.method ?? "squash" }));
        return r.ok ? done(`Merged #${input.number} (${input.method ?? "squash"})`) : fail(r);
      }
    }
  } catch (error) {
    return { ok: false, status: 0, detail: `GitHub could not be reached: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}

/** Recent messages from a Slack channel (#name or id), newest first, as plain lines. */
export async function readSlackChannel(token: string, channel: string, limit = 20): Promise<string> {
  let id = channel;
  if (channel.startsWith("#")) {
    const list = await call("https://slack.com/api/conversations.list?limit=500&exclude_archived=true", token);
    const found = ((list.data.channels as Array<{ id: string; name: string }> | undefined) ?? []).find((c) => c.name === channel.slice(1));
    if (!found) throw new Error(`Slack has no channel ${channel} that the Desker app can see - invite it there first.`);
    id = found.id;
  }
  const { ok, status, data } = await call(`https://slack.com/api/conversations.history?channel=${encodeURIComponent(id)}&limit=${limit}`, token);
  if (!ok) throw new Error(failure("Slack", status, data) + (data.error === "missing_scope" ? " - reconnect Slack to allow reading" : data.error === "not_in_channel" ? " - invite the Desker app to that channel first" : ""));
  const messages = (data.messages as Array<{ ts: string; user?: string; text?: string }> | undefined) ?? [];
  return messages.map((m) => `${new Date(Number(m.ts) * 1000).toISOString().slice(0, 16)} ${m.user ?? "bot"}: ${(m.text ?? "").slice(0, 400)}`).join("\n") || "No recent messages.";
}
