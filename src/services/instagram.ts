import "server-only";
import { instagramConfig } from "@/lib/env";
import { DomainError } from "@/lib/errors";

// Instagram API with Instagram Login (research.md › R6) uses graph.instagram.com, unversioned.
// Accounts connected through Facebook Login (R6b) publish through graph.facebook.com with the Page
// token; the content-publishing endpoints are otherwise identical.
const GRAPH = "https://graph.instagram.com";
export const FACEBOOK_GRAPH = "https://graph.facebook.com/v26.0";

export type LoginType = "instagram" | "facebook";
export type Conn = { token: string; base: string };
export const connFor = (loginType: LoginType, token: string): Conn => ({
  token,
  base: loginType === "facebook" ? FACEBOOK_GRAPH : GRAPH,
});
const SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number } };

// Maps Graph API errors to messages the user (and the agent) can act on.
export function toDomainError(body: GraphError, status: number): DomainError {
  const code = body.error?.code;
  if (code === 190) {
    return new DomainError("account_expired", "Conta Instagram expirada, reconecte em Contas.", 502);
  }
  if (code === 4 || code === 9 || code === 17 || code === 32 || code === 613) {
    return new DomainError(
      "instagram_rate_limit",
      "O Instagram limitou as requisições desta conta. Tente de novo mais tarde.",
      502,
    );
  }
  const detail = body.error?.message ? `: ${body.error.message}` : "";
  return new DomainError("instagram_error", `O Instagram recusou a operação (${status})${detail}`, 502);
}

export async function graph<T>(
  path: string,
  init: { method?: "GET" | "POST"; params: Record<string, string> },
): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${GRAPH}${path}`);
  const method = init.method ?? "GET";
  let body: URLSearchParams | undefined;
  if (method === "GET") {
    for (const [k, v] of Object.entries(init.params)) url.searchParams.set(k, v);
  } else {
    body = new URLSearchParams(init.params);
  }
  const res = await fetch(url, { method, body });
  const json = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || json.error) throw toDomainError(json, res.status);
  return json;
}

export function authorizeUrl(state: string) {
  const { appId, redirectUri } = instagramConfig();
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(","));
  url.searchParams.set("state", state);
  // Without this, Instagram reuses the account already logged in on the browser, so a second
  // "Conectar" would reconnect the same account instead of letting the user pick another one.
  url.searchParams.set("force_reauth", "true");
  return url.toString();
}

type TokenResponse = { access_token: string; expires_in: number };

// code → short-lived token → long-lived token (~60 days).
export async function exchangeCode(code: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const { appId, appSecret, redirectUri } = instagramConfig();
  type Short = { access_token?: string; data?: { access_token: string }[] };
  const short = await graph<Short>("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    params: {
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code: code.replace(/#_$/, ""),
    },
  });
  const shortToken = short.data?.[0]?.access_token ?? short.access_token;
  if (!shortToken) throw toDomainError({}, 502);

  const long = await graph<TokenResponse>("/access_token", {
    params: { grant_type: "ig_exchange_token", client_secret: appSecret, access_token: shortToken },
  });
  return { accessToken: long.access_token, expiresAt: expiry(long.expires_in) };
}

export async function refreshToken(token: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await graph<TokenResponse>("/refresh_access_token", {
    params: { grant_type: "ig_refresh_token", access_token: token },
  });
  return { accessToken: res.access_token, expiresAt: expiry(res.expires_in) };
}

// `user_id` is the professional account ID used for publishing.
export async function getProfile(token: string): Promise<{ igUserId: string; username: string }> {
  const me = await graph<{ user_id: string; username: string }>("/me", {
    params: { fields: "user_id,username", access_token: token },
  });
  return { igUserId: String(me.user_id), username: me.username };
}

const expiry = (seconds: number) => new Date(Date.now() + seconds * 1000);

// --- Content publishing (container → status → media_publish) ---

export type ContainerStatus = "IN_PROGRESS" | "FINISHED" | "PUBLISHED" | "ERROR" | "EXPIRED";

const get = <T>(conn: Conn, path: string, params: Record<string, string>) =>
  graph<T>(`${conn.base}${path}`, { params: { ...params, access_token: conn.token } });
const post = <T>(conn: Conn, path: string, params: Record<string, string>) =>
  graph<T>(`${conn.base}${path}`, { method: "POST", params: { ...params, access_token: conn.token } });

const createContainer = async (conn: Conn, igUserId: string, params: Record<string, string>) =>
  (await post<{ id: string }>(conn, `/${igUserId}/media`, params)).id;

export function createImageContainer(
  conn: Conn,
  igUserId: string,
  { imageUrl, caption }: { imageUrl: string; caption: string },
) {
  return createContainer(conn, igUserId, { image_url: imageUrl, caption });
}

export function createReelContainer(
  conn: Conn,
  igUserId: string,
  { videoUrl, caption }: { videoUrl: string; caption: string },
) {
  return createContainer(conn, igUserId, { media_type: "REELS", video_url: videoUrl, caption });
}

// ponytail: video children are not polled before the parent is created; if Meta rejects the
// parent while they process, the post fails with Meta's message. Poll children if that shows up.
export async function createCarouselContainer(
  conn: Conn,
  igUserId: string,
  { items, caption }: { items: { kind: "image" | "video"; url: string }[]; caption: string },
) {
  const children: string[] = [];
  for (const item of items) {
    const params: Record<string, string> =
      item.kind === "image"
        ? { image_url: item.url, is_carousel_item: "true" }
        : { media_type: "VIDEO", video_url: item.url, is_carousel_item: "true" };
    children.push(await createContainer(conn, igUserId, params));
  }
  return createContainer(conn, igUserId, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption,
  });
}

export async function getContainerStatus(conn: Conn, containerId: string) {
  return (await get<{ status_code: ContainerStatus }>(conn, `/${containerId}`, { fields: "status_code" }))
    .status_code;
}

export async function publish(conn: Conn, igUserId: string, creationId: string) {
  return (await post<{ id: string }>(conn, `/${igUserId}/media_publish`, { creation_id: creationId })).id;
}

export async function getPermalink(conn: Conn, mediaId: string) {
  return (await get<{ permalink?: string }>(conn, `/${mediaId}`, { fields: "permalink" })).permalink ?? null;
}

export async function getPublishingLimit(conn: Conn, igUserId: string) {
  const res = await get<{ data: { quota_usage: number; config?: { quota_total?: number } }[] }>(
    conn,
    `/${igUserId}/content_publishing_limit`,
    { fields: "quota_usage,config" },
  );
  const row = res.data?.[0];
  return { used: row?.quota_usage ?? 0, total: row?.config?.quota_total ?? Number.POSITIVE_INFINITY };
}
