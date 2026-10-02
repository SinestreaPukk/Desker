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
  { id: "tasks", label: "Reminders & to-do" },
  { id: "phone", label: "Phone & texts" },
  { id: "code", label: "Code & issues" },
  { id: "social", label: "Social media" },
  { id: "publishing", label: "Publishing & email" },
  { id: "money", label: "Money" },
] as const;
type ConnectorCategory = (typeof CONNECTOR_CATEGORIES)[number]["id"];

/** How an owner connects it. OAuth wherever the provider offers it. */
type ConnectorAuth = "oauth" | "api_key" | "webhook" | "link";

/** The OAuth providers this server can talk to; each needs its client id and secret set. */
export const OAUTH_PROVIDERS = ["google", "microsoft", "slack", "github", "linkedin", "meta", "x", "threads"] as const;
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
  /** The OAuth scopes this connector asks for; the provider's default when absent. */
  scope?: string;
  status: "available" | "planned";
  /** One line: what connecting it lets an agent do. */
  pitch: string;
  can: string[];
  cannot: string[];
  /** The work tools that use it, for the hire wizard and graceful-degradation copy. */
  tools?: string[];
}

export const CONNECTORS: readonly Connector[] = [
  // --- calendar & messaging: the Personal Assistant's biggest gap ----------
  {
    id: "google_calendar",
    name: "Google Calendar",
    category: "calendar",
    roles: ["personal-assistant", "money-manager", "career-coach", "travel-planner", "learning-coach", "fitness-coach"],
    auth: "oauth",
    oauthProvider: "google",
    scope: "openid email https://www.googleapis.com/auth/calendar.events",
    status: "available",
    pitch: "See what is on your calendar, propose meetings and move them - checking for clashes first.",
    can: [
      "See events on your calendar",
      "Create events and move them - each change waits for your approval first",
      "Warn when a time clashes with something already booked",
    ],
    cannot: ["Read your email or files", "Delete events or calendars", "Change your account settings"],
    tools: ["calendar_list_events", "calendar_create_event", "calendar_reschedule", "calendar_cancel_event"],
  },
  {
    id: "gmail",
    name: "Gmail",
    category: "calendar",
    roles: ["personal-assistant", "career-coach"],
    auth: "oauth",
    oauthProvider: "google",
    scope: "openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose",
    status: "available",
    pitch: "Read your inbox and draft replies in the real thread - you see the draft in Gmail, and it sends only when you approve.",
    can: [
      "Read your inbox and whole threads",
      "Write a reply as a draft in the thread, in your own Gmail",
      "Send that reply after you approve it",
    ],
    cannot: ["Delete, archive or label email", "Send anything without your approval in draft-only mode", "Change your Gmail settings"],
    tools: ["inbox_read", "inbox_reply"],
  },
  {
    id: "outlook_mail",
    name: "Outlook mail",
    category: "calendar",
    roles: ["personal-assistant", "career-coach"],
    auth: "oauth",
    oauthProvider: "microsoft",
    scope: "offline_access openid email User.Read Mail.ReadWrite Mail.Send",
    status: "available",
    pitch: "The same as Gmail, for Microsoft 365 and Outlook.com: read your inbox, draft replies in the thread, send when you approve.",
    can: [
      "Read your inbox and messages",
      "Write a reply as a draft in the thread, in your own Outlook",
      "Send that reply after you approve it",
    ],
    cannot: ["Delete or move email", "Send anything without your approval in draft-only mode", "Change your mailbox settings"],
    tools: ["inbox_read", "inbox_reply"],
  },
  {
    id: "slack",
    name: "Slack",
    category: "calendar",
    roles: [],
    auth: "oauth",
    oauthProvider: "slack",
    status: "available",
    pitch: "Read and post in the channels you choose.",
    can: [
      "Read recent messages in channels you invite the Desker app to",
      "Post messages as the Desker app - each one waits for your approval first",
    ],
    cannot: ["Read channels the app was not invited to", "Join channels on its own", "Manage members or settings"],
    tools: ["slack_read", "slack_post_message"],
  },
  {
    id: "google_tasks",
    name: "Google Tasks",
    category: "tasks",
    roles: ["personal-assistant", "money-manager", "career-coach", "learning-coach", "fitness-coach"],
    auth: "oauth",
    oauthProvider: "google",
    scope: "openid email https://www.googleapis.com/auth/tasks",
    status: "available",
    pitch: "Your own to-do list: Desker reads it into your plan and adds reminders to it, so they reach your phone.",
    can: ["Read your open tasks and due dates", "Add a reminder or mark a task done once you approve it"],
    cannot: ["Delete tasks or lists", "Change anything without your approval in draft-only mode"],
    tools: ["tasks_read", "tasks_write"],
  },
  {
    id: "microsoft_todo",
    name: "Microsoft To Do",
    category: "tasks",
    roles: ["personal-assistant", "money-manager", "career-coach", "learning-coach", "fitness-coach"],
    auth: "oauth",
    oauthProvider: "microsoft",
    scope: "offline_access openid email User.Read Tasks.ReadWrite",
    status: "available",
    pitch: "Your own to-do list: Desker reads it into your plan and adds reminders to it, so they reach your phone.",
    can: ["Read your open tasks and due dates", "Add a reminder or mark a task done once you approve it"],
    cannot: ["Delete tasks or lists", "Change anything without your approval in draft-only mode"],
    tools: ["tasks_read", "tasks_write"],
  },
  {
    id: "phone",
    name: "Phone & texts (Twilio)",
    category: "phone",
    roles: ["personal-assistant", "travel-planner"],
    auth: "api_key",
    status: "available",
    pitch: "A number of your own: Desker screens calls for you, reads your texts, and texts or calls when you approve it.",
    can: [
      "Screen incoming calls: the caller says who they are and why, and you get it as a message",
      "Read texts the number received",
      "Send a text, or place a call that reads a message aloud, once you approve it",
    ],
    cannot: [
      "Hold a two-way conversation on a call",
      "Record or keep call audio (only the transcript of the screening is kept)",
      "Text or call without your approval in draft-only mode",
    ],
    tools: ["phone_read", "phone_send"],
  },
  {
    id: "outlook_calendar",
    name: "Outlook Calendar",
    category: "calendar",
    roles: ["personal-assistant", "money-manager", "career-coach", "travel-planner", "learning-coach", "fitness-coach"],
    auth: "oauth",
    oauthProvider: "microsoft",
    scope: "offline_access openid email User.Read Calendars.ReadWrite",
    status: "available",
    pitch: "The same calendar access as Google Calendar, for Microsoft 365 and Outlook.com.",
    can: [
      "See events on your calendar",
      "Create events and move them - each change waits for your approval first",
      "Warn when a time clashes with something already booked",
    ],
    cannot: ["Read your mailbox or files", "Delete events or calendars"],
    tools: ["calendar_list_events", "calendar_create_event", "calendar_reschedule", "calendar_cancel_event"],
  },

  // --- money: the Money Manager's live numbers -----------------------------
  {
    id: "bank",
    name: "Bank accounts",
    category: "money",
    roles: ["money-manager"],
    auth: "link",
    status: "available",
    pitch: "Sandbox test version - connects Plaid's fake test banks only, not real accounts yet. Reads balances, transactions and interest rates, no CSV uploads.",
    can: ["Read balances, recent transactions and card or loan interest rates", "Add up spending, subscriptions and bills exactly"],
    cannot: ["Move money or make payments", "See full account numbers (only the last four digits)"],
    tools: ["review_spending"],
  },

  // --- code & issues: for anyone who ships code ----------
  {
    id: "github",
    name: "GitHub",
    category: "code",
    roles: [],
    auth: "oauth",
    oauthProvider: "github",
    status: "available",
    pitch: "Read, fix and ship code in the repositories you pick - every change waits for your approval.",
    can: [
      "Read code, branches, commits, checks, issues and pull requests",
      "Commit to a working branch and open a pull request",
      "Review and merge pull requests, open and close issues",
    ],
    cannot: [
      "Push straight to your default branch",
      "Touch workflow files (.github/workflows)",
      "See repositories you did not choose",
      "Change settings, secrets or members",
    ],
    tools: ["github_read", "github_write"],
  },

  // --- social media: post, edit and read where each platform allows it -------
  // Publishing goes through publish_post: a draft for a connected platform is
  // posted straight to it once approved, otherwise to the publishing webhook.
  {
    id: "linkedin",
    name: "LinkedIn",
    category: "social",
    roles: ["social-media-manager", "career-coach"],
    auth: "oauth",
    oauthProvider: "linkedin",
    status: "available",
    pitch: "Post to your own LinkedIn profile - for your business or your career - and edit or delete those posts, each one after you approve it.",
    can: ["Post text to your profile once you approve it", "Edit or delete posts Desker made", "Show the posts it has made"],
    cannot: [
      "Read your feed, messages or connections",
      "Post to a company page (needs LinkedIn's partner review)",
      "Post or change anything without your approval in draft-only mode",
    ],
    tools: ["social_read", "social_manage"],
  },
  {
    id: "meta",
    name: "Facebook & Instagram",
    category: "social",
    roles: ["social-media-manager"],
    auth: "oauth",
    oauthProvider: "meta",
    status: "available",
    pitch: "Post to the Facebook Pages and Instagram accounts you choose, read their posts and comments, and edit Facebook posts. For yourself or your business.",
    can: [
      "Post to your Facebook Page, and to Instagram with an image, once you approve it",
      "Read recent posts, likes and comments",
      "Read your Instagram direct messages (read-only; reconnect once to allow it)",
      "Watch competitors' public Instagram accounts, trending hashtags and your own daily numbers",
      "Edit or delete Facebook posts",
    ],
    cannot: [
      "Edit or delete Instagram posts (Instagram doesn't allow it)",
      "Post to a personal Facebook profile or groups (Facebook allows Pages only)",
      "Reply to or send direct messages",
      "Use a personal Instagram account - switch it to a free Creator or Business account in Instagram's settings first",
      "Read competitors' personal Instagram accounts or Facebook Pages (Meta doesn't allow it)",
      "Post or change anything without your approval in draft-only mode",
    ],
    tools: ["social_read", "social_manage"],
  },
  {
    id: "x",
    name: "X (Twitter)",
    category: "social",
    roles: ["social-media-manager"],
    auth: "oauth",
    oauthProvider: "x",
    scope: "tweet.read tweet.write users.read offline.access",
    status: "available",
    pitch: "Post to your X account, and delete posts - each one after you approve it.",
    can: ["Post once you approve it", "Delete posts", "Read your recent posts (needs X's paid API plan)"],
    cannot: [
      "Edit a post (X's API doesn't allow it)",
      "Read your timeline or messages",
      "Post or delete anything without your approval in draft-only mode",
    ],
    tools: ["social_read", "social_manage"],
  },
  {
    id: "threads",
    name: "Threads",
    category: "social",
    roles: ["social-media-manager"],
    auth: "oauth",
    oauthProvider: "threads",
    status: "available",
    pitch: "Post to your Threads profile and read the replies - each post after you approve it.",
    can: ["Post text once you approve it", "Read your recent posts and their replies"],
    cannot: [
      "Edit or delete a post from Desker",
      "Read your feed or messages",
      "Post without your approval in draft-only mode",
    ],
    tools: ["social_read", "social_manage"],
  },

  // --- publishing & email: what a social media manager already uses -----------
  {
    id: "webhook",
    name: "Publish posts",
    category: "publishing",
    roles: ["social-media-manager"],
    auth: "webhook",
    status: "available",
    pitch: "For anywhere Desker doesn't connect to directly - your CMS, a newsletter tool, another network: each post you approve goes to a webhook, and a Zapier or Make zap (or your own code) publishes it.",
    can: ["Send the posts you approve, with title, text and platform, to the address you give it", "Sign each delivery so your endpoint can check it came from Desker"],
    cannot: [
      "Post by itself - a zap or your code does the posting (connect LinkedIn, Facebook & Instagram, X or Threads above to post directly)",
      "Attach images or schedule for a later time",
      "See replies, likes or reach afterwards",
      "Post without your approval in draft-only mode",
    ],
    tools: ["publish_post"],
  },
  {
    id: "email",
    name: "Send email (Resend)",
    category: "publishing",
    roles: ["personal-assistant", "career-coach"],
    auth: "api_key",
    status: "available",
    pitch: "Send the emails you approve from your own domain.",
    can: ["Send emails you approve, from an address on your verified domain"],
    cannot: ["Read your inbox", "Send without your approval in draft-only mode"],
    tools: ["send_email"],
  },
];

export function connectorById(id: string): Connector | undefined {
  return CONNECTORS.find((connector) => connector.id === id);
}

/** The connector a work tool depends on, for "connect X to let it do this" copy. */
/** Every available connector that can serve a tool: mail and calendar each have a Google and a Microsoft one. */
export function connectorsForTool(tool: string): Connector[] {
  return CONNECTORS.filter((connector) => connector.status === "available" && connector.tools?.includes(tool));
}

/** The name of the choice a tool needs, e.g. "Gmail or Outlook mail". */
export function connectorChoice(connectors: Connector[]): string {
  return connectors.map((connector) => connector.name).join(" or ");
}
