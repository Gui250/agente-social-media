import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const writeScript = vi.fn();
const insertScript = vi.fn();
const listScripts = vi.fn(async () => [] as unknown[]);

vi.mock("@/agent/script-writer", () => ({ writeScript }));
vi.mock("@/models/skill", () => ({ listUserSkills: async () => [] }));
vi.mock("@/models/creative-script", async (orig) => ({
  ...(await orig<typeof import("@/models/creative-script")>()),
  insertScript,
  listScripts,
}));

const { generate } = await import("@/controllers/scripts");

const valid = {
  title: "T",
  hook: "H",
  blocks: [{ label: "Cena 1", durationSeconds: 3, visual: "v", text: "t" }],
  caption: "c",
  cta: "cta",
  hashtags: ["#a"],
};

describe("scripts.generate", () => {
  beforeEach(() => {
    writeScript.mockReset();
    insertScript.mockReset();
  });

  it("rejects a segment outside 2–120 characters before calling the writer", async () => {
    await expect(generate("u1", { segment: "a", format: "video" })).rejects.toBeInstanceOf(
      DomainError,
    );
    await expect(
      generate("u1", { segment: "a".repeat(121), format: "video" }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(writeScript).not.toHaveBeenCalled();
  });

  it("does not save when the writer fails validation", async () => {
    writeScript.mockRejectedValue(new DomainError("invalid_script", "x", 502));
    await expect(generate("u1", { segment: "dentista", format: "video" })).rejects.toThrow();
    expect(insertScript).not.toHaveBeenCalled();
  });

  it("saves a valid script for the given user", async () => {
    writeScript.mockResolvedValue(valid);
    insertScript.mockImplementation(async (row) => ({ id: "s1", ...row }));
    const saved = await generate("u1", { segment: "dentista", format: "video" });
    expect(insertScript).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", segment: "dentista", format: "video", content: valid }),
    );
    expect(saved.id).toBe("s1");
  });

  it("passes the chosen skills to the writer as guidelines, without saving them", async () => {
    writeScript.mockResolvedValue(valid);
    insertScript.mockImplementation(async (row) => ({ id: "s1", ...row }));
    await generate("u1", { segment: "dentista", format: "video", skills: ["carrossel-que-converte"] });
    expect(writeScript.mock.calls[0][0].guidelines).toContain("Slide 1 (capa)");
    expect(insertScript.mock.calls[0][0]).not.toHaveProperty("skills");
  });

  it("always hands the writer the disruptive-creative guidelines", async () => {
    writeScript.mockResolvedValue(valid);
    insertScript.mockImplementation(async (row) => ({ id: "s1", ...row }));
    await generate("u1", { segment: "dentista", format: "static" });
    expect(writeScript.mock.calls[0][0].guidelines).toContain("Cena impossível");
  });

  it("shows the writer the user's recent scripts so it doesn't repeat them", async () => {
    writeScript.mockResolvedValue(valid);
    insertScript.mockImplementation(async (row) => ({ id: "s1", ...row }));
    listScripts.mockResolvedValueOnce([{ content: { ...valid, title: "Velho", hook: "Gancho velho" } }]);
    await generate("u1", { segment: "dentista", format: "static" });
    expect(listScripts).toHaveBeenCalledWith("u1", { limit: 5 });
    expect(writeScript.mock.calls[0][0].recent).toEqual(['- Velho: "Gancho velho"']);
  });

  it("passes the visual identity to the writer without saving it", async () => {
    writeScript.mockResolvedValue(valid);
    insertScript.mockImplementation(async (row) => ({ id: "s1", ...row }));
    await generate("u1", { segment: "dentista", format: "static", visualIdentity: "Azul #1A2B4C, minimalista" });
    expect(writeScript.mock.calls[0][0].visualIdentity).toBe("Azul #1A2B4C, minimalista");
    expect(insertScript.mock.calls[0][0]).not.toHaveProperty("visualIdentity");
  });

  it("passes the reference creatives' recipe to the writer without saving it", async () => {
    writeScript.mockResolvedValue(valid);
    insertScript.mockImplementation(async (row) => ({ id: "s1", ...row }));
    await generate("u1", { segment: "dentista", format: "static", references: "Close extremo, fundo escuro" });
    expect(writeScript.mock.calls[0][0].references).toBe("Close extremo, fundo escuro");
    expect(insertScript.mock.calls[0][0]).not.toHaveProperty("references");
  });

  it("cuts long agent-written context to size instead of failing the script", async () => {
    writeScript.mockResolvedValue(valid);
    insertScript.mockImplementation(async (row) => ({ id: "s1", ...row }));
    await generate("u1", {
      segment: "dentista",
      format: "static",
      references: "r".repeat(5000),
      visualIdentity: "v".repeat(2000),
      objective: "o".repeat(400),
      skills: ["criativo-disruptivo", "criativo-disruptivo", "criativo-disruptivo", "criativo-disruptivo"],
    });
    const req = writeScript.mock.calls[0][0];
    expect(req.references).toHaveLength(4000);
    expect(req.visualIdentity).toHaveLength(1500);
    expect(req.objective).toHaveLength(300);
  });

  it("rejects an unknown skill before calling the writer", async () => {
    await expect(generate("u1", { segment: "dentista", format: "video", skills: ["nao-existe"] })).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(writeScript).not.toHaveBeenCalled();
  });
});
