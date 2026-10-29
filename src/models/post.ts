import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
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

export async function insertPost(supabase: SupabaseClient, row: NewPost): Promise<PostRow> {
  const { data, error } = await supabase.from("posts").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function listPosts(
  supabase: SupabaseClient,
  filters: { status?: PostStatus; from?: string; to?: string } = {},
): Promise<PostRow[]> {
  let q = supabase
    .from("posts")
    .select()
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.from) q = q.gte("scheduled_at", filters.from);
  if (filters.to) q = q.lte("scheduled_at", filters.to);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getPost(supabase: SupabaseClient, id: string): Promise<PostRow> {
  const { data, error } = await supabase.from("posts").select().eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Post");
  return data;
}

// Optimistic update: only applies if the post is still in `fromStatus` (409 otherwise), so two
// concurrent writers (UI, agent, cron) can't both move the same post.
export async function updatePost(
  supabase: SupabaseClient,
  id: string,
  fromStatus: PostStatus,
  patch: Partial<Omit<PostRow, "id" | "user_id" | "created_at" | "updated_at">>,
): Promise<PostRow> {
  const { data, error } = await supabase
    .from("posts")
    .update(patch)
    .eq("id", id)
    .eq("status", fromStatus)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new DomainError(
      "conflict",
      "O post mudou enquanto você editava. Atualize a página e tente de novo.",
      409,
    );
  }
  return data;
}
