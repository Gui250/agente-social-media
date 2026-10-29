import "server-only";
import { readVisualIdentity } from "@/agent/brand-reader";
import { DomainError } from "@/lib/errors";
import { readObject } from "@/lib/storage";
import { getMediaForUser } from "@/models/media";

// Colors, logo and style from an image the user attached (logo or a piece of the brand).
// ponytail: lives only in the conversation; save per account when users ask to reuse it.
export async function extractIdentity(userId: string, mediaId: string) {
  const [media] = await getMediaForUser([mediaId], userId);
  if (media.kind !== "image") {
    throw new DomainError("invalid_media", "Para extrair a identidade visual, anexe o logo ou uma arte como imagem.");
  }
  return readVisualIdentity(await readObject(media.storage_path));
}
