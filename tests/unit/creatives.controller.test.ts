import { APIError } from "openai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const getScript = vi.fn();
const insertMedia = vi.fn();
const insertGeneration = vi.fn();
const runningVideos = vi.fn();
const finishGeneration = vi.fn();
const putObject = vi.fn();
const gen = {
  VIDEO_SIZE: { width: 720, height: 1280 },
  generateImage: vi.fn(),
  startVideo: vi.fn(),
  videoStatus: vi.fn(),
  downloadVideo: vi.fn(),
};

vi.mock("@/models/creative-script", () => ({ getScript }));
vi.mock("@/models/media", () => ({ insertMedia, getMediaForUser: vi.fn() }));
vi.mock("@/models/generation", () => ({ insertGeneration, runningVideos, finishGeneration, listGenerations: vi.fn() }));
vi.mock("@/lib/storage", () => ({ putObject, readObject: vi.fn() }));
vi.mock("@/services/creative-gen", () => gen);
vi.mock("@/services/overlay", () => ({
  withText: async (bytes: Uint8Array, text: string) => new Uint8Array([...bytes, text.length]),
  fitTo: async (bytes: Uint8Array) => bytes,
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

  it("static: stores nothing when one slide fails at the provider", async () => {
    getScript.mockResolvedValue({ id: "s1", segment: "dentista", format: "static", content: content(null) });
    gen.generateImage
      .mockResolvedValueOnce(new Uint8Array([1]))
      .mockRejectedValueOnce(new APIError(400, { code: "moderation_blocked" }, "blocked", new Headers()));

    await expect(generate("u1", { scriptId: "s1" })).rejects.toBeInstanceOf(DomainError);
    expect(putObject).not.toHaveBeenCalled();
    expect(insertMedia).not.toHaveBeenCalled();
  });

  it("video: starts the job and records it as running, without storing media", async () => {
    getScript.mockResolvedValue({ id: "s1", segment: "dentista", format: "video", content: content(4) });
    gen.startVideo.mockResolvedValue("job-1");

    const res = await generate("u1", { scriptId: "s1" });

    expect(res).toMatchObject({ status: "em produção", mediaIds: [] });
    expect(insertGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", kind: "video", provider_job_id: "job-1" }),
    );
    expect(putObject).not.toHaveBeenCalled();
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
