import "server-only";
import { BlobNotFoundError, del, head, issueSignedToken, presignUrl, put } from "@vercel/blob";
import { storageConfig } from "@/lib/env";

// Private Vercel Blob store. The browser uploads with a presigned PUT and Instagram downloads with
// a presigned GET; nothing is ever public. Auth comes from BLOB_READ_WRITE_TOKEN.
const access = "private";
const HOUR = 60 * 60 * 1000;

// Type and size are also enforced by Blob itself on the PUT.
export async function uploadUrl(pathname: string, contentType: string, maxBytes: number) {
  const { token } = storageConfig();
  const signed = await issueSignedToken({
    token,
    pathname,
    operations: ["put"],
    allowedContentTypes: [contentType],
    maximumSizeInBytes: maxBytes,
    validUntil: Date.now() + HOUR,
  });
  const { presignedUrl } = await presignUrl(signed, {
    operation: "put",
    access,
    pathname,
    allowedContentTypes: [contentType],
    maximumSizeInBytes: maxBytes,
    addRandomSuffix: false,
    allowOverwrite: false,
    validUntil: Date.now() + 10 * 60 * 1000,
  });
  return presignedUrl;
}

// Server-side write for AI-generated media: same private store and "<userId>/" prefix as uploads.
export async function putObject(pathname: string, body: Uint8Array, contentType: string) {
  await put(pathname, Buffer.from(body), {
    access,
    contentType,
    token: storageConfig().token,
    addRandomSuffix: false,
    allowOverwrite: false,
  });
}

export async function downloadUrl(pathname: string) {
  const { token } = storageConfig();
  const signed = await issueSignedToken({ token, pathname, operations: ["get"], validUntil: Date.now() + HOUR });
  const { presignedUrl } = await presignUrl(signed, { operation: "get", access, pathname });
  return presignedUrl;
}

// null when the blob doesn't exist (the upload never happened).
export async function objectInfo(pathname: string) {
  try {
    const blob = await head(pathname, { token: storageConfig().token });
    return { contentType: blob.contentType, size: blob.size };
  } catch (e) {
    if (e instanceof BlobNotFoundError) return null;
    throw e;
  }
}

export async function removeObjects(pathnames: string[]) {
  if (pathnames.length) await del(pathnames, { token: storageConfig().token });
}
