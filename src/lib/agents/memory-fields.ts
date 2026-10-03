/** The things the assistant keeps about you besides the About-you box, in plain words. */
export const MEMORY_FIELDS: readonly { id: string; label: string }[] = [
  { id: "goals", label: "What you want help with" },
  { id: "tone", label: "How to talk to you" },
  { id: "never", label: "What never to do" },
  { id: "week", label: "Your week" },
  { id: "money", label: "Money" },
  { id: "people", label: "People who matter" },
  { id: "preferences", label: "Likes and dislikes" },
  { id: "voice", label: "How you write online" },
];
