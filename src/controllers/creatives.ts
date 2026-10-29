import "server-only";
import { randomUUID } from "node:crypto";
import { APIError } from "openai";
import { videoPrompt, visualPrompt } from "@/agent/visual-prompt";
import { DomainError } from "@/lib/errors";
import { downloadUrl, putObject } from "@/lib/storage";
import { getScript } from "@/models/creative-script";
import { finishGeneration, insertGeneration, listGenerations, runningVideos } from "@/models/generation";
import { getMediaForUser, insertMedia } from "@/models/media";
import * as gen from "@/services/creative-gen";
import { fitTo, withText } from "@/services/overlay";

const VIDEO_TIMEOUT_MS = 60 * 60 * 1000;
const BATCH = 10;

async function store(userId: string, bytes: Uint8Array, kind: "image" | "video") {
  const mime = kind === "image" ? "image/jpeg" : "video/mp4";
  const storagePath = `${userId}/${randomUUID()}.${kind === "image" ? "jpg" : "mp4"}`;
  await putObject(storagePath, bytes, mime);
  return insertMedia({ user_id: userId, storage_path: storagePath, kind, mime_type: mime, size_bytes: bytes.byteLength });
}

// The user's own photo (e.g. the real product), so the model doesn't invent one.
async function referenceImage(userId: string, mediaId: string) {
  const [media] = await getMediaForUser([mediaId], userId);
  if (media.kind !== "image") throw new DomainError("invalid_media", "A referência precisa ser uma imagem JPEG.");
  const res = await fetch(await downloadUrl(media.storage_path));
  if (!res.ok) throw new Error(`reference download failed: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
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

export type GenerateResult = { status: "pronto" | "em produção"; mediaIds: string[]; generationId?: string };

// Static script: one image per slide, generated in parallel (well under the 300 s limit) and
// stored only after all succeed, so a failed slide leaves nothing behind.
// Video script: starts the job and returns at once; videoTick() finishes it.
export async function generate(
  userId: string,
  { scriptId, referenceMediaId }: { scriptId: string; referenceMediaId?: string | null },
): Promise<GenerateResult> {
  const script = await getScript(userId, scriptId);
  const brand = { segment: script.segment };
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
      script.content.blocks.map(async (block, i) => {
        const prompt = visualPrompt(script.content, i, brand);
        return { prompt, bytes: await withText(await gen.generateImage(prompt, reference), block.text) };
      }),
    ),
  );
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
