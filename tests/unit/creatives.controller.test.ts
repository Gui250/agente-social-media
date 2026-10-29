import { APIError } from "openai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const getScript = vi.fn();
const insertMedia = vi.fn();
const insertGeneration = vi.fn();
const runningVideos = vi.fn();
const finishGeneration = vi.fn();
const putObject = vi.fn();
const reviewArt = vi.fn();
const getMediaForUser = vi.fn();
const readObject = vi.fn();
const withText = vi.fn();
const gen = {
  VIDEO_SIZE: { width: 720, height: 1280 },
  generateImage: vi.fn(),
  startVideo: vi.fn(),
  videoStatus: vi.fn(),
  downloadVideo: vi.fn(),
};

vi.mock("@/models/creative-script", () => ({ getScript }));
vi.mock("@/models/media", () => ({ insertMedia, getMediaForUser }));
vi.mock("@/models/generation", () => ({ insertGeneration, runningVideos, finishGeneration, listGenerations: vi.fn() }));
vi.mock("@/lib/storage", () => ({ putObject, readObject }));
vi.mock("@/services/creative-gen", () => gen);
vi.mock("@/agent/art-critic", async (orig) => ({ ...(await orig<typeof import("@/agent/art-critic")>()), reviewArt }));
vi.mock("@/services/overlay", () => ({
  withText,
  withLogo: async (bytes: Uint8Array, logo: Uint8Array) => new Uint8Array([...bytes, ...logo]),
  fitTo: async (bytes: Uint8Array) => bytes,
}));

const activeKit = vi.fn(async (): Promise<object | null> => null);
const logoBytes = vi.fn(async (): Promise<Uint8Array | null> => null);
vi.mock("@/controllers/brands", () => ({
  activeKit,
  logoBytes,
  primaryColor: (kit: { cores: { hex: string }[] }) => kit.cores[0]?.hex ?? null,
}));

const { generate, videoTick } = await import("@/controllers/creatives");

const content = (durationSeconds: number | null) => ({
  title: "T",
  hook: "H",
  blocks: [
    { label: "1", durationSeconds, visual: "v1", text: "a" },
    { label: "2", durationSeconds, visual: "v2", text: "bb" },
  ],
  caption: "c",
  cta: "cta",
  hashtags: [],
});

describe("creatives.generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMedia.mockImplementation(async (row) => ({ id: `m-${row.storage_path}`, ...row }));
    insertGeneration.mockImplementation(async (row) => ({ id: "g1", ...row }));
    reviewArt.mockResolvedValue({ score: 90, critical: [], fixes: "" });
    withText.mockImplementation(async (bytes: Uint8Array, text: string) => new Uint8Array([...bytes, text.length]));
  });

  it("static: paints the text with the brand color and stamps the logo after the review", async () => {
    getScript.mockResolvedValue({ id: "s1", segment: "dentista", format: "static", content: content(null) });
    gen.generateImage.mockResolvedValue(new Uint8Array([1]));
    getMediaForUser.mockResolvedValue([{ kind: "image", storage_path: "u1/logo.jpg" }]);
    readObject.mockResolvedValue(new Uint8Array([7]));

    await generate("u1", { scriptId: "s1", brandColor: "#1a2b4c", logoMediaId: "logo" });

    expect(getMediaForUser).toHaveBeenCalledWith(["logo"], "u1");
    expect(withText).toHaveBeenCalledWith(expect.anything(), "a", "#1A2B4C");
    expect(reviewArt.mock.calls.map((c) => [...c[0]])).toEqual([[1, 1], [1, 2]]); // reviewed without the logo
    expect(putObject.mock.calls.map((c) => [...c[1]])).toEqual([[1, 1, 7], [1, 2, 7]]);
  });

  it("rejects a brand color that isn't #RRGGBB before spending on images", async () => {
    getScript.mockResolvedValue({ id: "s1", segment: "dentista", format: "static", content: content(null) });
    await expect(generate("u1", { scriptId: "s1", brandColor: "azul" })).rejects.toBeInstanceOf(DomainError);
    expect(gen.generateImage).not.toHaveBeenCalled();
  });

  it("static: stores one JPEG per slide under the user's folder, in slide order", async () => {
    getScript.mockResolvedValue({ id: "s1", segment: "dentista", format: "static", content: content(null) });
    gen.generateImage.mockResolvedValue(new Uint8Array([1]));

    const res = await generate("u1", { scriptId: "s1" });

    expect(res.status).toBe("pronto");
    expect(res.mediaIds).toHaveLength(2);
    expect(putObject.mock.calls.map((c) => c[0])).toEqual([
      expect.stringMatching(/^u1\/.+\.jpg$/),
      expect.stringMatching(/^u1\/.+\.jpg$/),
    ]);
    expect(putObject.mock.calls.map((c) => [...c[1]])).toEqual([[1, 1], [1, 2]]); // slide text overlaid
    expect(insertGeneration).toHaveBeenCalledWith(expect.objectContaining({ kind: "image", status: "done" }));
  });

  it("static: redoes a slide the critic rejects, with its fixes, and keeps the better one", async () => {
    getScript.mockResolvedValue({ id: "s1", segment: "dentista", format: "static", content: { ...content(null), blocks: [content(null).blocks[0]] } });
    gen.generateImage.mockResolvedValueOnce(new Uint8Array([1])).mockResolvedValueOnce(new Uint8Array([2]));
    reviewArt
      .mockResolvedValueOnce({ score: 60, critical: ["letras desenhadas"], fixes: "Tire o letreiro do fundo." })
      .mockResolvedValueOnce({ score: 88, critical: [], fixes: "" });

    await generate("u1", { scriptId: "s1" });

    expect(gen.generateImage).toHaveBeenCalledTimes(2);
    expect(gen.generateImage.mock.calls[1][0]).toMatch(/letras desenhadas Tire o letreiro do fundo\.$/);
    expect([...putObject.mock.calls[0][1]]).toEqual([2, 1]); // the second image
    expect(insertGeneration.mock.calls[0][0].prompt).toContain("Corrija");
  });

  it("static: keeps the first image when the retry scores lower, and ships unreviewed if the critic fails", async () => {
    getScript.mockResolvedValue({ id: "s1", segment: "dentista", format: "static", content: content(null) });
    gen.generateImage.mockImplementation(async (prompt: string) => new Uint8Array([prompt.includes("Corrija") ? 2 : 1]));
    reviewArt
      .mockResolvedValueOnce({ score: 70, critical: [], fixes: "x" })
      .mockRejectedValueOnce(new Error("vision down"))
      .mockResolvedValueOnce({ score: 50, critical: [], fixes: "" });

    await generate("u1", { scriptId: "s1" });

    expect(gen.generateImage).toHaveBeenCalledTimes(3); // slide 1 twice, slide 2 once
    expect(putObject.mock.calls.map((c) => c[1][0])).toEqual([1, 1]);
  });

  it("static: stores nothing when one slide fails at the provider", async () => {
    getScript.mockResolvedValue({ id: "s1", segment: "dentista", format: "static", content: content(null) });
    gen.generateImage
      .mockResolvedValueOnce(new Uint8Array([1]))
      .mockRejectedValueOnce(new APIError(400, { code: "moderation_blocked" }, "blocked", new Headers()));

    await expect(generate("u1", { scriptId: "s1" })).rejects.toBeInstanceOf(DomainError);
    expect(putObject).not.toHaveBeenCalled();
    expect(insertMedia).not.toHaveBeenCalled();
  });

  it("video: refused before calling the provider (OpenAI shut Sora down)", async () => {
    getScript.mockResolvedValue({ id: "s1", segment: "dentista", format: "video", content: content(4) });

    await expect(generate("u1", { scriptId: "s1" })).rejects.toMatchObject({ code: "video_unavailable" });
    expect(gen.startVideo).not.toHaveBeenCalled();
    expect(insertGeneration).not.toHaveBeenCalled();
  });
});

describe("creatives.videoTick", () => {
  const job = (id: string, created_at = new Date().toISOString()) => ({
    id, user_id: "u1", provider_job_id: `job-${id}`, created_at,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    insertMedia.mockImplementation(async (row) => ({ id: "m1", ...row }));
  });

  it("stores finished videos, fails failed or stale jobs, leaves the rest running", async () => {
    runningVideos.mockResolvedValue([
      job("done"), job("bad"), job("wip"), job("old", new Date(Date.now() - 2 * 3600_000).toISOString()),
    ]);
    gen.videoStatus.mockImplementation(async (id: string) =>
      ({ "job-done": { status: "completed" }, "job-bad": { status: "failed", error: "x" } })[id] ??
      { status: "in_progress" },
    );
    gen.downloadVideo.mockResolvedValue(new Uint8Array([9]));

    expect(await videoTick()).toEqual({ done: 1, failed: 2, running: 1, errors: 0 });
    expect(putObject).toHaveBeenCalledWith(expect.stringMatching(/^u1\/.+\.mp4$/), expect.anything(), "video/mp4");
    expect(finishGeneration).toHaveBeenCalledWith("done", { status: "done", media_id: "m1" });
    expect(finishGeneration).toHaveBeenCalledWith("bad", { status: "failed", failure_reason: "x" });
    expect(finishGeneration).toHaveBeenCalledWith("old", { status: "failed", failure_reason: "Tempo esgotado." });
  });
});

describe("creatives.generate with an active brand", () => {
  const kit = { id: "b1", name: "Sorriso Kids", cores: [{ hex: "#1A2B3C", papel: "primária" }], proibidos: ["neon"] };
  const staticScript = { id: "s1", segment: "dentista", format: "static", content: { ...content(null), blocks: [content(null).blocks[0]] } };

  beforeEach(() => {
    vi.clearAllMocks();
    insertMedia.mockImplementation(async (row) => ({ id: "m1", ...row }));
    insertGeneration.mockImplementation(async (row) => ({ id: "g1", ...row }));
    reviewArt.mockResolvedValue({ score: 90, critical: [], fixes: "" });
    withText.mockImplementation(async (bytes: Uint8Array) => bytes);
    getScript.mockResolvedValue(staticScript);
    gen.generateImage.mockResolvedValue(new Uint8Array([1]));
    activeKit.mockResolvedValue(kit);
    logoBytes.mockResolvedValue(new Uint8Array([9]));
  });

  it("uses the kit's color and logo, and keeps its forbidden elements out of the image", async () => {
    const res = await generate("u1", { scriptId: "s1" }, "b1");
    expect(activeKit).toHaveBeenCalledWith("u1", "b1");
    expect(withText).toHaveBeenCalledWith(expect.anything(), "a", "#1A2B3C");
    expect([...putObject.mock.calls[0][1]]).toEqual([1, 9]);
    expect(gen.generateImage.mock.calls[0][0]).toContain("Não mostre: neon.");
    expect(res).not.toHaveProperty("semLogo");
  });

  it("explicit color and attached logo win over the kit", async () => {
    getMediaForUser.mockResolvedValue([{ kind: "image", storage_path: "u1/logo.jpg" }]);
    readObject.mockResolvedValue(new Uint8Array([7]));
    await generate("u1", { scriptId: "s1", brandColor: "#000000", logoMediaId: "logo" }, "b1");
    expect(withText).toHaveBeenCalledWith(expect.anything(), "a", "#000000");
    expect([...putObject.mock.calls[0][1]]).toEqual([1, 7]);
    expect(logoBytes).not.toHaveBeenCalled();
  });

  it("says so when the brand has no logo", async () => {
    logoBytes.mockResolvedValue(null);
    const res = await generate("u1", { scriptId: "s1" }, "b1");
    expect(res).toMatchObject({ semLogo: true });
    expect([...putObject.mock.calls[0][1]]).toEqual([1]);
  });

  it("without an active brand behaves as before", async () => {
    activeKit.mockResolvedValue(null);
    await generate("u1", { scriptId: "s1" }, null);
    expect(withText).toHaveBeenCalledWith(expect.anything(), "a", null);
    expect(logoBytes).not.toHaveBeenCalled();
    expect(gen.generateImage.mock.calls[0][0]).not.toContain("Não mostre:");
  });
});
