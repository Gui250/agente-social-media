import "server-only";
import { readReferences, readVisualIdentity, searchReferences } from "@/agent/brand-reader";
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

export const MAX_REFERENCES = 5;

async function referenceImages(userId: string, mediaIds: string[]) {
  const ids = [...new Set(mediaIds)];
  if (ids.length === 0 || ids.length > MAX_REFERENCES) {
    throw new DomainError("invalid_input", `Envie de 1 a ${MAX_REFERENCES} imagens.`);
  }
  const media = await getMediaForUser(ids, userId);
  if (media.some((m) => m.kind !== "image")) {
    throw new DomainError("invalid_media", "As referências precisam ser imagens.");
  }
  return Promise.all(media.map((m) => readObject(m.storage_path)));
}

// The recipe behind creatives the user attached as examples (theirs or ads they like).
// Not stored, like the identity: the agent passes a summary to generate_creative_script.references.
export async function analyzeReferences(userId: string, mediaIds: string[]) {
  return readReferences(await referenceImages(userId, mediaIds));
}

// Agency campaigns found on the web for what the attached media shows. Not stored either: the
// agent shows the links and passes the recipe to generate_creative_script.references.
export async function researchReferences(userId: string, mediaIds: string[], brief: string | null) {
  return searchReferences(await referenceImages(userId, mediaIds), brief?.trim().slice(0, 500) || null);
}
