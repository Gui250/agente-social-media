import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import { getSkills, listSkills, parseSkill } from "@/agent/skills";

describe("parseSkill", () => {
  it("reads name and description from the front matter and keeps the body", () => {
    const skill = parseSkill("---\nname: x\ndescription: Faz y: com dois-pontos\n---\n\nCorpo\n", "pasta");
    expect(skill).toEqual({ name: "x", description: "Faz y: com dois-pontos", body: "Corpo" });
  });

  it("falls back to the folder name and whole file without front matter", () => {
    expect(parseSkill("Só texto", "pasta")).toEqual({ name: "pasta", description: "", body: "Só texto" });
  });
});

describe("skills/ folder", () => {
  it("every skill has a name matching its use, a description and a body", async () => {
    const skills = await listSkills();
    expect(skills.map((s) => s.name)).toEqual(["carrossel-que-converte", "criativo-disruptivo", "negocio-local"]);
    for (const s of skills) {
      expect(s.description.length).toBeGreaterThan(20);
      expect(s.body.length).toBeGreaterThan(100);
    }
  });

  it("an unknown name is a DomainError listing what exists", async () => {
    await expect(getSkills(["nao-existe"])).rejects.toBeInstanceOf(DomainError);
    await expect(getSkills(["nao-existe"])).rejects.toThrow(/carrossel-que-converte/);
  });
});
