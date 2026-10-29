import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/controllers/cron", () => ({
  publishTick: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0, inProgress: 0 })),
  refreshTokens: vi.fn(async () => ({ refreshed: 0, expired: 0 })),
}));

const SECRET = "s".repeat(32);
let publish: (req: Request) => Promise<Response>;
let refresh: (req: Request) => Promise<Response>;

beforeAll(async () => {
  Object.assign(process.env, {
    OPENAI_API_KEY: "x",
    DATABASE_URL: "postgres://localhost/test",
    CRON_SECRET: SECRET,
  });
  publish = (await import("@/app/api/cron/publish/route")).POST;
  refresh = (await import("@/app/api/cron/refresh-tokens/route")).POST;
});

const req = (auth?: string) =>
  new Request("http://localhost/api/cron/publish", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
  });

describe("cron routes", () => {
  it.each([
    ["publish", () => publish],
    ["refresh-tokens", () => refresh],
  ])("%s: 401 without or with a wrong bearer, 200 with the right one", async (_name, handler) => {
    expect((await handler()(req())).status).toBe(401);
    expect((await handler()(req("Bearer wrong"))).status).toBe(401);
    expect((await handler()(req(`Bearer ${"t".repeat(32)}`))).status).toBe(401);
    expect((await handler()(req(`Bearer ${SECRET}`))).status).toBe(200);
  });
});
