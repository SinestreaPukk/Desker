import { expect, test } from "@playwright/test";
import { ANONYMOUS, currentProjectSlug, hasModelKey, signUp, uniqueAdmin } from "./helpers";

/**
 * The acceptance path from the build brief: an admin signs up, builds an agent,
 * uploads context, publishes, a client chats on the public link, and the
 * conversation plus anything the agent logged shows up in the admin inbox.
 */
test.describe.configure({ mode: "serial" });

let project: string;
let agentUrl: string;
let publicChatUrl: string;

test.describe("signing up", () => {
  // This block must not inherit the shared signed-in session.
  test.use({ storageState: ANONYMOUS });

  test("an admin signs up and lands inside a project", async ({ page }) => {
    await signUp(page, uniqueAdmin());
    // Asserted on things that exist at every width: the sidebar is behind a
    // menu button on a phone, so it is not the proof to reach for here.
    await expect(page).toHaveURL(/\/p\/[^/]+\/roster/);
    // A brand-new organisation gets the guided first run, not an empty grid.
    await expect(page.getByRole("link", { name: "Hire your first agent" })).toBeVisible();
  });
});

test("the wizard creates an agent in three steps", async ({ page }) => {
  project = await currentProjectSlug(page);
  await page.goto(`/p/${project}/agents/new`);

  // Step 1 - a starter pre-fills the form.
  await page.getByRole("button", { name: /Customer support/ }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Mia");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2 - personality is required; the starter also brings an escalation rule.
  await expect(page.getByLabel("Personality and tone")).not.toHaveValue("");
  await expect(page.getByLabel("Escalation rule")).not.toHaveValue("");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3 - answering from context documents is on by default.
  await expect(page.getByLabel("Answer from context documents")).toBeChecked();
  await page.getByRole("button", { name: "Create agent" }).click();

  await expect(page).toHaveURL(/\/p\/[^/]+\/agents\/[^/]+\?onboarding=1/, {
    timeout: 30_000,
  });
  agentUrl = page.url().split("?")[0]!;
  publicChatUrl = `/c/${agentUrl.split("/").pop()}`;

  await expect(page.getByText(/Mia is created/)).toBeVisible();
});

test("uploading a document indexes it and retrieval finds it", async ({ page }) => {
  await page.goto(agentUrl);
  // The editor is sectioned; documents live under Knowledge.
  await page.getByRole("button", { name: "Knowledge" }).click();

  await page.setInputFiles('input[type="file"][accept*=".pdf"]', {
    name: "returns-policy.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Returns Policy\n\n## Return window\nUnused items may be returned within " +
        "30 days of delivery for a full refund. Items returned between 31 and 60 " +
        "days receive store credit only.\n\n## Restocking fee\nA 15% restocking " +
        "fee applies to opened electronics returned after 14 days.\n",
    ),
  });

  // Ingestion is asynchronous; the row polls from Processing to Ready.
  await expect(page.getByText("returns-policy.md").first()).toBeVisible();
  await expect(page.getByText("Ready")).toBeVisible({ timeout: 30_000 });

  // The retrieval inspector must find the passage the agent will search for.
  await page.getByLabel("Retrieval test query").fill("how long to return an item");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText(/result\(s\)/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/30 days/).first()).toBeVisible();
});

test("an unpublished agent is not reachable by a client", async ({ page }) => {
  const response = await page.goto(publicChatUrl);
  expect(response?.status()).toBe(404);
});

test("publishing makes the public chat link work", async ({ page }) => {
  await page.goto(agentUrl);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText(/is live/)).toBeVisible({ timeout: 20_000 });

  const response = await page.goto(publicChatUrl);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Mia" })).toBeVisible();
});

test("a client gets a streamed, grounded reply and it lands in the inbox", async ({
  page,
}) => {
  test.skip(!hasModelKey, "ANTHROPIC_API_KEY is not set");

  await page.goto(publicChatUrl);
  await page.getByRole("textbox", { name: "Message" }).fill("How many days do I have to return an item?");
  await page.getByRole("button", { name: "Send message" }).click();

  // The agent should search the uploaded policy, then answer from it.
  await expect(page.getByText("Searching company documents")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/30/).first()).toBeVisible({ timeout: 60_000 });

  await page.goto(`/p/${project}/inbox`);
  await expect(page.getByRole("heading", { name: "Mia" }).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("a reported bug becomes an issue on the dashboard", async ({ page }) => {
  test.skip(!hasModelKey, "ANTHROPIC_API_KEY is not set");

  await page.goto(publicChatUrl);
  await page
    .getByRole("textbox", { name: "Message" })
    .fill(
      "Your checkout page throws a 500 error every time I click Pay. I have tried " +
        "three times in Chrome and it fails every time.",
    );
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByText("Issue logged")).toBeVisible({ timeout: 60_000 });

  await page.goto(`/p/${project}/inbox`);
  await page.getByRole("tab", { name: /Issues/ }).click();
  await expect(page.getByText("Issue", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });

  // And it can be resolved from here.
  await page.getByRole("button", { name: "Resolve" }).first().click();
  await expect(page.getByRole("button", { name: "Reopen" }).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("a second project has its own roster, inbox and insights", async ({ page }) => {
  const first = await currentProjectSlug(page);

  const created = await page.request.post("/api/projects", {
    data: { name: `Second ${Date.now()}` },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const second = (await created.json()) as { slug: string };

  // An agent in the new project, and one already exists in the first.
  const agent = await page.request.post(`/api/agents?project=${second.slug}`, {
    data: {
      name: "Iris",
      jobTitle: "Field Support",
      personality: "Calm and precise in every reply.",
      responsibilities: ["Answer hardware questions"],
      allowedTools: [],
      status: "published",
    },
  });
  expect(agent.ok(), await agent.text()).toBe(true);

  await page.goto(`/p/${second.slug}/roster`);
  await expect(page.getByRole("heading", { name: "Iris" })).toBeVisible();
  // toHaveCount(0) rather than toBeHidden: the assertion is "none of the other
  // project's agents are here", and a count is both the precise claim and safe
  // when earlier runs have left more than one agent sharing a name.
  await expect(page.getByRole("heading", { name: "Mia" })).toHaveCount(0);

  await page.goto(`/p/${first}/roster`);
  await expect(page.getByRole("heading", { name: "Mia" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Iris" })).toHaveCount(0);
});

test("switching project keeps you on the same tab", async ({ page }) => {
  const first = await currentProjectSlug(page);
  const projects = await (await page.request.get("/api/projects")).json();
  const other = projects.find((p: { slug: string }) => p.slug !== first);
  test.skip(!other, "needs a second project");

  await page.goto(`/p/${first}/insights`);

  // The sidebar is behind a menu button below the lg breakpoint, so the
  // switcher has to be revealed before it can be clicked.
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();

  await page.getByRole("button", { name: /Switch project/ }).click();
  await page.getByRole("menuitem", { name: other.name }).click();

  // Comparing the same view across projects is the reason to switch at all,
  // so the switcher must not dump you back on the roster.
  await expect(page).toHaveURL(new RegExp(`/p/${other.slug}/insights`), {
    timeout: 20_000,
  });
});
