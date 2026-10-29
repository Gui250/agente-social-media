import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainError, notFound } from "@/lib/errors";
import { admin } from "@/lib/supabase/admin";
import { insertMedia, MEDIA_BUCKET, type MediaRow } from "@/models/media";

const IMAGE_MAX = 8 * 1024 * 1024;
const KIND: Record<string, MediaRow["kind"]> = {
  "image/jpeg": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
};

// The browser uploads straight to Storage (contracts/http-api.md › Mídia); here we only check the
// object's real metadata and register it. Invalid files are deleted.
export async function register(supabase: SupabaseClient, userId: string, storagePath: string) {
  const [folder, ...rest] = storagePath.split("/");
  const fileName = rest.join("/");
  if (folder !== userId || !fileName || storagePath.includes("..")) throw notFound("Mídia", "a");

  const storage = admin().storage.from(MEDIA_BUCKET);
  const { data: info, error } = await storage.info(storagePath);
  if (error || !info) throw notFound("Mídia", "a");

  const mime = String(info.contentType ?? "");
  const size = Number(info.size ?? 0);
  const kind = KIND[mime];
  const reject = async (message: string) => {
    await storage.remove([storagePath]);
    throw new DomainError("invalid_media", message);
  };
  if (!kind) return reject("Formato não suportado: envie imagem JPEG ou vídeo MP4/MOV.");
  if (kind === "image" && size > IMAGE_MAX) return reject("A imagem passa de 8 MB.");

  return insertMedia(supabase, {
    user_id: userId,
    storage_path: storagePath,
    kind,
    mime_type: mime as MediaRow["mime_type"],
    size_bytes: size,
  });
}
