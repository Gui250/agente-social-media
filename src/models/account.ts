import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "@/lib/errors";
import { admin } from "@/lib/supabase/admin";

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

// Reads go through the session client (RLS: own rows only).
export async function listAccounts(supabase: SupabaseClient): Promise<AccountRow[]> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select()
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function getAccount(supabase: SupabaseClient, id: string): Promise<AccountRow> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Conta", "a");
  return data;
}

// Writes and token access use the service role: tokens never reach the browser (FR-021).
// Reconnecting the same Instagram account (either login) updates it in place.
export async function upsertAccountWithToken(input: {
  userId: string;
  igUserId: string;
  username: string;
  accessToken: string;
  expiresAt: Date | null; // null: Page tokens from Facebook Login don't expire
  loginType: LoginType;
  fbPageId?: string | null;
}): Promise<AccountRow> {
  const { data, error } = await admin()
    .from("connected_accounts")
    .upsert(
      {
        user_id: input.userId,
        ig_user_id: input.igUserId,
        username: input.username,
        status: "active",
        login_type: input.loginType,
        fb_page_id: input.fbPageId ?? null,
        token_expires_at: input.expiresAt?.toISOString() ?? null,
      },
      { onConflict: "user_id,ig_user_id" },
    )
    .select()
    .single();
  if (error) throw error;
  await saveToken(data.id, input.accessToken, input.expiresAt);
  return data;
}

export async function saveToken(accountId: string, accessToken: string, expiresAt: Date | null) {
  const db = admin();
  const { error } = await db
    .from("instagram_tokens")
    .upsert({ account_id: accountId, access_token: accessToken });
  if (error) throw error;
  const { error: e2 } = await db
    .from("connected_accounts")
    .update({ token_expires_at: expiresAt?.toISOString() ?? null, status: "active" })
    .eq("id", accountId);
  if (e2) throw e2;
}

export async function getAccessToken(accountId: string): Promise<string> {
  const { data, error } = await admin()
    .from("instagram_tokens")
    .select("access_token")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Token da conta");
  return (data as { access_token: string }).access_token;
}

export async function setAccountStatus(accountId: string, status: AccountStatus) {
  const { error } = await admin().from("connected_accounts").update({ status }).eq("id", accountId);
  if (error) throw error;
}

export async function deleteAccount(accountId: string) {
  const { error } = await admin().from("connected_accounts").delete().eq("id", accountId);
  if (error) throw error;
}

// Only Instagram Login tokens expire and can be refreshed (graph.instagram.com).
export async function accountsExpiringBefore(date: Date): Promise<AccountRow[]> {
  const { data, error } = await admin()
    .from("connected_accounts")
    .select()
    .eq("status", "active")
    .eq("login_type", "instagram")
    .lte("token_expires_at", date.toISOString());
  if (error) throw error;
  return data as AccountRow[];
}
