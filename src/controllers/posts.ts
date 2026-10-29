import "server-only";
import { z } from "zod";
import { formatInTimeZone } from "@/lib/datetime";
import { DomainError } from "@/lib/errors";
import { getAccount } from "@/models/account";
import { getMediaForUser } from "@/models/media";
import {
  assertTransition,
  getPost,
  insertPost,
  isEditable,
  listPosts,
  type PostRow,
  PostStatus,
  PostType,
  updatePost,
} from "@/models/post";
import { advance } from "@/services/publisher";
import { publisherDeps } from "./cron";
import { validatePostInput } from "./post-validation";

export const PostInput = z.object({
  accountId: z.uuid(),
  postType: PostType,
  caption: z.string(),
  mediaIds: z.array(z.uuid()).min(1).max(20),
  scheduledAt: z.string().nullish(),
  scriptId: z.uuid().nullish(),
});
export type PostInput = z.infer<typeof PostInput>;

export const PostPatch = PostInput.partial();
export type PostPatch = z.infer<typeof PostPatch>;

async function validate(userId: string, input: PostInput) {
  // The agent passes ids as plain strings; reject malformed ones before they reach Postgres.
  if (!PostInput.safeParse(input).success) {
    throw new DomainError("invalid_post", "Dados do post inválidos: confira a conta e as mídias.");
  }
  const [account, media] = await Promise.all([
    getAccount(userId, input.accountId),
    getMediaForUser(input.mediaIds, userId),
  ]);
  const { scheduledAt } = validatePostInput(input, { now: new Date(), media, account });
  return { account, scheduledAt };
}

// No date → draft; with a date → scheduled. Callers confirm with the user first (FR-010).
export async function create(userId: string, input: PostInput) {
  const { scheduledAt } = await validate(userId, input);
  return insertPost({
    user_id: userId,
    account_id: input.accountId,
    script_id: input.scriptId ?? null,
    post_type: input.postType,
    caption: input.caption,
    media_ids: input.mediaIds,
    scheduled_at: scheduledAt?.toISOString() ?? null,
    status: scheduledAt ? "scheduled" : "draft",
  });
}

export async function schedule(userId: string, input: PostInput) {
  if (!input.scheduledAt) throw new DomainError("invalid_post", "Informe a data e o horário do post.");
  return create(userId, input);
}

function toInput(post: PostRow): PostInput {
  return {
    accountId: post.account_id ?? "",
    postType: post.post_type,
    caption: post.caption,
    mediaIds: post.media_ids,
    scheduledAt: post.scheduled_at,
    scriptId: post.script_id,
  };
}

export async function update(userId: string, id: string, patch: PostPatch) {
  const post = await getPost(userId, id);
  if (!isEditable(post.status)) {
    throw new DomainError("not_editable", "Este post não pode mais ser editado.", 409);
  }
  const merged = { ...toInput(post), ...patch };
  if (!merged.accountId) {
    throw new DomainError("invalid_post", "Escolha uma conta Instagram para este post.");
  }
  // Re-validating an untouched past date would always fail: only check dates the user sends.
  const dateChanged = patch.scheduledAt !== undefined;
  const { scheduledAt } = await validate(userId, {
    ...merged,
    scheduledAt: dateChanged ? merged.scheduledAt : null,
  });

  if (dateChanged && !scheduledAt && post.status === "scheduled") {
    throw new DomainError("invalid_post", "Para tirar o agendamento, cancele o post.", 409);
  }
  let status = post.status;
  if (dateChanged && scheduledAt) status = "scheduled";
  if (status !== post.status) assertTransition(post.status, status);

  return updatePost(id, post.status, {
    account_id: merged.accountId,
    post_type: merged.postType,
    caption: merged.caption,
    media_ids: merged.mediaIds,
    script_id: merged.scriptId ?? null,
    ...(dateChanged && { scheduled_at: scheduledAt?.toISOString() ?? null }),
    status,
    ...(status === "scheduled" && { failure_reason: null }),
  });
}

export async function cancel(userId: string, id: string) {
  const post = await getPost(userId, id);
  if (post.status !== "scheduled") {
    throw new DomainError("not_cancellable", "Só posts agendados podem ser cancelados.", 409);
  }
  assertTransition(post.status, "cancelled");
  return updatePost(id, post.status, { status: "cancelled" });
}

// Publishes immediately (after the user confirmed). An existing draft/scheduled/failed post, or a
// new one from the agent's fields. One publisher step runs now; Reels finish on later cron ticks.
export async function publishNow(
  userId: string,
  target: { postId: string } | PostInput,
) {
  let post: PostRow;
  if ("postId" in target) {
    post = await getPost(userId, target.postId);
    if (!post.account_id) {
      throw new DomainError("invalid_post", "Escolha uma conta Instagram para este post.");
    }
    await validate(userId, { ...toInput(post), scheduledAt: null });
  } else {
    post = await create(userId, { ...target, scheduledAt: null });
  }
  assertTransition(post.status, "publishing");
  post = await updatePost(post.id, post.status, {
    status: "publishing",
    scheduled_at: new Date().toISOString(),
    failure_reason: null,
    ig_container_id: null, // a failed container can't be reused; a fresh one is harmless
  });
  return advance(post, publisherDeps());
}

export const ListFilters = z.object({
  status: PostStatus.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function list(
  userId: string,
  timezone: string,
  filters: z.infer<typeof ListFilters> = {},
) {
  const rows = await listPosts(userId, filters);
  return rows.map((p) => ({
    ...p,
    scheduledAtLocal: p.scheduled_at ? formatInTimeZone(p.scheduled_at, timezone) : null,
  }));
}
