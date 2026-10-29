import "server-only";
import { randomUUID } from "node:crypto";
import { APIError } from "openai";
import { type ArtReview, approved, reviewArt } from "@/agent/art-critic";
import { videoPrompt, visualPrompt } from "@/agent/visual-prompt";
import { DomainError } from "@/lib/errors";
import { putObject, readObject } from "@/lib/storage";
import { type CreativeScript, getScript } from "@/models/creative-script";
import { finishGeneration, insertGeneration, listGenerations, runningVideos } from "@/models/generation";
import { getMediaForUser, insertMedia } from "@/models/media";
import * as gen from "@/services/creative-gen";
import { fitTo, withLogo, withText } from "@/services/overlay";

const VIDEO_TIMEOUT_MS = 60 * 60 * 1000;
const BATCH = 10;
const HEX = /^#[0-9a-f]{6}$/i;

async function store(userId: string, bytes: Uint8Array, kind: "image" | "video") {
  const mime = kind === "image" ? "image/jpeg" : "video/mp4";
  const storagePath = `${userId}/${randomUUID()}.${kind === "image" ? "jpg" : "mp4"}`;
  await putObject(storagePath, bytes, mime);
  return insertMedia({ user_id: userId, storage_path: storagePath, kind, mime_type: mime, size_bytes: bytes.byteLength });
}

// The user's own photo (e.g. the real product, so the model doesn't invent one) or their logo.
async function referenceImage(userId: string, mediaId: string) {
  const [media] = await getMediaForUser([mediaId], userId);
  if (media.kind !== "image") throw new DomainError("invalid_media", "A referência precisa ser uma imagem JPEG.");
  return readObject(media.storage_path);
}

// Provider errors become messages the agent can explain; anything else is a bug and propagates.
async function provider<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof APIError)) throw e;
    console.error("creative-gen:", e.status, e.code, e.message);
    const message =
      e.code === "moderation_blocked"
        ? "O gerador recusou o pedido por conteúdo sensível. Ajuste a cena do roteiro e tente de novo."
        : "O gerador de imagens e vídeos falhou. Tente de novo em alguns minutos.";
    throw new DomainError("generation_failed", message, 502);
  }
}

// Best effort: a critic failure never blocks the art, it just goes out unreviewed.
async function review(bytes: Uint8Array, script: CreativeScript, index: number): Promise<ArtReview | null> {
  try {
    const r = await reviewArt(bytes, { idea: script.hook, text: script.blocks[index].text, artDirection: script.artDirection });
    console.log("art review:", { slide: index + 1, score: r.score, critical: r.critical });
    return r;
  } catch (e) {
    console.error("art review failed:", e);
    return null;
  }
}

// One slide: generate, have the critic score it, and redo a rejected one once with the critic's
// fixes, keeping the better of the two. ponytail: up to 2 images per slide; a second retry would
// risk the 300 s request limit.
async function slideImage(
  script: CreativeScript,
  index: number,
  brand: { segment: string; color: string | null },
  reference?: Uint8Array,
) {
  const make = async (prompt: string) => ({
    prompt,
    bytes: await withText(await gen.generateImage(prompt, reference), script.blocks[index].text, brand.color),
  });
  const first = await make(visualPrompt(script, index, brand));
  const firstReview = await review(first.bytes, script, index);
  if (!firstReview || approved(firstReview)) return first;

  const second = await make(`${first.prompt}
Corrija em relação à versão anterior: ${[...firstReview.critical, firstReview.fixes].join(" ")}`);
  const secondReview = await review(second.bytes, script, index);
  const better = secondReview && (approved(secondReview) || secondReview.score > firstReview.score);
  return better ? second : first;
}

export type GenerateResult = { status: "pronto" | "em produção"; mediaIds: string[]; generationId?: string };

// Static script: one reviewed image per slide (slideImage), generated in parallel (well under the 300 s limit) and
// stored only after all succeed, so a failed slide leaves nothing behind.
// The logo goes on after the review, so the critic never takes the real logo for an invented one.
// Video script: starts the job and returns at once; videoTick() finishes it.
// ponytail: brand color and logo only reach images; a video would need ffmpeg to burn them in.
export async function generate(
  userId: string,
  input: { scriptId: string; referenceMediaId?: string | null; brandColor?: string | null; logoMediaId?: string | null },
): Promise<GenerateResult> {
  const { scriptId, referenceMediaId, brandColor, logoMediaId } = input;
  const script = await getScript(userId, scriptId);
  if (brandColor && !HEX.test(brandColor)) {
    throw new DomainError("invalid_input", "A cor da marca precisa estar no formato #RRGGBB.");
  }
  const brand = { segment: script.segment, color: brandColor?.toUpperCase() ?? null };
  const reference = referenceMediaId ? await referenceImage(userId, referenceMediaId) : undefined;

  if (script.format === "video") {
    const prompt = videoPrompt(script.content, brand);
    const firstFrame = reference && (await fitTo(reference, gen.VIDEO_SIZE));
    const jobId = await provider(() => gen.startVideo(prompt, firstFrame));
    const row = await insertGeneration({ user_id: userId, script_id: scriptId, kind: "video", prompt, provider_job_id: jobId });
    return { status: "em produção", mediaIds: [], generationId: row.id };
  }

  const images = await provider(() =>
    Promise.all(
      script.content.blocks.map((_, i) => slideImage(script.content, i, brand, reference)),
    ),
  );
  if (logoMediaId) {
    const logo = await referenceImage(userId, logoMediaId);
    for (const image of images) image.bytes = await withLogo(image.bytes, logo);
  }
  const mediaIds: string[] = [];
  for (const { prompt, bytes } of images) {
    const media = await store(userId, bytes, "image");
    await insertGeneration({ user_id: userId, script_id: scriptId, kind: "image", prompt, status: "done", media_id: media.id });
    mediaIds.push(media.id);
  }
  return { status: "pronto", mediaIds };
}

export const list = listGenerations;

// Called by /api/cron/publish on every tick. No user session: jobs are touched by their own ids.
// ponytail: no claim before the download, so two overlapping ticks can both store a finished
// video; finishGeneration() keeps only one and the other file stays orphaned in Blob. Add a
// 'saving' status if ticks ever overlap.
export async function videoTick() {
  const counts = { done: 0, failed: 0, running: 0, errors: 0 };
  for (const g of await runningVideos(BATCH)) {
    const expired = Date.now() - Date.parse(g.created_at) > VIDEO_TIMEOUT_MS;
    try {
      const { status, error } = await gen.videoStatus(g.provider_job_id ?? "");
      if (status === "completed") {
        const media = await store(g.user_id, await gen.downloadVideo(g.provider_job_id ?? ""), "video");
        await finishGeneration(g.id, { status: "done", media_id: media.id });
        counts.done++;
      } else if (status === "failed" || expired) {
        const reason = status === "failed" ? (error ?? "O gerador não conseguiu criar o vídeo.") : "Tempo esgotado.";
        await finishGeneration(g.id, { status: "failed", failure_reason: reason });
        counts.failed++;
      } else counts.running++;
    } catch (e) {
      counts.errors++;
      console.error("videoTick:", g.id, e);
      // A job the provider no longer knows would otherwise be polled forever.
      if (expired) await finishGeneration(g.id, { status: "failed", failure_reason: "Tempo esgotado." });
    }
  }
  return counts;
}
