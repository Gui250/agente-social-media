import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageConfig } from "@/lib/env";

// Any S3-compatible bucket (Neon Object Storage, Cloudflare R2, AWS S3). Private: the browser
// uploads with a presigned PUT and Instagram downloads with a presigned GET.
let client: S3Client | undefined;

function s3() {
  const c = storageConfig();
  client ??= new S3Client({
    endpoint: c.endpoint,
    region: c.region,
    forcePathStyle: true, // Neon Object Storage only supports path-style URLs
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  return { client, bucket: c.bucket };
}

export function uploadUrl(key: string, contentType: string, expiresIn = 600) {
  const { client, bucket } = s3();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
    expiresIn,
  });
}

export function downloadUrl(key: string, expiresIn = 3600) {
  const { client, bucket } = s3();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}

// null when the object doesn't exist (the upload never happened).
export async function objectInfo(key: string) {
  const { client, bucket } = s3();
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { contentType: head.ContentType ?? "", size: head.ContentLength ?? 0 };
  } catch (e) {
    if ((e as { name?: string }).name === "NotFound") return null;
    throw e;
  }
}

export async function removeObject(key: string) {
  const { client, bucket } = s3();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
