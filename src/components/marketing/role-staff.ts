/**
 * Who does each role on the public site: a name and an avatar seed. A plain
 * module, not a client one - server-rendered pages read it too, and a
 * "use client" file only hands the server a reference, not its data (which
 * is how the desks once read ", , and more").
 */
export const ROLE_STAFF: Record<string, readonly [string, string]> = {
  "customer-support": ["Mia", "mia"],
  "client-onboarding": ["Ivy", "ivy"],
  researcher: ["Sol", "sol"],
  marketer: ["Nova", "nova"],
  "competitor-watch": ["Vera", "vera"],
  secretary: ["Kai", "kai"],
  "dev-support": ["Ada", "ada"],
  "sales-development": ["Leo", "leo-leads"],
  "people-ops": ["Rae", "rae"],
  "money-manager": ["Penny", "penny"],
  "personal-assistant": ["Juno", "juno"],
  "social-media-manager": ["Remy", "remy"],
  "career-coach": ["Theo", "theo"],
  "travel-planner": ["Isla", "isla"],
  "learning-coach": ["Ollie", "ollie"],
};
