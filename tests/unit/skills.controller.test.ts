import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const listUserSkills = vi.fn();
const upsertUserSkill = vi.fn();

vi.mock("@/models/skill", () => ({ listUserSkills, upsertUserSkill, deleteUserSkill: vi.fn() }));

const { importSkill, MAX_SKILLS } = await import("@/controllers/skills");
const { getSkills, listSkills } = await import("@/agent/skills");

const md = (name: string, description = "Posts de oferta com prazo curto.", body = "- Diga o prazo.") =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;

describe("skills.importSkill", () => {
  beforeEach(() => {
    listUserSkills.mockReset().mockResolvedValue([]);
    upsertUserSkill.mockReset().mockImplementation(async (row) => ({ id: "k1", ...row }));
  });

  it("saves a valid SKILL.md for the user", async () => {
    const saved = await importSkill("u1", md("promocao-relampago"));
    expect(upsertUserSkill).toHaveBeenCalledWith({
      user_id: "u1",
      name: "promocao-relampago",
      description: "Posts de oferta com prazo curto.",
      body: "- Diga o prazo.",
    });
    expect(saved.id).toBe("k1");
  });

  it.each([
    ["no front matter", "só texto"],
    ["a name with spaces or capitals", md("Promoção Relâmpago")],
    ["a missing description", md("promo", "")],
    ["an empty body", md("promo", "Posts de oferta com prazo curto.", "")],
  ])("rejects %s", async (_, source) => {
    await expect(importSkill("u1", source)).rejects.toBeInstanceOf(DomainError);
    expect(upsertUserSkill).not.toHaveBeenCalled();
  });

  it("can't take a built-in skill's name", async () => {
    await expect(importSkill("u1", md("negocio-local"))).rejects.toMatchObject({ status: 409 });
  });

  it("caps new skills at the limit but still lets an existing one be replaced", async () => {
    const full = Array.from({ length: MAX_SKILLS }, (_, i) => ({ name: `s-${i}` }));
    listUserSkills.mockResolvedValue(full);
    await expect(importSkill("u1", md("nova"))).rejects.toThrow(/Limite/);
    await expect(importSkill("u1", md("s-3"))).resolves.toMatchObject({ name: "s-3" });
  });
});

describe("listSkills / getSkills with a user", () => {
  it("adds the user's imports after the built-in ones and finds them by name", async () => {
    listUserSkills.mockResolvedValue([{ id: "k1", name: "promo", description: "d", body: "corpo" }]);
    expect((await listSkills("u1")).map((s) => s.name).at(-1)).toBe("promo");
    expect((await getSkills(["promo"], "u1"))[0]).toEqual({ name: "promo", description: "d", body: "corpo" });
    expect(listUserSkills).toHaveBeenCalledWith("u1");
  });
});
