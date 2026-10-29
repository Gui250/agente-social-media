import { describe, expect, it } from "vitest";
import { videoPrompt, visualPrompt } from "@/agent/visual-prompt";

const script = {
  title: "Clareamento",
  hook: "Seu sorriso aparece antes de você falar",
  blocks: [
    { label: "Slide 1", durationSeconds: null, visual: "paciente sorrindo no espelho", text: "t1" },
    { label: "Slide 2", durationSeconds: null, visual: "dentista explicando", text: "t2" },
  ],
  caption: "c",
  cta: "Agende",
  hashtags: ["#dentista"],
};
const brand = { segment: "clínica odontológica" };

describe("visualPrompt", () => {
  it("puts the hook only on the first image", () => {
    expect(visualPrompt(script, 0, brand)).toContain(script.hook);
    expect(visualPrompt(script, 1, brand)).not.toContain(script.hook);
  });

  it("uses the block's scene and always forbids drawn text", () => {
    const prompt = visualPrompt(script, 1, brand);
    expect(prompt).toContain("Cena: dentista explicando");
    expect(prompt).toContain("clínica odontológica");
    expect(prompt.split("\n").at(-1)).toMatch(/^Sem texto/);
  });

  it("repeats the art direction on every image and video, and skips it when missing", () => {
    const styled = { ...script, artDirection: "luz quente, fundo bege #F2E8DC" };
    expect(visualPrompt(styled, 0, brand)).toContain("#F2E8DC");
    expect(visualPrompt(styled, 1, brand)).toContain("#F2E8DC");
    expect(videoPrompt(styled, brand)).toContain("#F2E8DC");
    expect(visualPrompt(script, 1, brand)).not.toMatch(/Direção de arte|undefined/);
  });
});

describe("videoPrompt", () => {
  it("compresses every scene into one clip that opens on the hook", () => {
    const prompt = videoPrompt(script, brand);
    expect(prompt).toContain(script.hook);
    expect(prompt).toContain("- Slide 1: paciente sorrindo no espelho");
    expect(prompt).toContain("- Slide 2: dentista explicando");
    expect(prompt).toMatch(/Sem texto na tela/);
  });
});
