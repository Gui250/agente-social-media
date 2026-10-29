import "server-only";
import { sql } from "@/lib/db";
import { notFound } from "@/lib/errors";

export type MediaKind = "image" | "video";
export type MediaRow = {
  id: string;
  user_id: string;
  storage_path: string;
  kind: MediaKind;
  mime_type: "image/jpeg" | "video/mp4" | "video/quicktime";
  size_bytes: number;
};

export async function insertMedia(row: Omit<MediaRow, "id">): Promise<MediaRow> {
  const [media] = await sql()<MediaRow[]>`
    insert into media (user_id, storage_path, kind, mime_type, size_bytes)
    values (${row.user_id}, ${row.storage_path}, ${row.kind}, ${row.mime_type}, ${row.size_bytes})
    returning *`;
  return media;
}

// Returns rows in the order of `ids`; 404 if any id is missing or belongs to someone else.
export async function getMediaForUser(ids: string[], userId: string): Promise<MediaRow[]> {
  if (ids.length === 0) return [];
  const rows = await sql()<MediaRow[]>`
    select * from media where id = any(${ids}::uuid[]) and user_id = ${userId}`;
  const byId = new Map(rows.map((m) => [m.id, m]));
  return ids.map((id) => {
    const m = byId.get(id);
    if (!m) throw notFound("Mídia", "a");
    return m;
  });
}

// Like getMediaForUser but skips ids that no longer exist (e.g. released after publishing).
export async function findMediaForUser(ids: string[], userId: string): Promise<MediaRow[]> {
  if (ids.length === 0) return [];
  return sql()<MediaRow[]>`
    select * from media where id = any(${ids}::uuid[]) and user_id = ${userId}`;
}

// After a post is published: removes its media rows unless another post that can still be
// published uses them. Returns the storage paths to delete from Blob.
export async function releaseMedia(post: { id: string; user_id: string; media_ids: string[] }) {
  const rows = await sql()<{ storage_path: string }[]>`
    delete from media m
    where m.id = any(${post.media_ids}::uuid[]) and m.user_id = ${post.user_id}
      and not exists (
        select 1 from posts p
        where p.id <> ${post.id} and m.id = any(p.media_ids)
          and p.status in ('draft', 'scheduled', 'publishing', 'failed')
      )
    returning storage_path`;
  return rows.map((r) => r.storage_path);
}
