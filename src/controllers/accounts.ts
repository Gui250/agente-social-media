import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { DomainError } from "@/lib/errors";
import { deleteAccount, getAccount, listAccounts, upsertAccountWithToken } from "@/models/account";
import * as facebook from "@/services/facebook";
import * as instagram from "@/services/instagram";

const STATE_COOKIE = "ig_oauth_state";

// Both logins share the CSRF state cookie (scoped to /api/instagram, where both callbacks live).
export async function startConnect(via: "instagram" | "facebook" = "instagram") {
  const state = randomBytes(24).toString("hex");
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/instagram",
    maxAge: 600,
  });
  return via === "facebook" ? facebook.authorizeUrl(state) : instagram.authorizeUrl(state);
}

async function checkState(state: string) {
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value ?? "";
  store.delete({ name: STATE_COOKIE, path: "/api/instagram" });
  const a = Buffer.from(state);
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new DomainError("invalid_state", "Conexão expirada. Tente conectar de novo.");
  }
}

export async function handleCallback(userId: string, code: string, state: string) {
  await checkState(state);
  const { accessToken, expiresAt } = await instagram.exchangeCode(code);
  const profile = await instagram.getProfile(accessToken);
  return [await upsertAccountWithToken({ userId, ...profile, accessToken, expiresAt, loginType: "instagram" })];
}

// One Facebook login connects every Instagram account linked to the user's Pages.
export async function handleFacebookCallback(userId: string, code: string, state: string) {
  await checkState(state);
  const userToken = await facebook.exchangeCode(code);
  const linked = await facebook.listLinkedInstagramAccounts(userToken);
  if (linked.length === 0) {
    throw new DomainError(
      "no_instagram_accounts",
      "Nenhuma conta Instagram profissional está vinculada às Páginas do Facebook que você autorizou.",
    );
  }
  const saved = [];
  for (const ig of linked) {
    saved.push(
      await upsertAccountWithToken({
        userId,
        igUserId: ig.igUserId,
        username: ig.username,
        accessToken: ig.pageToken,
        expiresAt: null,
        loginType: "facebook",
        fbPageId: ig.pageId,
      }),
    );
  }
  return saved;
}

export const list = listAccounts;

export async function disconnect(userId: string, accountId: string) {
  await getAccount(userId, accountId); // 404 unless it's the user's
  await deleteAccount(userId, accountId);
}
