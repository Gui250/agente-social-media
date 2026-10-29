import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { DomainError, notFound } from "@/lib/errors";
import { objectInfo, putObject, readObject, removeObjects, uploadUrl } from "@/lib/storage";
import { insertMedia, type MediaRow } from "@/models/media";

const IMAGE_MAX = 8 * 1024 * 1024;
const PNG_MAX = 20 * 1024 * 1024; // converted to a (much smaller) JPEG on register
const VIDEO_MAX = 100 * 1024 * 1024;
const TYPES: Record<string, { kind: MediaRow["kind"]; ext: string; max: number }> = {
  "image/jpeg": { kind: "image", ext: "jpg", max: IMAGE_MAX },
  "image/png": { kind: "image", ext: "png", max: PNG_MAX },
  "video/mp4": { kind: "video", ext: "mp4", max: VIDEO_MAX },
  "video/quicktime": { kind: "video", ext: "mov", max: VIDEO_MAX },
};
const unsupported = "Formato não suportado: envie imagem JPEG ou PNG, ou vídeo MP4/MOV.";

export const UploadRequest = z.object({ mimeType: z.string().max(100) });

// The browser uploads straight to the Blob store (contracts/http-api.md › Mídia) under "<userId>/".
export async function requestUpload(userId: string, mimeType: string) {
  const type = TYPES[mimeType];
  if (!type) throw new DomainError("invalid_media", unsupported);
  const storagePath = `${userId}/${randomUUID()}.${type.ext}`;
  return { storagePath, uploadUrl: await uploadUrl(storagePath, mimeType, type.max) };
}

// After the upload: check the object's real metadata and register it. Invalid files are deleted.
export async function register(userId: string, storagePath: string) {
  const [folder, ...rest] = storagePath.split("/");
  const fileName = rest.join("/");
  if (folder !== userId || !fileName || storagePath.includes("..")) throw notFound("Mídia", "a");

  const info = await objectInfo(storagePath);
  if (!info) throw notFound("Mídia", "a");

  const kind = TYPES[info.contentType]?.kind;
  const reject = async (message: string) => {
    await removeObjects([storagePath]);
    throw new DomainError("invalid_media", message);
  };
  if (!kind) return reject(unsupported);
  if (info.contentType === "image/png") {
    if (info.size > PNG_MAX) return reject("A imagem PNG passa de 20 MB.");
    return registerPngAsJpeg(userId, storagePath, reject);
  }
  if (kind === "image" && info.size > IMAGE_MAX) return reject("A imagem passa de 8 MB.");
  if (kind === "video" && info.size > VIDEO_MAX) return reject("O vídeo passa de 100 MB.");

  return insertMedia({
    user_id: userId,
    storage_path: storagePath,
    kind,
    mime_type: info.contentType as MediaRow["mime_type"],
    size_bytes: info.size,
  });
}

// Instagram only publishes JPEG images, so a PNG is converted once here (transparency over white)
// and only the JPEG is kept; the rest of the app never sees a PNG.
async function registerPngAsJpeg(userId: string, pngPath: string, reject: (message: string) => Promise<never>) {
  let jpeg: Buffer;
  try {
    jpeg = await sharp(await readObject(pngPath)).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
  } catch {
    return reject("Não consegui ler esta imagem PNG. Exporte de novo e tente outra vez.");
  }
  if (jpeg.byteLength > IMAGE_MAX) return reject("A imagem passa de 8 MB depois de convertida para JPEG.");

  const storagePath = pngPath.replace(/\.png$/, ".jpg");
  await putObject(storagePath, jpeg, "image/jpeg");
  await removeObjects([pngPath]);
  return insertMedia({ user_id: userId, storage_path: storagePath, kind: "image", mime_type: "image/jpeg", size_bytes: jpeg.byteLength });
}
