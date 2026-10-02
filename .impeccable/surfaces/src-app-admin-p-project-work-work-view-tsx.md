---
version: 1
slug: "src-app-admin-p-project-work-work-view-tsx"
primary_target: "src/app/(admin)/p/[project]/work/work-view.tsx"
related_targets: ["src/components/admin-shell.tsx","src/app/(admin)/p/[project]/roster/roster-view.tsx"]
---

# Surface brief: the app (shell, Work, Roster)

Scope: the signed-in app shell (sidebar, page header) plus Work and Roster; the rest of the app inherits the shell and follows later. Visitor mode: Operate.
Audience: small-business owners checking in a few times a day, on a laptop at a desk or a phone between jobs, in daylight.
Job: see what the staff did, approve what is waiting, hand over new work. Success: it feels alive, it feels like their team, what needs them is instant, and it looks premium rather than generic. Must not get harder to use; must not go dark or techy.
Constraints: name, logo and #1800AD stay. Contrast gated at 4.5:1; reduced motion and reduced transparency respected.

User decision (2026-09-27): the Roster keeps its original card grid (agent cards with name, role, status and counts). It inherits the shell, ground, type and inset-group surface, but not the contacts-list layout; the list idiom applies to the shell and Work.

## Direction contract

THESIS: Desker is a native app for running your staff: one window, the team on the left, their work beside it, nothing a page away. It refuses the category's sidebar-plus-card-grid admin dashboard.

OWN-WORLD: Apple's Mail/Reminders idiom on the web. Grouped-background grey ground, white inset grouped lists with hairline separators inset past the avatar, a translucent vibrant sidebar with a filled indigo selection pill and Mail-style badge counts, system font with large bold titles, contact-photo circular avatars, indigo #1800AD as the one tint. Raises: billing by importance (from Festival Lineup); one live "now" marker (from Rhythm Machine); nothing labelled twice (from Factory Catalogue); hierarchy by scale contrast (from Type Specimen).

STORY: The owner opens Desker, sees what the staff did, sees how many items need their attention in Needs you, sees who is working right now on today's strip, and opens any run beside the list without losing their place. Needs you is the single action queue for approvals and other decisions.

FIRST VIEWPORT: Work at 1280-1440 wide. Left: translucent sidebar with Work selected and a count on Needs you. Centre: large bold "Work" title that condenses into the toolbar on scroll; today's schedule strip with a thin indigo now line; then Running, Paused, Queued, and Finished by day as inset grouped lists. Paused items link clearly to the authoritative Needs you queue. Right (xl and up): the selected run's report in a reading pane. Work is for reading runs and starting work; approval actions live in Needs you.

FORM: Native Desk, candidate 5 of 7 on my ordered list (Apple native idiom); seed key e30648a5. Code-led. Signature interaction: the list-and-reading-pane split view; motion grammar: large title condensing into the toolbar, the pane's content cross-fading on selection, springs never bouncing.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
