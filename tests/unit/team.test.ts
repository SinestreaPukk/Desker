import { describe, expect, it } from "vitest";
import { mentioned, specialAbilities, type TeamAgent } from "@/lib/team";

const agent = (name: string): TeamAgent => ({
  id: name.toLowerCase(),
  name,
  templateId: null,
  jobTitle: "",
  department: null,
  personality: "",
  responsibilities: [],
  modelProvider: "anthropic",
  model: null,
  scopeOfWork: null,
});
const team = [agent("Bright"), agent("Tim"), agent("Max")];

describe("who a team-room message is for", () => {
  it("is whoever it names with an @", () => {
    expect(mentioned("@tim can you draft a post?", team)?.map((a) => a.name)).toEqual(["Tim"]);
    expect(mentioned("@Bright and @Max, thoughts?", team)?.map((a) => a.name)).toEqual(["Bright", "Max"]);
  });

  it("is the whole team for @everyone", () => {
    expect(mentioned("@everyone quick check-in", team)).toHaveLength(3);
  });

  it("is left to the router when nobody is named", () => {
    expect(mentioned("What should we post this week?", team)).toBeNull();
  });
});

describe("what sets an agent's tasks apart", () => {
  it("names the tools only some agents have, so the router can pick by them", () => {
    const can = specialAbilities({ scopeOfWork: { tools: ["search_documents", "calendar_list_events", "calendar_reschedule"] } });
    expect(can).toEqual(["Check the calendar", "Move calendar events"]);
    expect(specialAbilities({ scopeOfWork: { tools: ["search_documents", "draft_content"] } })).toEqual([]);
  });
});

describe("addressing an agent by name", () => {
  const team = [agent("Coach"), agent("Gebby"), agent("A.J.")];
  it("treats a name that opens the message as an address", () => {
    expect(mentioned("Coach, plan my week", team)?.map((a) => a.name)).toEqual(["Coach"]);
    expect(mentioned("gebby: remind me to call mum", team)?.map((a) => a.name)).toEqual(["Gebby"]);
    expect(mentioned("A.J. - what's up", team)?.map((a) => a.name)).toEqual(["A.J."]);
  });
  it("does not fire on a name used mid-sentence or as a prefix of another word", () => {
    expect(mentioned("Tell the coach I said hi", team)).toBeNull();
    expect(mentioned("Coachella tickets?", team)).toBeNull();
  });
});
