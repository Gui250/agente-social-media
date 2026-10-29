import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "@/lib/errors";

export const MEDIA_BUCKET = "post-media";

export type MediaKind = "image" | "video";
export type MediaRow = {
  id: string;
  user_id: string;
  storage_path: string;
  kind: MediaKind;
  mime_type: "image/jpeg" | "video/mp4" | "video/quicktime";
  size_bytes: number;
};

export async function insertMedia(
  supabase: SupabaseClient,
  row: Omit<MediaRow, "id">,
): Promise<MediaRow> {
  const { data, error } = await supabase.from("media").insert(row).select().single();
  if (error) throw error;
  return data;
}

// Returns rows in the order of `ids`; 404 if any id is missing or belongs to someone else.
export async function getMediaForUser(
  supabase: SupabaseClient,
  ids: string[],
  userId: string,
): Promise<MediaRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("media")
    .select()
    .in("id", ids)
    .eq("user_id", userId);
  if (error) throw error;
  const byId = new Map((data as MediaRow[]).map((m) => [m.id, m]));
  return ids.map((id) => {
    const m = byId.get(id);
    if (!m) throw notFound("Mídia", "a");
    return m;
  });
}

export async function signedUrl(supabase: SupabaseClient, path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
