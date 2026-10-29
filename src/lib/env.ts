import "server-only";
import { z } from "zod";
import { DomainError } from "@/lib/errors";

const schema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().optional().transform((v) => v || undefined),
  // AI media from creative scripts (src/services/creative-gen.ts).
  IMAGE_MODEL: z.string().optional().transform((v) => v || "gpt-image-2"),
  VIDEO_MODEL: z.string().optional().transform((v) => v || "sora-2"),
  DATABASE_URL: z.url(),
  // Private Vercel Blob store for post media (created with `vercel blob create-store`). Optional
  // so scripts and chat work before it exists; see storageConfig().
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  // Optional so script generation (US1) works before a Meta app exists; see instagramConfig().
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  INSTAGRAM_REDIRECT_URI: z.string().optional(),
  // Facebook Login for Business (optional): connects every Instagram account linked to the
  // user's Pages at once. FACEBOOK_CONFIG_ID is the Login configuration from the Meta dashboard.
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  FACEBOOK_CONFIG_ID: z.string().optional(),
  FACEBOOK_REDIRECT_URI: z.string().optional(),
  CRON_SECRET: z.string().min(16),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

// Parsed on first use so `next build` doesn't need every secret.
export function env(): Env {
  if (cached) return cached;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const names = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${names}`);
  }
  cached = result.data;
  return cached;
}

export function instagramConfig() {
  const { INSTAGRAM_APP_ID: appId, INSTAGRAM_APP_SECRET: appSecret, INSTAGRAM_REDIRECT_URI: redirectUri } =
    env();
  if (!appId || !appSecret || !redirectUri) {
    throw new DomainError(
      "instagram_not_configured",
      "A integração com o Instagram ainda não foi configurada neste servidor.",
      502,
    );
  }
  return { appId, appSecret, redirectUri };
}

export function facebookConfig() {
  const {
    FACEBOOK_APP_ID: appId,
    FACEBOOK_APP_SECRET: appSecret,
    FACEBOOK_CONFIG_ID: configId,
    FACEBOOK_REDIRECT_URI: redirectUri,
  } = env();
  if (!appId || !appSecret || !configId || !redirectUri) {
    throw new DomainError(
      "facebook_not_configured",
      "O login com Facebook ainda não foi configurado neste servidor.",
      502,
    );
  }
  return { appId, appSecret, configId, redirectUri };
}

export function storageConfig() {
  const token = env().BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new DomainError(
      "storage_not_configured",
      "O envio de mídias ainda não foi configurado neste servidor.",
      502,
    );
  }
  return { token };
}
