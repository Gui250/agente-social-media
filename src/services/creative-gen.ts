import "server-only";
import OpenAI, { toFile } from "openai";
import { env } from "@/lib/env";

// The only place that talks to the image/video provider. Same OPENAI_API_KEY as the agent.
let client: OpenAI | undefined;
const openai = () => (client ??= new OpenAI({ apiKey: env().OPENAI_API_KEY }));

// 4:5 at 1088x1360 (both divisible by 16, as gpt-image-2 requires): the feed format, as JPEG,
// the only image type the publisher accepts. `reference` is the user's real product photo.
export const IMAGE_SIZE = { width: 1088, height: 1360 };
export const VIDEO_SIZE = { width: 720, height: 1280 };

export async function generateImage(prompt: string, reference?: Uint8Array): Promise<Uint8Array> {
  const params = {
    model: env().IMAGE_MODEL,
    prompt,
    size: `${IMAGE_SIZE.width}x${IMAGE_SIZE.height}`,
    output_format: "jpeg",
    quality: "high",
  } as const;
  const res = reference
    ? await openai().images.edit({ ...params, image: await toFile(reference, "ref.jpg", { type: "image/jpeg" }) })
    : await openai().images.generate(params);
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image API returned no image");
  return Buffer.from(b64, "base64");
}

// `firstFrame` must already be VIDEO_SIZE (see fitTo in overlay.tsx).
export async function startVideo(prompt: string, firstFrame?: Uint8Array) {
  const job = await openai().videos.create({
    model: env().VIDEO_MODEL,
    prompt,
    seconds: "12",
    size: "720x1280", // = VIDEO_SIZE
    input_reference: firstFrame ? await toFile(firstFrame, "frame.jpg", { type: "image/jpeg" }) : undefined,
  });
  return job.id;
}

export async function videoStatus(jobId: string) {
  const job = await openai().videos.retrieve(jobId);
  return { status: job.status, error: job.error?.message };
}

export async function downloadVideo(jobId: string): Promise<Uint8Array> {
  const res = await openai().videos.downloadContent(jobId);
  return new Uint8Array(await res.arrayBuffer());
}
