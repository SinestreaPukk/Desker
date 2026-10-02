/**
 * What the tour says: first how to get set up - where to press, in order -
 * then what is different about Desker and one thing worth trying for each.
 * One list per kind of space. Every drawing marks the real control's place
 * and name, so the owner can find it when the tour is closed.
 */
import { Flow, Mark, MiniButton, MiniCard, MiniLines, MiniScreen } from "./infographic";

export interface TourStep {
  title: string;
  body: string;
  drawing: React.ReactNode;
  callouts: string[];
}

export interface TourFeature {
  title: string;
  body: string;
  drawing: React.ReactNode;
  tryThis: string;
  action: { label: string; href: (project: string) => string };
}

const NAV = ["Needs you", "Roster", "Chat", "Work", "Workflows", "Insights", "Alerts", "Integrations", "Your space", "Audit log"];

function Approval({ label, title, marks = [1, 2, 3] }: { label: string; title: string; marks?: [number, number, number] | number[] }) {
  return (
    <MiniCard>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="text-xs font-semibold text-ink">{title}</p>
      <MiniLines count={3} />
      <div className="flex flex-wrap gap-2 pt-1">
        <MiniButton label="Approve" variant="primary" mark={marks[0]} />
        <MiniButton label="Edit first" mark={marks[1]} />
        <MiniButton label="Reject" variant="ghost" mark={marks[2]} />
      </div>
    </MiniCard>
  );
}

function CanCannot({ can, cannot, mark }: { can: string[]; cannot: string[]; mark?: number }) {
  return (
    <MiniCard className="bg-accent-soft/40">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-ink">What it does on its own</p>
        {mark ? <Mark n={mark} /> : null}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="space-y-0.5">
          <p className="font-semibold text-ink">It can</p>
          {can.map((line) => (
            <p key={line} className="text-ink-muted">✓ {line}</p>
          ))}
        </div>
        <div className="space-y-0.5">
          <p className="font-semibold text-ink">It can&apos;t</p>
          {cannot.map((line) => (
            <p key={line} className="text-ink-muted">✕ {line}</p>
          ))}
        </div>
      </div>
    </MiniCard>
  );
}

// --- personal ---------------------------------------------------------------

const SETUP: TourStep[] = [
  {
    title: "Your space, at a glance",
    body: "Everything lives in the sidebar. This space is private to you - nobody else can be invited in.",
    drawing: (
      <MiniScreen nav={NAV} active="Needs you" marks={{ "Needs you": 1, Roster: 2, Chat: 3, "Your space": 4 }}>
        <MiniCard title="Needs you">
          <MiniLines count={2} />
        </MiniCard>
      </MiniScreen>
    ),
    callouts: [
      "Needs you - anything waiting for your yes, like a calendar change.",
      "Roster - your assistants. Open one to see and change what it does.",
      "Chat - talk to an assistant directly, any time.",
      "Your space - download or delete everything in it.",
    ],
  },
  {
    title: "Watch one week get planned",
    body: "Your first run shows a week being planned from a calendar, on example data, before you connect anything.",
    drawing: (
      <MiniScreen nav={NAV}>
        <p className="text-xs font-semibold text-ink">Review your week and draft a plan</p>
        <MiniCard>
          <MiniLines count={2} />
          <div className="flex justify-end">
            <MiniButton label="Next step" variant="primary" mark={1} />
          </div>
        </MiniCard>
        <Approval label="Needs you · calendar change" title="Move Gym from Wed 18:00 to Fri 18:00" marks={[2, 0, 0]} />
        <MiniButton label="Set it up with your own calendar" variant="primary" mark={3} />
      </MiniScreen>
    ),
    callouts: [
      "Press Next step to watch each part.",
      "Decide on the suggested change yourself. Nothing changes.",
      "Then press Set it up with your own calendar.",
    ],
  },
  {
    title: "Connect your calendar, then four answers",
    body: "The plan is built from your calendar. It only asks for the calendar, and you can disconnect it any time.",
    drawing: (
      <MiniScreen nav={NAV}>
        <MiniCard title="1 · Connect your calendar">
          <MiniButton label="Connect Google Calendar" variant="primary" mark={1} />
        </MiniCard>
        <MiniCard title="2 · Tell it about you">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <MiniLines count={3} />
            </div>
            <Mark n={2} />
          </div>
        </MiniCard>
      </MiniScreen>
    ),
    callouts: [
      "Press Connect Google Calendar and sign in with Google.",
      "Four short answers: who you are, what you want help with, how to talk to you, and your limits.",
    ],
  },
  {
    title: "See its limits, then plan your week",
    body: "Before it runs, you see what it can and can't do. Then it plans this week - and every Sunday after.",
    drawing: (
      <MiniScreen nav={NAV}>
        <CanCannot
          can={["Check your calendar", "Move events, once you approve"]}
          cannot={["Change your calendar without you", "Pay, sign or agree to anything"]}
          mark={1}
        />
        <MiniButton label="Plan my week" variant="primary" mark={2} />
      </MiniScreen>
    ),
    callouts: ["Read what it can and can't do.", "Press Plan my week. The plan appears under Work."],
  },
  {
    title: "Say yes or no in Needs you",
    body: "Any change to your calendar, or any email, waits here. Nothing moves until you approve it.",
    drawing: (
      <MiniScreen nav={NAV} active="Needs you" marks={{ "Needs you": 1 }}>
        <Approval label="Calendar change" title="Move Gym from Wed 18:00 to Fri 18:00" marks={[2, 3, 4]} />
      </MiniScreen>
    ),
    callouts: [
      "Open Needs you.",
      "Approve makes the change in your calendar.",
      "Edit first to adjust it.",
      "Reject with a reason - it can become a rule it follows next time.",
    ],
  },
];

const FEATURES: TourFeature[] = [
  {
    title: "Updates where you already are",
    body: "Alerts sends what needs you - and a morning brief - to LINE, Telegram, WhatsApp, Slack, Discord, Teams or email, so you don't have to keep the app open.",
    drawing: (
      <MiniScreen nav={NAV} active="Alerts" marks={{ Alerts: 1 }}>
        <MiniCard title="Alerts">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink">Send to LINE</span>
            <MiniButton label="Connect" mark={2} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink">Morning brief</span>
            <Mark n={3} />
          </div>
        </MiniCard>
      </MiniScreen>
    ),
    tryThis: "Connect the chat app you use most and turn on the morning brief.",
    action: { label: "Open Alerts", href: (project) => `/p/${project}/alerts` },
  },
  {
    title: "A check-in on everything",
    body: "A daily or weekly check-in sums up the whole space: what finished, what is waiting for you, what failed, and any agent that's struggling - with links to each.",
    drawing: (
      <Flow
        steps={[
          { label: "All your agents", detail: "Finished, failed, waiting" },
          { label: "One check-in", detail: "Daily or weekly, by email too", you: true },
          { label: "Links to act", detail: "Straight to each item" },
        ]}
      />
    ),
    tryThis: "Choose how often you want your check-in, and whether it is emailed.",
    action: { label: "Open settings", href: (project) => `/p/${project}/organization` },
  },
  {
    title: "They can look things up online",
    body: "Ask any agent in chat about the weather, news, prices or a fact. It searches the web and gives the answer with the source link.",
    drawing: (
      <MiniCard title="Chat">
        <p className="text-xs text-ink-muted">You: What&apos;s the weather in Bangkok tomorrow?</p>
        <p className="text-xs text-ink">Hot and humid, 34°. Rain likely after 4pm.</p>
        <p className="text-xs text-accent">Source: weather.com</p>
      </MiniCard>
    ),
    tryThis: "Ask an agent a question that needs today's information.",
    action: { label: "Open chat", href: (project) => `/p/${project}/team` },
  },
  {
    title: "Nothing changes without you",
    body: "Assistants read and plan on their own, but a calendar change, an email or a reply always stops in Needs you with its full text first.",
    drawing: (
      <Flow
        steps={[
          { label: "It suggests", detail: "From your calendar" },
          { label: "You decide", detail: "Approve, edit or reject", you: true },
          { label: "It happens", detail: "And it's logged" },
        ]}
      />
    ),
    tryThis: "Approve one suggested change, and reject the next with a reason.",
    action: { label: "Open Needs you", href: (project) => `/p/${project}/needs-you` },
  },
  {
    title: "A plan every Sunday",
    body: "Your week arrives on its own: clashes, free time, birthdays and deadlines coming up. It becomes a habit because you don't have to ask for it.",
    drawing: (
      <Flow
        steps={[
          { label: "Sunday 18:00", detail: "It reads next week" },
          { label: "The plan", detail: "Clashes, free time, what's coming" },
          { label: "One fix", detail: "Waits for your yes", you: true },
        ]}
      />
    ),
    tryThis: "Change the day or time it plans to suit your week.",
    action: { label: "Open the Roster", href: (project) => `/p/${project}/roster` },
  },
  {
    title: "Money, added up exactly",
    body: "Upload a bank or card statement (CSV) and the Money assistant adds it up - by category, subscriptions, biggest costs - with the maths done exactly, not guessed. Account numbers are masked.",
    drawing: (
      <MiniCard title="This month">
        {[
          ["Groceries", "£412.30"],
          ["Subscriptions (6)", "£78.94"],
          ["Transport", "£96.10"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between border-t border-line pt-1 text-xs first:border-0 first:pt-0">
            <span className="text-ink">{label}</span>
            <span className="font-semibold text-ink">{value}</span>
          </div>
        ))}
      </MiniCard>
    ),
    tryThis: "Add a Money assistant and upload last month's statement.",
    action: { label: "Add an assistant", href: (project) => `/p/${project}/agents/new` },
  },
  {
    title: "Your corrections become its rules",
    body: "Tell it once why something was wrong. Save that as a rule and it follows it every time after.",
    drawing: (
      <Flow
        steps={[
          { label: "You reject", detail: "\"Never book before 9am\"" },
          { label: "Saved as a rule", you: true },
          { label: "Next plan", detail: "Follows it" },
        ]}
      />
    ),
    tryThis: "Reject a suggestion with a one-line reason, and leave \"Save this as a rule\" ticked.",
    action: { label: "Open Needs you", href: (project) => `/p/${project}/needs-you` },
  },
  {
    title: "Private by design",
    body: "Your space is private: nobody can be invited in, and its assistants have no public link. You can download or delete everything in it at any time.",
    drawing: (
      <MiniCard title="Your personal space" className="border-accent-line">
        <p className="text-xs text-ink-muted">Only you</p>
      </MiniCard>
    ),
    tryThis: "Open Your space and see what you can download or delete.",
    action: { label: "Open Your space", href: (project) => `/p/${project}/organization` },
  },
];

export const TOUR: { setup: TourStep[]; features: TourFeature[] } = { setup: SETUP, features: FEATURES };
