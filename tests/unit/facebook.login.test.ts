import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  Object.assign(process.env, {
    OPENAI_API_KEY: "x",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "x",
    SUPABASE_SERVICE_ROLE_KEY: "x",
    CRON_SECRET: "s".repeat(32),
    FACEBOOK_APP_ID: "fb-app",
    FACEBOOK_APP_SECRET: "fb-secret",
    FACEBOOK_CONFIG_ID: "cfg-1",
    FACEBOOK_REDIRECT_URI: "http://localhost:3000/api/instagram/facebook/callback",
  });
});

const urls: URL[] = [];
function mockFetch(responses: unknown[]) {
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL) => {
      urls.push(new URL(input));
      return new Response(JSON.stringify(responses[i++] ?? {}), { status: 200 });
    }),
  );
}
afterEach(() => {
  urls.length = 0;
  vi.unstubAllGlobals();
});

describe("facebook login service", () => {
  it("builds the Login for Business dialog URL with config_id instead of scope", async () => {
    const fb = await import("@/services/facebook");
    const url = new URL(fb.authorizeUrl("st"));
    expect(url.origin + url.pathname).toBe("https://www.facebook.com/v26.0/dialog/oauth");
    expect(url.searchParams.get("config_id")).toBe("cfg-1");
    expect(url.searchParams.get("client_id")).toBe("fb-app");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.has("scope")).toBe(false);
  });

  it("exchanges the code for a long-lived user token", async () => {
    const fb = await import("@/services/facebook");
    mockFetch([{ access_token: "short" }, { access_token: "long" }]);
    expect(await fb.exchangeCode("the-code")).toBe("long");
    expect(urls[0].searchParams.get("code")).toBe("the-code");
    expect(urls[0].searchParams.get("redirect_uri")).toBe(process.env.FACEBOOK_REDIRECT_URI);
    expect(urls[1].searchParams.get("grant_type")).toBe("fb_exchange_token");
    expect(urls[1].searchParams.get("fb_exchange_token")).toBe("short");
  });

  it("lists Instagram accounts across Pages, skipping Pages without one and following paging", async () => {
    const fb = await import("@/services/facebook");
    mockFetch([
      {
        data: [
          { id: "p1", name: "Loja 1", access_token: "pt1", instagram_business_account: { id: "ig1", username: "loja1" } },
          { id: "p2", name: "Sem IG", access_token: "pt2" },
        ],
        paging: { next: "https://graph.facebook.com/v26.0/me/accounts?after=X&access_token=u" },
      },
      { data: [{ id: "p3", name: "Loja 3", access_token: "pt3", instagram_business_account: { id: "ig3" } }] },
    ]);
    const found = await fb.listLinkedInstagramAccounts("u");
    expect(found).toEqual([
      { pageId: "p1", pageName: "Loja 1", pageToken: "pt1", igUserId: "ig1", username: "loja1" },
      { pageId: "p3", pageName: "Loja 3", pageToken: "pt3", igUserId: "ig3", username: "Loja 3" },
    ]);
    expect(urls[0].searchParams.get("fields")).toBe("id,name,access_token,instagram_business_account{id,username}");
    expect(urls[1].searchParams.get("after")).toBe("X");
  });
});

describe("accounts.handleFacebookCallback", () => {
  const cookieStore = { get: vi.fn(() => ({ value: "st" })), set: vi.fn(), delete: vi.fn() };
  const upsert = vi.fn(async (input: { username: string }) => ({ username: input.username }));

  async function load(linked: unknown[]) {
    vi.resetModules();
    vi.doMock("next/headers", () => ({ cookies: async () => cookieStore }));
    vi.doMock("@/services/facebook", () => ({
      exchangeCode: async () => "user-token",
      listLinkedInstagramAccounts: async () => linked,
    }));
    vi.doMock("@/models/account", () => ({
      upsertAccountWithToken: upsert,
      listAccounts: vi.fn(),
      getAccount: vi.fn(),
      deleteAccount: vi.fn(),
    }));
    return import("@/controllers/accounts");
  }

  it("connects every linked account with its Page token and no expiry", async () => {
    upsert.mockClear();
    const { handleFacebookCallback } = await load([
      { pageId: "p1", pageName: "A", pageToken: "pt1", igUserId: "ig1", username: "a" },
      { pageId: "p2", pageName: "B", pageToken: "pt2", igUserId: "ig2", username: "b" },
    ]);
    const saved = await handleFacebookCallback("u1", "code", "st");
    expect(saved.map((a) => a.username)).toEqual(["a", "b"]);
    expect(upsert).toHaveBeenCalledWith({
      userId: "u1",
      igUserId: "ig1",
      username: "a",
      accessToken: "pt1",
      expiresAt: null,
      loginType: "facebook",
      fbPageId: "p1",
    });
  });

  it("explains when no Page has an Instagram account linked", async () => {
    const { handleFacebookCallback } = await load([]);
    await expect(handleFacebookCallback("u1", "code", "st")).rejects.toThrow(/Nenhuma conta Instagram/);
  });

  it("rejects a state that doesn't match the cookie", async () => {
    const { handleFacebookCallback } = await load([]);
    await expect(handleFacebookCallback("u1", "code", "other")).rejects.toThrow(/Conexão expirada/);
  });
});
