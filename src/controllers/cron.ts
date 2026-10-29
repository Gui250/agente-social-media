import "server-only";
import { downloadUrl, removeObjects } from "@/lib/storage";
import {
  accountsExpiringBefore,
  getAccessToken,
  getPublishingAccount,
  saveToken,
  setAccountStatus,
} from "@/models/account";
import { getMediaForUser, releaseMedia } from "@/models/media";
import { claimDuePosts, type PostRow, postsInFlight, updatePost } from "@/models/post";
import * as instagram from "@/services/instagram";
import { advance, type PublisherDeps } from "@/services/publisher";

const BATCH = 20;
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Shared by the cron tick and "publicar agora". There is no user session in cron: posts are
// only touched through their own ids, and media is looked up for the post's owner.
export function publisherDeps(): PublisherDeps {
  return {
    now: () => new Date(),
    instagram,
    account: async (accountId) => {
      const account = await getPublishingAccount(accountId);
      const token = await getAccessToken(accountId);
      return { igUserId: account.ig_user_id, conn: instagram.connFor(account.login_type, token) };
    },
    mediaUrls: async (post) => {
      const media = await getMediaForUser(post.media_ids, post.user_id);
      return Promise.all(media.map(async (m) => ({ kind: m.kind, url: await downloadUrl(m.storage_path) })));
    },
    update: async (post, from, patch) => {
      const row = await updatePost(post.id, from, patch);
      if (row.status === "published") await cleanUp(row);
      return row;
    },
  };
}

// Instagram keeps its own copy once published, so the file only costs Blob space (1 GB on Hobby).
// Best effort: a failed cleanup must never undo a publish.
async function cleanUp(post: PostRow) {
  try {
    await removeObjects(await releaseMedia(post));
  } catch (e) {
    console.error("cleanUp:", post.id, e);
  }
}

export async function publishTick() {
  const claimed = await claimDuePosts(BATCH);
  const inFlight = await postsInFlight(BATCH);

  const posts = new Map<string, PostRow>();
  for (const p of [...claimed, ...inFlight]) posts.set(p.id, p);

  const deps = publisherDeps();
  const results = await Promise.allSettled([...posts.values()].map((p) => advance(p, deps)));
  const counts = { claimed: claimed.length, published: 0, failed: 0, inProgress: 0, errors: 0 };
  for (const r of results) {
    if (r.status === "rejected") {
      counts.errors++;
      console.error("publishTick:", r.reason);
    } else if (r.value.status === "published") counts.published++;
    else if (r.value.status === "failed") counts.failed++;
    else counts.inProgress++;
  }
  return counts;
}

export async function refreshTokens() {
  const due = await accountsExpiringBefore(new Date(Date.now() + REFRESH_WINDOW_MS));
  let refreshed = 0;
  let expired = 0;
  for (const account of due) {
    try {
      const { accessToken, expiresAt } = await instagram.refreshToken(await getAccessToken(account.id));
      await saveToken(account.id, accessToken, expiresAt);
      refreshed++;
    } catch (e) {
      console.error("refreshTokens:", account.id, e);
      await setAccountStatus(account.id, "expired");
      expired++;
    }
  }
  return { refreshed, expired };
}

