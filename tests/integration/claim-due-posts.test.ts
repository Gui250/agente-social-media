import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs against the local stack (`npx supabase start`); skipped when it isn't reachable.
function localEnv() {
  try {
    const text = readFileSync(".env.local", "utf8");
    return Object.fromEntries(
      text.split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    );
  } catch {
    return {};
  }
}
const env = localEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const reachable =
  !!url && !!key && (await fetch(`${url}/rest/v1/`, { headers: { apikey: key } }).then((r) => r.ok, () => false));
if (!reachable) console.warn("claim_due_posts: local Supabase not reachable, skipping integration test");

describe.skipIf(!reachable)("claim_due_posts", () => {
  let db: SupabaseClient;
  let userId: string;

  beforeAll(async () => {
    db = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await db.auth.admin.createUser({
      email: `claim-${crypto.randomUUID()}@example.com`,
      password: "senha-teste-123",
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const base = { user_id: userId, post_type: "image", caption: "c", media_ids: [crypto.randomUUID()] };
    const rows = [
      ...Array.from({ length: 10 }, () => ({ ...base, status: "scheduled", scheduled_at: past })),
      { ...base, status: "scheduled", scheduled_at: future, caption: "future" },
      { ...base, status: "cancelled", scheduled_at: past, caption: "cancelled" },
      { ...base, status: "draft", scheduled_at: past, caption: "draft" },
    ];
    const { error: e2 } = await db.from("posts").insert(rows);
    if (e2) throw e2;
  });

  afterAll(async () => {
    if (userId) await db.auth.admin.deleteUser(userId); // cascades to profile and posts
  });

  it("concurrent claims return disjoint rows and skip future, cancelled and draft posts", async () => {
    const claim = () => db.rpc("claim_due_posts", { batch: 10 });
    const [a, b] = await Promise.all([claim(), claim()]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    const mine = (rows: { id: string; user_id: string }[]) => rows.filter((r) => r.user_id === userId);
    const idsA = mine(a.data).map((r) => r.id);
    const idsB = mine(b.data).map((r) => r.id);
    expect(idsA.filter((id) => idsB.includes(id))).toEqual([]);
    expect(idsA.length + idsB.length).toBe(10);

    const { data: left } = await db.from("posts").select("caption, status").eq("user_id", userId).neq("status", "publishing");
    expect(left?.map((r) => r.caption).sort()).toEqual(["cancelled", "draft", "future"]);
  });
});
