import { DomainError } from "@/lib/errors";
import { assertTransition, type PostRow, type PostStatus } from "@/models/post";
import type { Conn, ContainerStatus } from "./instagram";

const MAX_DELAY_MS = 24 * 60 * 60 * 1000;

export type PublisherDeps = {
  now: () => Date;
  instagram: {
    getPublishingLimit(conn: Conn, igUserId: string): Promise<{ used: number; total: number }>;
    createImageContainer(conn: Conn, igUserId: string, a: { imageUrl: string; caption: string }): Promise<string>;
    createCarouselContainer(
      conn: Conn,
      igUserId: string,
      a: { items: { kind: "image" | "video"; url: string }[]; caption: string },
    ): Promise<string>;
    createReelContainer(conn: Conn, igUserId: string, a: { videoUrl: string; caption: string }): Promise<string>;
    getContainerStatus(conn: Conn, containerId: string): Promise<ContainerStatus>;
    publish(conn: Conn, igUserId: string, creationId: string): Promise<string>;
    getPermalink(conn: Conn, mediaId: string): Promise<string | null>;
  };
  account(accountId: string): Promise<{ igUserId: string; conn: Conn }>;
  mediaUrls(post: PostRow): Promise<{ kind: "image" | "video"; url: string }[]>;
  update(post: PostRow, from: PostStatus, patch: Partial<PostRow>): Promise<PostRow>;
};

// One step of publishing a post already in `publishing` (research.md › R8). Safe to call again
// on every cron tick: the saved container/media ids make each Instagram call happen at most once.
export async function advance(post: PostRow, deps: PublisherDeps): Promise<PostRow> {
  if (post.status !== "publishing") return post;

  const move = (to: PostStatus, patch: Partial<PostRow> = {}) => {
    assertTransition(post.status, to);
    return deps.update(post, post.status, { ...patch, status: to });
  };
  const fail = (reason: string) => move("failed", { failure_reason: reason });
  const done = (patch: Partial<PostRow>) =>
    move("published", { failure_reason: null, published_at: deps.now().toISOString(), ...patch });

  if (!post.account_id) return fail("conta desconectada");

  try {
    const { igUserId, conn } = await deps.account(post.account_id);

    if (post.ig_media_id) {
      return done({ permalink: post.permalink ?? (await deps.instagram.getPermalink(conn, post.ig_media_id)) });
    }

    if (!post.ig_container_id) {
      const due = post.scheduled_at ? new Date(post.scheduled_at).getTime() : deps.now().getTime();
      if (deps.now().getTime() - due > MAX_DELAY_MS) return fail("atraso maior que 24 h");

      const limit = await deps.instagram.getPublishingLimit(conn, igUserId);
      if (limit.used >= limit.total) {
        return fail("Limite diário de publicações do Instagram atingido. Tente de novo amanhã.");
      }

      const media = await deps.mediaUrls(post);
      const caption = post.caption;
      const containerId =
        post.post_type === "image"
          ? await deps.instagram.createImageContainer(conn, igUserId, { imageUrl: media[0].url, caption })
          : post.post_type === "reel"
            ? await deps.instagram.createReelContainer(conn, igUserId, { videoUrl: media[0].url, caption })
            : await deps.instagram.createCarouselContainer(conn, igUserId, { items: media, caption });
      post = await deps.update(post, "publishing", { ig_container_id: containerId });
    }

    const status = await deps.instagram.getContainerStatus(conn, post.ig_container_id!);
    if (status === "IN_PROGRESS") return post; // Reels: the next tick checks again
    if (status === "ERROR") return fail("O Instagram não conseguiu processar a mídia.");
    if (status === "EXPIRED") return fail("O Instagram expirou a mídia antes da publicação (24 h).");
    if (status === "PUBLISHED") return done({});

    const mediaId = await deps.instagram.publish(conn, igUserId, post.ig_container_id!);
    post = await deps.update(post, "publishing", { ig_media_id: mediaId }); // save before anything else
    return done({ permalink: await deps.instagram.getPermalink(conn, mediaId).catch(() => null) });
  } catch (e) {
    if (e instanceof DomainError) return fail(e.message);
    throw e; // network/unknown: stay in publishing, the next tick retries
  }
}
