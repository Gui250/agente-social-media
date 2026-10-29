import { describe, expect, it } from "vitest";
import { creativeScriptFor } from "@/models/creative-script";

const video = {
  title: "Sorriso sem medo",
  hook: "Você adia o dentista por medo?",
  blocks: [
    { label: "Cena 1", durationSeconds: 3, visual: "Close no rosto", text: "Medo de dentista?" },
    { label: "Cena 2", durationSeconds: 5, visual: "Consultório", text: "Aqui é sem dor." },
  ],
  caption: "Agende sua avaliação.",
  cta: "Clique no link da bio",
  hashtags: ["#dentista", "#sorriso"],
};
const staticScript = {
  ...video,
  blocks: [{ label: "Slide 1", durationSeconds: null, visual: "Fundo azul", text: "3 mitos" }],
};

const ok = (format: "video" | "static", value: unknown) =>
  creativeScriptFor(format).safeParse(value).success;

describe("CreativeScript schema", () => {
  it("accepts valid video and static scripts", () => {
    expect(ok("video", video)).toBe(true);
    expect(ok("static", staticScript)).toBe(true);
  });

  it("enforces title 1–120 and hook 1–300", () => {
    expect(ok("video", { ...video, title: "" })).toBe(false);
    expect(ok("video", { ...video, title: "a".repeat(121) })).toBe(false);
    expect(ok("video", { ...video, hook: "" })).toBe(false);
    expect(ok("video", { ...video, hook: "a".repeat(301) })).toBe(false);
  });

  it("enforces 1–20 blocks", () => {
    expect(ok("video", { ...video, blocks: [] })).toBe(false);
    expect(ok("video", { ...video, blocks: Array(21).fill(video.blocks[0]) })).toBe(false);
    expect(ok("video", { ...video, blocks: Array(20).fill(video.blocks[0]) })).toBe(true);
  });

  it("requires durationSeconds in video and null in static", () => {
    const noDuration = { ...video.blocks[0], durationSeconds: null };
    expect(ok("video", { ...video, blocks: [noDuration] })).toBe(false);
    expect(ok("static", { ...staticScript, blocks: [video.blocks[0]] })).toBe(false);
  });

  it("enforces caption ≤ 2200 and cta 1–200", () => {
    expect(ok("video", { ...video, caption: "a".repeat(2201) })).toBe(false);
    expect(ok("video", { ...video, caption: "a".repeat(2200) })).toBe(true);
    expect(ok("video", { ...video, cta: "" })).toBe(false);
    expect(ok("video", { ...video, cta: "a".repeat(201) })).toBe(false);
  });

  it("enforces ≤ 30 hashtags starting with #", () => {
    const tags = (n: number) => Array.from({ length: n }, (_, i) => `#t${i}`);
    expect(ok("video", { ...video, hashtags: tags(30) })).toBe(true);
    expect(ok("video", { ...video, hashtags: tags(31) })).toBe(false);
    expect(ok("video", { ...video, hashtags: ["dentista"] })).toBe(false);
  });
});
