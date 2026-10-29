import { z } from "zod";
import { sql } from "@/lib/db";
import { DomainError, notFound } from "@/lib/errors";

export const PostStatus = z.enum([
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "cancelled",
]);
export type PostStatus = z.infer<typeof PostStatus>;

export const PostType = z.enum(["image", "carousel", "reel"]);
export type PostType = z.infer<typeof PostType>;

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "rascunho",
  scheduled: "agendado",
  publishing: "publicando",
  published: "publicado",
  failed: "falhou",
  cancelled: "cancelado",
};

// data-model.md › Máquina de estados. Every status change goes through assertTransition.
const TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  draft: ["scheduled", "publishing"],
  scheduled: ["scheduled", "cancelled", "publishing", "failed"],
  publishing: ["publishing", "published", "failed"],
  failed: ["publishing", "scheduled"],
  published: [],
  cancelled: [],
};

export function assertTransition(from: PostStatus, to: PostStatus) {
  if (!TRANSITIONS[from].includes(to)) {
    throw new DomainError(
      "invalid_transition",
      `Não é possível passar um post ${STATUS_LABEL[from]} para ${STATUS_LABEL[to]}.`,
      409,
    );
  }
}

export const isEditable = (status: PostStatus) =>
  status === "draft" || status === "scheduled" || status === "failed";

export type PostRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  script_id: string | null;
  post_type: PostType;
  caption: string;
  media_ids: string[];
  scheduled_at: string | null;
  status: PostStatus;
  ig_container_id: string | null;
  ig_media_id: string | null;
  permalink: string | null;
  failure_reason: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NewPost = Pick<
  PostRow,
  "user_id" | "account_id" | "script_id" | "post_type" | "caption" | "media_ids" | "scheduled_at" | "status"
>;

export async function insertPost(row: NewPost): Promise<PostRow> {
  const [post] = await sql()<PostRow[]>`insert into posts ${sql()(row)} returning *`;
  return post;
}

export async function listPosts(
  userId: string,
  filters: { status?: PostStatus; from?: string; to?: string } = {},
): Promise<PostRow[]> {
  const db = sql();
  return db<PostRow[]>`
    select * from posts
    where user_id = ${userId}
      ${filters.status ? db`and status = ${filters.status}` : db``}
      ${filters.from ? db`and scheduled_at >= ${filters.from}` : db``}
      ${filters.to ? db`and scheduled_at <= ${filters.to}` : db``}
    order by scheduled_at asc nulls last, created_at desc
    limit 100`;
}

export async function getPost(userId: string, id: string): Promise<PostRow> {
  const [row] = await sql()<PostRow[]>`select * from posts where id = ${id} and user_id = ${userId}`;
  if (!row) throw notFound("Post");
  return row;
}

type PostPatch = Partial<Omit<PostRow, "id" | "user_id" | "created_at" | "updated_at">>;

// Optimistic update: only applies if the post is still in `fromStatus` (409 otherwise), so two
// concurrent writers (UI, agent, cron) can't both move the same post. The owner check lives in
// the caller: posts come from getPost (user) or claim_due_posts (cron).
export async function updatePost(id: string, fromStatus: PostStatus, patch: PostPatch): Promise<PostRow> {
  const [row] = await sql()<PostRow[]>`
    update posts set ${sql()(patch)}
    where id = ${id} and status = ${fromStatus}
    returning *`;
  if (!row) {
    throw new DomainError(
      "conflict",
      "O post mudou enquanto você editava. Atualize a página e tente de novo.",
      409,
    );
  }
  return row;
}

// Cron only: atomically claims due posts (FR-017) and lists Reels still processing.
export async function claimDuePosts(batch: number): Promise<PostRow[]> {
  return sql()<PostRow[]>`select * from claim_due_posts(${batch})`;
}

export async function postsInFlight(batch: number): Promise<PostRow[]> {
  return sql()<PostRow[]>`
    select * from posts where status = 'publishing' and ig_container_id is not null limit ${batch}`;
}
