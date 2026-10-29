import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Without RLS, every model query must filter by user_id. Runs the real models against a
// throwaway database (TEST_DATABASE_URL, migrations applied), never production.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("models only return the caller's rows", async () => {
  Object.assign(process.env, { DATABASE_URL: url, OPENAI_API_KEY: "x", CRON_SECRET: "x".repeat(16) });
  const sql = postgres(url ?? "", { prepare: false, onnotice: () => {} });
  const post = await import("@/models/post");
  const script = await import("@/models/creative-script");
  const media = await import("@/models/media");
  const account = await import("@/models/account");
  const conversation = await import("@/models/conversation");
  const generation = await import("@/models/generation");
  const skill = await import("@/models/skill");

  let alice: string;
  let bob: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const mk = async () =>
      (await sql<{ id: string }[]>`
        insert into users (email, password_hash) values (${`own-${crypto.randomUUID()}@example.com`}, 'x')
        returning id`)[0].id;
    alice = await mk();
    bob = await mk();
    const m = await media.insertMedia({
      user_id: alice, storage_path: `${alice}/a.jpg`, kind: "image", mime_type: "image/jpeg", size_bytes: 10,
    });
    ids.media = m.id;
    ids.account = (await account.upsertAccountWithToken({
      userId: alice, igUserId: "ig1", username: "alice", accessToken: "tok", expiresAt: null, loginType: "instagram",
    })).id;
    ids.post = (await post.insertPost({
      user_id: alice, account_id: ids.account, script_id: null, post_type: "image", caption: "c",
      media_ids: [m.id], scheduled_at: null, status: "draft",
    })).id;
    ids.script = (await script.insertScript({
      user_id: alice, segment: "dentista", objective: null, audience: null, tone: null, format: "static",
      content: { title: "t", hook: "h", blocks: [{ label: "1", durationSeconds: null, visual: "v", text: "t" }], caption: "c", cta: "c", hashtags: [] },
    })).id;
    await generation.insertGeneration({ user_id: alice, script_id: ids.script, kind: "image", prompt: "p" });
    ids.conversation = (await conversation.getOrCreateConversation(alice)).id;
    await conversation.saveHistory(ids.conversation, [{ role: "user", content: "Oi" }]);
    ids.skill = (await skill.upsertUserSkill({ user_id: alice, name: "promo", description: "d", body: "b" })).id;
  });

  afterAll(async () => {
    await sql`delete from users where id in (${alice}, ${bob})`;
    await sql.end();
  });

  const notFound = (p: Promise<unknown>) => expect(p).rejects.toMatchObject({ status: 404 });

  it("owner sees her rows", async () => {
    expect((await post.getPost(alice, ids.post)).id).toBe(ids.post);
    expect(await post.listPosts(alice)).toHaveLength(1);
    expect(await script.listScripts(alice)).toHaveLength(1);
    expect(await account.listAccounts(alice)).toHaveLength(1);
    expect(await media.getMediaForUser([ids.media], alice)).toHaveLength(1);
    expect(await generation.listGenerations(alice, { scriptId: ids.script })).toHaveLength(1);
    expect(await skill.listUserSkills(alice)).toMatchObject([{ id: ids.skill, name: "promo" }]);
    expect(await conversation.listConversations(alice)).toMatchObject([{ id: ids.conversation, title: "Oi" }]);
  });

  it("another user gets 404 or empty lists", async () => {
    await notFound(post.getPost(bob, ids.post));
    await notFound(script.getScript(bob, ids.script));
    await notFound(script.updateScriptContent(bob, ids.script, { title: "x", hook: "h", blocks: [], caption: "", cta: "c", hashtags: [] }));
    await notFound(script.deleteScript(bob, ids.script));
    await notFound(account.getAccount(bob, ids.account));
    await notFound(media.getMediaForUser([ids.media], bob));
    await notFound(conversation.getOrCreateConversation(bob, ids.conversation));
    expect(await post.listPosts(bob)).toEqual([]);
    expect(await script.listScripts(bob)).toEqual([]);
    expect(await account.listAccounts(bob)).toEqual([]);
    expect(await conversation.listConversations(bob)).toEqual([]);
    expect(await generation.listGenerations(bob)).toEqual([]);
    expect(await skill.listUserSkills(bob)).toEqual([]);
    await notFound(skill.deleteUserSkill(bob, ids.skill));
  });

  it("another user can't delete the account", async () => {
    await account.deleteAccount(bob, ids.account);
    expect(await account.listAccounts(alice)).toHaveLength(1);
  });

  it("releaseMedia keeps media another pending post still needs", async () => {
    const shared = await media.insertMedia({
      user_id: alice, storage_path: `${alice}/shared.jpg`, kind: "image", mime_type: "image/jpeg", size_bytes: 1,
    });
    const base = { user_id: alice, account_id: null, script_id: null, post_type: "image" as const, caption: "c", media_ids: [shared.id], scheduled_at: null };
    const published = await post.insertPost({ ...base, status: "draft" });
    const other = await post.insertPost({ ...base, status: "draft" });

    expect(await media.releaseMedia(published)).toEqual([]); // `other` still uses it
    await sql`update posts set status = 'cancelled' where id = ${other.id}`;
    expect(await media.releaseMedia(published)).toEqual([`${alice}/shared.jpg`]);
    await notFound(media.getMediaForUser([shared.id], alice));
  });

  it("timestamps come back as ISO strings and sizes as numbers", async () => {
    const p = await post.getPost(alice, ids.post);
    expect(p.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect((await media.getMediaForUser([ids.media], alice))[0].size_bytes).toBe(10);
  });
});
