import { describe, expect, it } from "vitest";
import { tools } from "@/agent/tools";

const byName = (name: string) => {
  const t = tools.find((t) => t.name === name);
  if (!t || t.type !== "function") throw new Error(`tool ${name} not found`);
  return t;
};

// needsApproval is normalized by the SDK into a function; `true` becomes one that always resolves true.
const requiresApproval = (name: string) =>
  byName(name).needsApproval({} as never, {} as never, "call");

describe("agent tools approval flags", () => {
  it("schedule_post always needs approval", async () => {
    expect(await requiresApproval("schedule_post")).toBe(true);
  });

  it("publish_post_now always needs approval", async () => {
    expect(await requiresApproval("publish_post_now")).toBe(true);
  });

  it("cancel_post does not need approval", async () => {
    expect(await requiresApproval("cancel_post")).toBe(false);
  });
});
