import "server-only";
import { sql } from "@/lib/db";
import { notFound } from "@/lib/errors";

export type AccountStatus = "active" | "expired" | "revoked";
export type LoginType = "instagram" | "facebook";
export type AccountRow = {
  id: string;
  user_id: string;
  provider: "instagram";
  ig_user_id: string;
  username: string;
  status: AccountStatus;
  login_type: LoginType;
  fb_page_id: string | null;
  token_expires_at: string | null;
};

export async function listAccounts(userId: string): Promise<AccountRow[]> {
  return sql()<AccountRow[]>`
    select * from connected_accounts where user_id = ${userId} order by created_at`;
}

export async function getAccount(userId: string, id: string): Promise<AccountRow> {
  const [row] = await sql()<AccountRow[]>`
    select * from connected_accounts where id = ${id} and user_id = ${userId}`;
  if (!row) throw notFound("Conta", "a");
  return row;
}

// Tokens never reach the browser (FR-021). Reconnecting the same Instagram account (either
// login) updates it in place.
export async function upsertAccountWithToken(input: {
  userId: string;
  igUserId: string;
  username: string;
  accessToken: string;
  expiresAt: Date | null; // null: Page tokens from Facebook Login don't expire
  loginType: LoginType;
  fbPageId?: string | null;
}): Promise<AccountRow> {
  const [row] = await sql()<AccountRow[]>`
    insert into connected_accounts (user_id, ig_user_id, username, status, login_type, fb_page_id, token_expires_at)
    values (${input.userId}, ${input.igUserId}, ${input.username}, 'active', ${input.loginType},
            ${input.fbPageId ?? null}, ${input.expiresAt})
    on conflict (user_id, ig_user_id) do update set
      username = excluded.username, status = 'active', login_type = excluded.login_type,
      fb_page_id = excluded.fb_page_id, token_expires_at = excluded.token_expires_at
    returning *`;
  await saveToken(row.id, input.accessToken, input.expiresAt);
  return row;
}

export async function saveToken(accountId: string, accessToken: string, expiresAt: Date | null) {
  await sql()`
    insert into instagram_tokens (account_id, access_token) values (${accountId}, ${accessToken})
    on conflict (account_id) do update set access_token = excluded.access_token`;
  await sql()`
    update connected_accounts set token_expires_at = ${expiresAt}, status = 'active' where id = ${accountId}`;
}

// Server-only callers (publisher, token refresh) that already hold a trusted account id.
export async function getAccessToken(accountId: string): Promise<string> {
  const [row] = await sql()<{ access_token: string }[]>`
    select access_token from instagram_tokens where account_id = ${accountId}`;
  if (!row) throw notFound("Token da conta");
  return row.access_token;
}

export async function getPublishingAccount(accountId: string) {
  const [row] = await sql()<Pick<AccountRow, "ig_user_id" | "login_type">[]>`
    select ig_user_id, login_type from connected_accounts where id = ${accountId}`;
  if (!row) throw notFound("Conta", "a");
  return row;
}

export async function setAccountStatus(accountId: string, status: AccountStatus) {
  await sql()`update connected_accounts set status = ${status} where id = ${accountId}`;
}

// Its scheduled posts can no longer go out; deleting the account drops its token (cascade).
export async function deleteAccount(userId: string, accountId: string) {
  await sql().begin(async (tx) => {
    await tx`
      update posts set status = 'failed', failure_reason = 'conta desconectada'
      where account_id = ${accountId} and user_id = ${userId} and status = 'scheduled'`;
    await tx`delete from connected_accounts where id = ${accountId} and user_id = ${userId}`;
  });
}

// Only Instagram Login tokens expire and can be refreshed (graph.instagram.com).
export async function accountsExpiringBefore(date: Date): Promise<AccountRow[]> {
  return sql()<AccountRow[]>`
    select * from connected_accounts
    where status = 'active' and login_type = 'instagram' and token_expires_at <= ${date}`;
}
