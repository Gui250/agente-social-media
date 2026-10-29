import "server-only";
import { admin } from "@/lib/supabase/admin";
import {
  accountsExpiringBefore,
  getAccessToken,
  saveToken,
  setAccountStatus,
} from "@/models/account";
import { getMediaForUser, signedUrl } from "@/models/media";
import { type PostRow, updatePost } from "@/models/post";
import * as instagram from "@/services/instagram";
import { advance, type PublisherDeps } from "@/services/publisher";

const BATCH = 20;
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Shared by the cron tick and "publicar agora". Uses the service role: there is no user session
// in cron, and posts are only touched through their own ids.
export function publisherDeps(): PublisherDeps {
  const db = admin();
  return {
    now: () => new Date(),
    instagram,
    account: async (accountId) => {
      const { data, error } = await db
        .from("connected_accounts")
        .select("ig_user_id, login_type")
        .eq("id", accountId)
        .single();
      if (error) throw error;
      const token = await getAccessToken(accountId);
      return { igUserId: data.ig_user_id, conn: instagram.connFor(data.login_type, token) };
    },
    mediaUrls: async (post) => {
      const media = await getMediaForUser(db, post.media_ids, post.user_id);
      return Promise.all(
        media.map(async (m) => ({ kind: m.kind, url: await signedUrl(db, m.storage_path, 3600) })),
      );
    },
    update: (post, from, patch) => updatePost(db, post.id, from, patch),
  };
}

export async function publishTick() {
  const db = admin();
  const { data: claimed, error } = await db.rpc("claim_due_posts", { batch: BATCH });
  if (error) throw error;
  const { data: inFlight, error: e2 } = await db
    .from("posts")
    .select()
    .eq("status", "publishing")
    .not("ig_container_id", "is", null)
    .limit(BATCH);
  if (e2) throw e2;

  const posts = new Map<string, PostRow>();
  for (const p of [...(claimed as PostRow[]), ...(inFlight as PostRow[])]) posts.set(p.id, p);

  const deps = publisherDeps();
  const results = await Promise.allSettled([...posts.values()].map((p) => advance(p, deps)));
  const counts = { claimed: (claimed as PostRow[]).length, published: 0, failed: 0, inProgress: 0, errors: 0 };
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

