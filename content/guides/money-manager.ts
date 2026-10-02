export const guide = {
  slug: "money-manager",
  title: "Hand your money manager a statement",
  summary: "Export a CSV from your bank, upload it, and get exact totals every week.",
  minutes: 2,
  body: `The money manager does not guess at your spending: it adds up the statements you give it, to the cent, and then tells you what the numbers mean.

## Get a CSV from your bank

In your banking app or website, open an account's transactions or statements and look for **Export** or **Download**, then choose **CSV** (sometimes "spreadsheet" or "Excel CSV"). One file per account or card. A PDF statement can be read for questions but cannot be added up - CSV is what makes the numbers exact.

## Upload it

Open your money manager on the **Roster**, go to **Knowledge**, and upload the file. Account and card numbers are masked to their last four digits as it is read, before anything is stored or seen by an AI. Upload a new file each month; transactions that appear in two overlapping exports are counted once.

## What it works out

- Money in and money out, by month.
- Spending by category: rent, groceries, eating out, transport, subscriptions and more.
- Your biggest merchants and largest single payments.
- Recurring charges - subscriptions and bills - with roughly what each costs a month.

Moving money between your own accounts is left out, so a transfer to savings never counts as spending. Your **Money basics** under About you give it your budget and goal to compare against.

## What it will never do

It cannot move money, pay a bill, cancel a subscription or sign you up for anything - there is no tool for it. It recommends, with the exact next step, and you do it. It gives practical, general guidance and says when a decision belongs with an accountant or a financial adviser.

## A good weekly rhythm

Leave it on its Monday routine. Read the check-in over coffee, act on the one thing it flags, and upload a fresh statement at the start of each month.`,
} as const;
