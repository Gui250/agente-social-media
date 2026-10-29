import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const writeScript = vi.fn();
const insertScript = vi.fn();

vi.mock("@/agent/script-writer", () => ({ writeScript }));
vi.mock("@/models/creative-script", async (orig) => ({
  ...(await orig<typeof import("@/models/creative-script")>()),
  insertScript,
}));

const { generate } = await import("@/controllers/scripts");
const supabase = {} as never;

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
    await expect(generate(supabase, "u1", { segment: "a", format: "video" })).rejects.toBeInstanceOf(
      DomainError,
    );
    await expect(
      generate(supabase, "u1", { segment: "a".repeat(121), format: "video" }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(writeScript).not.toHaveBeenCalled();
  });

  it("does not save when the writer fails validation", async () => {
    writeScript.mockRejectedValue(new DomainError("invalid_script", "x", 502));
    await expect(generate(supabase, "u1", { segment: "dentista", format: "video" })).rejects.toThrow();
    expect(insertScript).not.toHaveBeenCalled();
  });

  it("saves a valid script for the given user", async () => {
    writeScript.mockResolvedValue(valid);
    insertScript.mockImplementation(async (_s, row) => ({ id: "s1", ...row }));
    const saved = await generate(supabase, "u1", { segment: "dentista", format: "video" });
    expect(insertScript).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ user_id: "u1", segment: "dentista", format: "video", content: valid }),
    );
    expect(saved.id).toBe("s1");
  });
});
