import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ currentUser: vi.fn() }));
const { errorResponse } = await import("@/lib/http");

describe("errorResponse", () => {
  it("explains an OpenAI account out of credits instead of a generic error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const e = Object.assign(new Error("You have no credits remaining."), { code: "credit_balance_exhausted", type: "insufficient_quota" });
    const res = errorResponse(e);
    expect(res.status).toBe(503);
    expect((await res.json()).error.message).toContain("sem créditos");
    expect(errorResponse(new Error("x")).status).toBe(500);
  });
});
