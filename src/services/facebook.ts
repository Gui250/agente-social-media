import "server-only";
import { facebookConfig } from "@/lib/env";
import { FACEBOOK_GRAPH, graph } from "./instagram";

// Instagram API with Facebook Login for Business (research.md › R6b). The permissions
// (instagram_basic, instagram_content_publish, pages_show_list, pages_read_engagement,
// business_management) live in the Login configuration referenced by `config_id`, not in `scope`.

export function authorizeUrl(state: string) {
  const { appId, configId, redirectUri } = facebookConfig();
  const url = new URL(`https://www.facebook.com/${FACEBOOK_GRAPH.split("/").pop()}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("config_id", configId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

// code → user token → long-lived user token. Page tokens read with it don't expire.
export async function exchangeCode(code: string): Promise<string> {
  const { appId, appSecret, redirectUri } = facebookConfig();
  const short = await graph<{ access_token: string }>(`${FACEBOOK_GRAPH}/oauth/access_token`, {
    params: { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code },
  });
  const long = await graph<{ access_token: string }>(`${FACEBOOK_GRAPH}/oauth/access_token`, {
    params: {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: short.access_token,
    },
  });
  return long.access_token;
}

export type LinkedInstagram = {
  pageId: string;
  pageName: string;
  pageToken: string;
  igUserId: string;
  username: string;
};

type PagesResponse = {
  data: {
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: { id: string; username?: string };
  }[];
  paging?: { next?: string };
};

const MAX_PAGES = 10; // ponytail: 10 × 100 Pages; raise if someone manages more

// Every Page the user manages that has an Instagram professional account linked.
export async function listLinkedInstagramAccounts(userToken: string): Promise<LinkedInstagram[]> {
  const found: LinkedInstagram[] = [];
  let next: string | undefined = `${FACEBOOK_GRAPH}/me/accounts`;
  let params: Record<string, string> = {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "100",
    access_token: userToken,
  };
  for (let i = 0; next && i < MAX_PAGES; i++) {
    const res: PagesResponse = await graph<PagesResponse>(next, { params });
    for (const page of res.data ?? []) {
      const ig = page.instagram_business_account;
      if (!ig) continue;
      found.push({
        pageId: page.id,
        pageName: page.name,
        pageToken: page.access_token,
        igUserId: ig.id,
        username: ig.username ?? page.name,
      });
    }
    next = res.paging?.next; // already carries every query param
    params = {};
  }
  return found;
}
