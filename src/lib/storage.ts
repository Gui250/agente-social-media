import "server-only";
import { BlobNotFoundError, del, head, issueSignedToken, presignUrl, put } from "@vercel/blob";
import { storageConfig } from "@/lib/env";

// Private Vercel Blob store. The browser uploads with a presigned PUT and Instagram downloads with
// a presigned GET; nothing is ever public. Auth comes from BLOB_READ_WRITE_TOKEN.
const access = "private";
const HOUR = 60 * 60 * 1000;

// Type and size are also enforced by Blob itself on the PUT. The CDN keeps an object for
// `cacheMaxAge` seconds (Blob's default: a month), and deleting it doesn't purge copies already
// cached, so a signed link fetched before a delete can keep working for that long.
export async function uploadUrl(pathname: string, contentType: string, maxBytes: number, cacheMaxAge?: number) {
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
    ...(cacheMaxAge && { cacheControlMaxAge: cacheMaxAge }),
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

export async function readObject(pathname: string): Promise<Uint8Array> {
  const res = await fetch(await downloadUrl(pathname));
  if (!res.ok) throw new Error(`Blob read failed: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
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

// After the rows are gone: a failure leaves objects nothing points to (and that no one can sign a
// URL for), so it is logged instead of failing a delete that already happened.
// ponytail: no sweep for these orphans; add one if they ever show up in the store.
export async function removeOrphans(pathnames: string[]) {
  try {
    await removeObjects(pathnames);
  } catch (e) {
    console.error("Blob cleanup failed", pathnames, e);
  }
}
