/**
 * Every connector the product knows about, in one list: what it is for, which
 * roles need it, how it connects, and - in plain words - what it can and
 * cannot do once connected.
 *
 * No server imports: the Integrations page, the hire wizard and the runner all
 * read the same entries, so the promise on the card is the permission asked
 * for. `status: "planned"` connectors are listed honestly as coming, so a role
 * template can point at them without pretending they work.
 */

export const CONNECTOR_CATEGORIES = [
  { id: "calendar", label: "Calendar & messaging" },
  { id: "code", label: "Code & issues" },
  { id: "publishing", label: "Publishing & email" },
  { id: "crm", label: "Customers & sales" },
  { id: "hr", label: "People & HR" },
] as const;
type ConnectorCategory = (typeof CONNECTOR_CATEGORIES)[number]["id"];

/** How an owner connects it. OAuth wherever the provider offers it. */
type ConnectorAuth = "oauth" | "api_key" | "webhook";

/** The OAuth providers this server can talk to; each needs its client id and secret set. */
export const OAUTH_PROVIDERS = ["google", "slack", "github"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export interface Connector {
  /** Stored as Integration.type once connected. */
  id: string;
  name: string;
  category: ConnectorCategory;
  /** Role template ids this connector makes more useful. */
  roles: string[];
  auth: ConnectorAuth;
  oauthProvider?: OAuthProvider;
  status: "available" | "planned";
  /** One line: what connecting it lets an agent do. */
  pitch: string;
  can: string[];
  cannot: string[];
  /** The work tools that use it, for the hire wizard and graceful-degradation copy. */
  tools?: string[];
}

export const CONNECTORS: readonly Connector[] = [
  // --- calendar & messaging: the Executive Assistant's biggest gap ----------
  {
    id: "google_calendar",
    name: "Google Calendar",
    category: "calendar",
    roles: ["secretary", "client-onboarding", "sales-development", "personal-assistant", "money-manager", "career-coach", "travel-planner", "learning-coach"],
    auth: "oauth",
    oauthProvider: "google",
    status: "available",
    pitch: "See what is on your calendar and propose meetings.",
    can: ["See events on your calendars", "Create events - each one waits for your approval first"],
    cannot: ["Read your email or files", "Change your account settings", "Delete calendars"],
    tools: ["calendar_list_events", "calendar_create_event"],
  },
  {
    id: "slack",
    name: "Slack",
    category: "calendar",
    roles: ["secretary", "dev-support", "people-ops", "customer-support", "researcher"],
    auth: "oauth",
    oauthProvider: "slack",
    status: "available",
    pitch: "Post updates to the channels you choose.",
    can: [
      "Post messages as the Desker app - each one waits for your approval first",
      "Only in channels you invite the Desker app to",
    ],
    cannot: ["Read your messages or DMs", "Join channels on its own", "Manage members or settings"],
    tools: ["slack_post_message"],
  },
  {
    id: "outlook_calendar",
    name: "Outlook Calendar",
    category: "calendar",
    roles: ["secretary", "personal-assistant"],
    auth: "oauth",
    status: "planned",
    pitch: "The same calendar access as Google Calendar, for Microsoft 365.",
    can: ["See events", "Create events with your approval"],
    cannot: ["Read your mailbox or files"],
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    category: "calendar",
    roles: ["secretary", "people-ops"],
    auth: "oauth",
    status: "planned",
    pitch: "Post updates to Teams channels.",
    can: ["Post to channels you choose, with your approval"],
    cannot: ["Read chats or meetings"],
  },

  // --- code & issues: the Developer Support Engineer's biggest gap ----------
  {
    id: "github",
    name: "GitHub",
    category: "code",
    roles: ["dev-support"],
    auth: "oauth",
    oauthProvider: "github",
    status: "available",
    pitch: "Read code and issues in the repositories you pick.",
    can: ["Read code in the repositories you choose", "Read issues and pull requests in them"],
    cannot: [
      "Push code, open or merge pull requests",
      "See repositories you did not choose",
      "Change settings or members",
    ],
    tools: ["github_read"],
  },
  {
    id: "gitlab",
    name: "GitLab",
    category: "code",
    roles: ["dev-support"],
    auth: "oauth",
    status: "planned",
    pitch: "Read-only access to chosen projects.",
    can: ["Read code and issues"],
    cannot: ["Push or merge"],
  },
  {
    id: "linear",
    name: "Linear",
    category: "code",
    roles: ["dev-support"],
    auth: "oauth",
    status: "planned",
    pitch: "Read and file issues.",
    can: ["Read issues", "File issues with your approval"],
    cannot: ["Delete or reassign issues"],
  },
  {
    id: "jira",
    name: "Jira",
    category: "code",
    roles: ["dev-support"],
    auth: "oauth",
    status: "planned",
    pitch: "Read and file issues.",
    can: ["Read issues", "File issues with your approval"],
    cannot: ["Change workflows or permissions"],
  },

  // --- publishing & email: what the Content Marketer already uses -----------
  {
    id: "webhook",
    name: "Publish posts",
    category: "publishing",
    roles: ["marketer", "social-media-manager"],
    auth: "webhook",
    status: "available",
    pitch: "Send approved posts to LinkedIn, X, Instagram, YouTube or your CMS, through Zapier, Make or your own endpoint.",
    can: ["Send the posts you approve to the address you give it"],
    cannot: ["Read anything back", "Post without your approval in draft-only mode"],
    tools: ["publish_post"],
  },
  {
    id: "email",
    name: "Send email (Resend)",
    category: "publishing",
    roles: ["marketer", "secretary", "client-onboarding", "sales-development", "people-ops", "personal-assistant", "career-coach"],
    auth: "api_key",
    status: "available",
    pitch: "Send the emails you approve from your own domain.",
    can: ["Send emails you approve, from an address on your verified domain"],
    cannot: ["Read your inbox", "Send without your approval in draft-only mode"],
    tools: ["send_email"],
  },

  // --- customers & sales ------------------------------------------------------
  {
    id: "hubspot",
    name: "HubSpot",
    category: "crm",
    roles: ["sales-development", "customer-support"],
    auth: "oauth",
    status: "planned",
    pitch: "Look up contacts and deals, and log activity.",
    can: ["Read contacts and deals", "Log notes with your approval"],
    cannot: ["Delete records", "Change pipelines or users"],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    category: "crm",
    roles: ["sales-development"],
    auth: "oauth",
    status: "planned",
    pitch: "Look up accounts and opportunities.",
    can: ["Read accounts and opportunities"],
    cannot: ["Delete records or change configuration"],
  },
  {
    id: "intercom",
    name: "Intercom",
    category: "crm",
    roles: ["customer-support", "sales-development"],
    auth: "oauth",
    status: "planned",
    pitch: "Answer customers in the channel they already use.",
    can: ["Read and reply to conversations assigned to the agent"],
    cannot: ["Change workspace settings"],
  },

  // --- people & HR ------------------------------------------------------------
  {
    id: "bamboohr",
    name: "BambooHR",
    category: "hr",
    roles: ["people-ops"],
    auth: "api_key",
    status: "planned",
    pitch: "Look up the employee directory and time off.",
    can: ["Read the directory and time-off calendar"],
    cannot: ["See salaries or change records"],
  },
  {
    id: "rippling",
    name: "Rippling",
    category: "hr",
    roles: ["people-ops"],
    auth: "oauth",
    status: "planned",
    pitch: "Look up people and onboarding tasks.",
    can: ["Read the directory"],
    cannot: ["Run payroll or change records"],
  },
  {
    id: "gusto",
    name: "Gusto",
    category: "hr",
    roles: ["people-ops"],
    auth: "oauth",
    status: "planned",
    pitch: "Look up people and time off.",
    can: ["Read the directory"],
    cannot: ["Run payroll or change records"],
  },
];

export function connectorById(id: string): Connector | undefined {
  return CONNECTORS.find((connector) => connector.id === id);
}

/** The connector a work tool depends on, for "connect X to let it do this" copy. */
export function connectorForTool(tool: string): Connector | undefined {
  return CONNECTORS.find((connector) => connector.tools?.includes(tool));
}
