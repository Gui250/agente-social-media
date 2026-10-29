import { describe, expect, it, vi } from "vitest";
import { notFound } from "@/lib/errors";

const kitFor = vi.fn();
vi.mock("@/controllers/brands", async (orig) => ({ ...(await orig<typeof import("@/controllers/brands")>()), kitFor }));

const { tools } = await import("@/agent/tools");

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

  it("generate_creative_media always needs approval (it costs money)", async () => {
    expect(await requiresApproval("generate_creative_media")).toBe(true);
  });

  it("list_generations does not need approval", async () => {
    expect(await requiresApproval("list_generations")).toBe(false);
  });

  it("cancel_post does not need approval", async () => {
    expect(await requiresApproval("cancel_post")).toBe(false);
  });
});

describe("brand tools", () => {
  const ctx = { context: { userId: "u1", timezone: "America/Sao_Paulo", conversationId: "c1", brandId: null } };
  const call = (name: string, args: object) => byName(name).invoke(ctx as never, JSON.stringify(args));

  it.each(["list_brands", "get_brand_kit", "set_active_brand"])("%s does not need approval", async (name) => {
    expect(await requiresApproval(name)).toBe(false);
  });

  it("get_brand_kit hands a missing or foreign brand back as an error message", async () => {
    kitFor.mockRejectedValue(notFound("Marca", "a"));
    expect(await call("get_brand_kit", { brandId: "11111111-1111-4111-8111-111111111111" })).toBe("Erro: Marca não encontrada.");
  });

  it("get_brand_kit without a brand and without an active one asks for a mention", async () => {
    expect(await call("get_brand_kit", { brandId: null })).toMatch(/^Erro: nenhuma marca ativa/);
    expect(kitFor).not.toHaveBeenCalled();
  });
});
