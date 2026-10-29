import { describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";
import type { PostRow } from "@/models/post";
import { advance, type PublisherDeps } from "@/services/publisher";

const NOW = new Date("2026-10-29T12:00:00Z");
const conn = { token: "tok", base: "https://graph.example" };

function makePost(patch: Partial<PostRow> = {}): PostRow {
  return {
    id: "p1",
    user_id: "u1",
    account_id: "a1",
    script_id: null,
    post_type: "image",
    caption: "Oi",
    media_ids: ["m1"],
    scheduled_at: "2026-10-29T11:59:00Z",
    status: "publishing",
    ig_container_id: null,
    ig_media_id: null,
    permalink: null,
    failure_reason: null,
    published_at: null,
    created_at: "",
    updated_at: "",
    ...patch,
  };
}

function makeDeps(overrides: Partial<PublisherDeps["instagram"]> = {}) {
  const instagram = {
    getPublishingLimit: vi.fn(async () => ({ used: 0, total: 100 })),
    createImageContainer: vi.fn(async () => "c1"),
    createCarouselContainer: vi.fn(async () => "c1"),
    createReelContainer: vi.fn(async () => "c1"),
    getContainerStatus: vi.fn(async () => "FINISHED" as const),
    publish: vi.fn(async () => "m1"),
    getPermalink: vi.fn(async () => "https://instagram.com/p/xyz"),
    ...overrides,
  };
  const deps: PublisherDeps = {
    now: () => NOW,
    instagram,
    account: async () => ({ igUserId: "IG1", conn }),
    mediaUrls: async () => [{ kind: "image" as const, url: "https://signed/1.jpg" }],
    update: vi.fn(async (post: PostRow, _from, patch) => ({ ...post, ...patch })),
  };
  return { deps, instagram };
}

describe("publisher.advance", () => {
  it("FINISHED → publishes and marks published with permalink", async () => {
    const { deps, instagram } = makeDeps();
    const post = await advance(makePost(), deps);
    expect(instagram.createImageContainer).toHaveBeenCalledOnce();
    expect(instagram.publish).toHaveBeenCalledWith(conn, "IG1", "c1");
    expect(post.status).toBe("published");
    expect(post.ig_media_id).toBe("m1");
    expect(post.permalink).toBe("https://instagram.com/p/xyz");
    expect(post.published_at).toBe(NOW.toISOString());
  });

  it("never creates a second container when ig_container_id is set", async () => {
    const { deps, instagram } = makeDeps();
    await advance(makePost({ ig_container_id: "c-existing" }), deps);
    expect(instagram.createImageContainer).not.toHaveBeenCalled();
    expect(instagram.getContainerStatus).toHaveBeenCalledWith(conn, "c-existing");
  });

  it("never calls publish when ig_media_id is set", async () => {
    const { deps, instagram } = makeDeps();
    const post = await advance(makePost({ ig_container_id: "c1", ig_media_id: "m-existing" }), deps);
    expect(instagram.publish).not.toHaveBeenCalled();
    expect(post.status).toBe("published");
  });

  it("IN_PROGRESS keeps the post publishing", async () => {
    const { deps, instagram } = makeDeps({ getContainerStatus: vi.fn(async () => "IN_PROGRESS" as const) });
    const post = await advance(makePost({ post_type: "reel" }), deps);
    expect(post.status).toBe("publishing");
    expect(post.ig_container_id).toBe("c1");
    expect(instagram.publish).not.toHaveBeenCalled();
  });

  it("PUBLISHED container → published without calling publish", async () => {
    const { deps, instagram } = makeDeps({ getContainerStatus: vi.fn(async () => "PUBLISHED" as const) });
    const post = await advance(makePost({ ig_container_id: "c1" }), deps);
    expect(instagram.publish).not.toHaveBeenCalled();
    expect(post.status).toBe("published");
  });

  it.each(["ERROR", "EXPIRED"] as const)("%s container → failed with a readable reason", async (code) => {
    const { deps } = makeDeps({ getContainerStatus: vi.fn(async () => code) });
    const post = await advance(makePost({ ig_container_id: "c1" }), deps);
    expect(post.status).toBe("failed");
    expect(post.failure_reason).toMatch(/Instagram/);
  });

  it("claimed more than 24 h late → failed", async () => {
    const { deps, instagram } = makeDeps();
    const post = await advance(makePost({ scheduled_at: "2026-10-28T11:00:00Z" }), deps);
    expect(post.status).toBe("failed");
    expect(post.failure_reason).toBe("atraso maior que 24 h");
    expect(instagram.createImageContainer).not.toHaveBeenCalled();
  });

  it("publishing limit exhausted → failed with reason", async () => {
    const { deps, instagram } = makeDeps({ getPublishingLimit: vi.fn(async () => ({ used: 100, total: 100 })) });
    const post = await advance(makePost(), deps);
    expect(post.status).toBe("failed");
    expect(post.failure_reason).toMatch(/limite/i);
    expect(instagram.createImageContainer).not.toHaveBeenCalled();
  });

  it("Instagram DomainError → failed with its message", async () => {
    const { deps } = makeDeps({
      createImageContainer: vi.fn(async () => {
        throw new DomainError("account_expired", "Conta Instagram expirada, reconecte em Contas.", 502);
      }),
    });
    const post = await advance(makePost(), deps);
    expect(post.status).toBe("failed");
    expect(post.failure_reason).toBe("Conta Instagram expirada, reconecte em Contas.");
  });
});
