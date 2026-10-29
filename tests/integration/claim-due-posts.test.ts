import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Needs a throwaway database with the migrations applied (e.g. a Neon branch), never production:
// claim_due_posts claims every due post in the database.
// TEST_DATABASE_URL=... npx vitest run tests/integration
const url = process.env.TEST_DATABASE_URL;
if (!url) console.warn("claim_due_posts: TEST_DATABASE_URL not set, skipping integration test");

describe.skipIf(!url)("claim_due_posts", () => {
  const sql = postgres(url ?? "", { prepare: false, onnotice: () => {} });
  let userId: string;

  beforeAll(async () => {
    [{ id: userId }] = await sql<{ id: string }[]>`
      insert into users (email, password_hash) values (${`claim-${crypto.randomUUID()}@example.com`}, 'x')
      returning id`;
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 3_600_000);
    const base = { user_id: userId, post_type: "image", caption: "c", media_ids: [crypto.randomUUID()] };
    const rows = [
      ...Array.from({ length: 10 }, () => ({ ...base, status: "scheduled", scheduled_at: past })),
      { ...base, status: "scheduled", scheduled_at: future, caption: "future" },
      { ...base, status: "cancelled", scheduled_at: past, caption: "cancelled" },
      { ...base, status: "draft", scheduled_at: past, caption: "draft" },
    ];
    await sql`insert into posts ${sql(rows)}`;
  });

  afterAll(async () => {
    if (userId) await sql`delete from users where id = ${userId}`; // cascades to posts
    await sql.end();
  });

  it("concurrent claims return disjoint rows and skip future, cancelled and draft posts", async () => {
    const claim = () => sql<{ id: string; user_id: string }[]>`select * from claim_due_posts(10)`;
    const [a, b] = await Promise.all([claim(), claim()]);
    const mine = (rows: { id: string; user_id: string }[]) => rows.filter((r) => r.user_id === userId);
    const idsA = mine(a).map((r) => r.id);
    const idsB = mine(b).map((r) => r.id);
    expect(idsA.filter((id) => idsB.includes(id))).toEqual([]);
    expect(idsA.length + idsB.length).toBe(10);

    const left = await sql<{ caption: string }[]>`
      select caption from posts where user_id = ${userId} and status <> 'publishing'`;
    expect(left.map((r) => r.caption).sort()).toEqual(["cancelled", "draft", "future"]);
  });
});
