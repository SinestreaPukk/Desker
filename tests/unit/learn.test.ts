import { describe, expect, it } from "vitest";
import { acceptUpdates } from "@/lib/agents/learn";
import { contextQuestions } from "@/lib/work/context";

const questions = contextQuestions().all;

describe("acceptUpdates", () => {
  it("takes a new fact and ignores unknown fields, non-text and unchanged answers", () => {
    const current = { about: "Maya, designer in Bangkok." };
    const out = acceptUpdates(current, { about: "Maya, designer in Bangkok. Has a dog called Pixel.", bogus: "x", goals: 5, tone: "" }, questions);
    expect(out).toEqual({ about: "Maya, designer in Bangkok. Has a dog called Pixel." });
    expect(acceptUpdates(current, { about: "Maya, designer in Bangkok." }, questions)).toEqual({});
  });

  it("refuses a rewrite that throws most of a long answer away", () => {
    const long = "I live in Bangkok with my partner Sam and we freelance together. ".repeat(3);
    expect(acceptUpdates({ about: long }, { about: "Lives in Bangkok." }, questions)).toEqual({});
  });

  it("copes with a non-object reply", () => {
    expect(acceptUpdates({}, null, questions)).toEqual({});
    expect(acceptUpdates({}, ["about"], questions)).toEqual({});
  });
});
