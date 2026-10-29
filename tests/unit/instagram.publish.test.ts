import { afterEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";
import * as ig from "@/services/instagram";

const conn = ig.connFor("instagram", "tok");

type Call = { url: URL; method: string; body: URLSearchParams | null };
const calls: Call[] = [];

function mockFetch(responses: unknown[]) {
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL, init?: { method?: string; body?: URLSearchParams }) => {
      calls.push({ url: new URL(input), method: init?.method ?? "GET", body: init?.body ?? null });
      const res = responses[i++] ?? {};
      const status = (res as { error?: unknown }).error ? 400 : 200;
      return new Response(JSON.stringify(res), { status });
    }),
  );
}

afterEach(() => {
  calls.length = 0;
  vi.unstubAllGlobals();
});

describe("instagram publishing adapter", () => {
  it("creates an image container with image_url and caption", async () => {
    mockFetch([{ id: "c1" }]);
    const id = await ig.createImageContainer(conn, "IG1", { imageUrl: "https://x/a.jpg", caption: "Oi" });
    expect(id).toBe("c1");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url.pathname).toBe("/IG1/media");
    expect(Object.fromEntries(calls[0].body!)).toEqual({
      image_url: "https://x/a.jpg",
      caption: "Oi",
      access_token: "tok",
    });
  });

  it("creates carousel children with is_carousel_item, then a CAROUSEL container", async () => {
    mockFetch([{ id: "k1" }, { id: "k2" }, { id: "parent" }]);
    const id = await ig.createCarouselContainer(conn, "IG1", {
      items: [
        { kind: "image", url: "https://x/1.jpg" },
        { kind: "video", url: "https://x/2.mp4" },
      ],
      caption: "C",
    });
    expect(id).toBe("parent");
    expect(Object.fromEntries(calls[0].body!)).toMatchObject({ image_url: "https://x/1.jpg", is_carousel_item: "true" });
    expect(Object.fromEntries(calls[1].body!)).toMatchObject({
      media_type: "VIDEO",
      video_url: "https://x/2.mp4",
      is_carousel_item: "true",
    });
    expect(Object.fromEntries(calls[2].body!)).toMatchObject({ media_type: "CAROUSEL", children: "k1,k2", caption: "C" });
  });

  it("creates a reel with media_type=REELS and video_url", async () => {
    mockFetch([{ id: "r1" }]);
    await ig.createReelContainer(conn, "IG1", { videoUrl: "https://x/v.mp4", caption: "R" });
    expect(Object.fromEntries(calls[0].body!)).toMatchObject({ media_type: "REELS", video_url: "https://x/v.mp4", caption: "R" });
  });

  it("parses container status codes", async () => {
    for (const code of ["IN_PROGRESS", "FINISHED", "PUBLISHED", "ERROR", "EXPIRED"]) {
      mockFetch([{ status_code: code, id: "c1" }]);
      expect(await ig.getContainerStatus(conn, "c1")).toBe(code);
      expect(calls.at(-1)!.url.searchParams.get("fields")).toBe("status_code");
    }
  });

  it("publishes with creation_id", async () => {
    mockFetch([{ id: "m1" }]);
    expect(await ig.publish(conn, "IG1", "c1")).toBe("m1");
    expect(calls[0].url.pathname).toBe("/IG1/media_publish");
    expect(calls[0].body!.get("creation_id")).toBe("c1");
  });

  it("reads the publishing limit", async () => {
    mockFetch([{ data: [{ quota_usage: 3, config: { quota_total: 100 } }] }]);
    expect(await ig.getPublishingLimit(conn, "IG1")).toEqual({ used: 3, total: 100 });
  });

  it("Facebook-login accounts publish through graph.facebook.com/v26.0 with the same calls", async () => {
    mockFetch([{ id: "c9" }]);
    await ig.createImageContainer(ig.connFor("facebook", "page-tok"), "IG9", { imageUrl: "https://x/a.jpg", caption: "" });
    expect(calls[0].url.origin + calls[0].url.pathname).toBe("https://graph.facebook.com/v26.0/IG9/media");
    expect(calls[0].body!.get("access_token")).toBe("page-tok");
  });

  it("maps error code 190 to an expired-account DomainError", async () => {
    mockFetch([{ error: { code: 190, message: "Error validating access token" } }]);
    const err = await ig.publish(conn, "IG1", "c1").catch((e) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect(err.message).toBe("Conta Instagram expirada, reconecte em Contas.");
  });
});
