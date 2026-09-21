# Site content

Every word on the public site lives in this folder. Edit a file, commit, and
the next deploy picks it up - no component code involved.

| File | What it controls |
|---|---|
| `site.json` | Company details, navigation, footer, default page title and description |
| `landing.json` | The home page: hero, how it works, pricing blurb, call to action |
| `showcase.json` | The showcase page's heading and intro (the roles themselves come from `templates.json`) |
| `contact.json` | The contact page: heading, intro, form labels, company details shown beside the form |
| `templates.json` | The agent role templates. Each one is a hire-wizard starting point **and** a showcase card - one record, both places |

Rules that keep this safe to edit:

- Keys are validated on build (`src/lib/content.ts`). A typo in a key name or
  a missing required field fails `npm run typecheck` with the file and field
  named, rather than rendering a blank.
- Text is plain text. Line breaks in a string become paragraph breaks where
  the page supports them; there is no HTML.
- `templates.json` fields that the wizard uses (`jobTitle`, `team`,
  `personality`, `welcomeMessage`, `escalationRule`, `responsibilities`,
  `allowedTools`, `workTools`) are written in the same plain language an owner
  would type into the form. Adding a record here adds a card to the wizard's
  first step and to the showcase; nothing else needs to change. The name and
  avatar are never in a template - those are the owner's.
- `workTools` becomes the agent's scope-of-work allowlist: the tools it may
  call during a run, trimmed later in the editor. `allowedTools` are the chat
  tools.
- A showcase card links to `/signup?template=<id>`; the id survives signup or
  login and opens the wizard with that role already chosen.
