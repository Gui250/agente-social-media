import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  Object.assign(process.env, {
    OPENAI_API_KEY: "x",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "x",
    SUPABASE_SERVICE_ROLE_KEY: "x",
    CRON_SECRET: "s".repeat(32),
    INSTAGRAM_APP_ID: "123",
    INSTAGRAM_APP_SECRET: "secret",
    INSTAGRAM_REDIRECT_URI: "http://localhost:3000/api/instagram/callback",
  });
});

describe("authorizeUrl", () => {
  it("forces re-login so a second account can be connected", async () => {
    const { authorizeUrl } = await import("@/services/instagram");
    const url = new URL(authorizeUrl("st"));
    expect(url.origin + url.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(url.searchParams.get("force_reauth")).toBe("true");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("scope")).toBe(
      "instagram_business_basic,instagram_business_content_publish",
    );
  });
});
