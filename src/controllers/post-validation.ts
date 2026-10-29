import { DomainError, notFound } from "@/lib/errors";
import type { MediaKind } from "@/models/media";
import type { PostType } from "@/models/post";

export const CAPTION_MAX = 2200;
export const HASHTAG_MAX = 30;
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export type PostInput = {
  postType: PostType;
  caption: string;
  mediaIds: string[];
  scheduledAt?: string | null;
};

const invalid = (message: string) => new DomainError("invalid_post", message);

// Pure: every write path (UI, agent, publish now) runs this before touching the database.
export function validatePostInput(
  input: PostInput,
  deps: {
    now: Date;
    media: { id: string; kind: MediaKind }[]; // already filtered to the user's media
    account: { status: string };
  },
): { scheduledAt: Date | null } {
  if (deps.media.length !== input.mediaIds.length) throw notFound("Mídia", "a");

  if (deps.account.status !== "active") {
    throw new DomainError(
      "account_inactive",
      "Conta Instagram expirada, reconecte em Contas.",
    );
  }

  if (input.caption.length > CAPTION_MAX) {
    throw invalid(`A legenda tem ${input.caption.length} caracteres; o limite é ${CAPTION_MAX}.`);
  }
  const hashtags = input.caption.match(/#[^\s#]+/g)?.length ?? 0;
  if (hashtags > HASHTAG_MAX) {
    throw invalid(`A legenda tem ${hashtags} hashtags; o Instagram aceita até ${HASHTAG_MAX}.`);
  }

  const kinds = deps.media.map((m) => m.kind);
  if (input.postType === "image" && !(kinds.length === 1 && kinds[0] === "image")) {
    throw invalid("Post de imagem precisa de exatamente 1 imagem.");
  }
  if (input.postType === "carousel" && (kinds.length < 2 || kinds.length > 20)) {
    throw invalid("Carrossel precisa de 2 a 20 mídias.");
  }
  if (input.postType === "reel" && !(kinds.length === 1 && kinds[0] === "video")) {
    throw invalid("Reels precisa de exatamente 1 vídeo.");
  }

  if (!input.scheduledAt) return { scheduledAt: null };
  if (!ISO_WITH_OFFSET.test(input.scheduledAt)) {
    throw invalid("Data inválida: use data e hora com fuso, ex.: 2026-10-30T10:00:00-03:00.");
  }
  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) throw invalid("Data inválida.");
  if (scheduledAt <= deps.now) throw invalid("Essa data está no passado. Escolha um horário futuro.");
  return { scheduledAt };
}
