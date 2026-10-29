import { describe, expect, it } from "vitest";
import { assertTransition, isEditable, PostStatus } from "@/models/post";

const allowed = [
  "draft→scheduled",
  "draft→publishing",
  "scheduled→scheduled",
  "scheduled→cancelled",
  "scheduled→publishing",
  "scheduled→failed",
  "publishing→publishing",
  "publishing→published",
  "publishing→failed",
  "failed→publishing",
  "failed→scheduled",
];

describe("post state machine", () => {
  const statuses = PostStatus.options;
  for (const from of statuses) {
    for (const to of statuses) {
      const pair = `${from}→${to}`;
      it(`${pair} is ${allowed.includes(pair) ? "allowed" : "rejected"}`, () => {
        if (allowed.includes(pair)) expect(() => assertTransition(from, to)).not.toThrow();
        else expect(() => assertTransition(from, to)).toThrow();
      });
    }
  }

  it("only draft, scheduled and failed are editable", () => {
    expect(statuses.filter(isEditable)).toEqual(["draft", "scheduled", "failed"]);
  });
});
