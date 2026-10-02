import { expect, test } from "@playwright/test";
import { ANONYMOUS, currentProjectSlug, signUp, uniqueAdmin } from "./helpers";

/**
 * The acceptance path: someone signs up, builds an assistant from a role,
 * uploads a document and switches it on.
 */
test.describe.configure({ mode: "serial" });

let project: string;
let agentUrl: string;

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

test("the wizard creates an agent from a role template", async ({ page }) => {
  project = await currentProjectSlug(page);
  await page.goto(`/p/${project}/agents/new`);

  // Step 1 - pick a role. Nothing else is possible until one is chosen.
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByRole("button", { name: /^Money\b/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2 - the role brings the job and team; the name is the admin's own.
  await expect(page.getByLabel("Job title")).toHaveValue("Money Manager");
  await page.getByLabel("Name").fill("Penny");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3 - personality is required and comes with the role.
  await expect(page.getByLabel("Personality and tone")).not.toHaveValue("");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4 - answering from context documents is on by default, and the
  // role's work tools are ticked.
  await expect(page.getByLabel("Answer from context documents")).toBeChecked();
  await expect(page.getByLabel("Search context documents")).toBeChecked();
  await expect(page.getByLabel("Send an email")).not.toBeChecked();
  await page.getByRole("button", { name: "Create agent" }).click();

  await expect(page).toHaveURL(/\/p\/[^/]+\/agents\/[^/]+\?onboarding=1/, {
    timeout: 30_000,
  });
  agentUrl = page.url().split("?")[0]!;

  await expect(page.getByText(/Penny is created/)).toBeVisible();
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

test("switching an assistant on", async ({ page }) => {
  await page.goto(agentUrl);
  await page.getByRole("button", { name: "Switch on", exact: true }).click();
  await expect(page.getByText(/is on/)).toBeVisible({ timeout: 20_000 });
});
