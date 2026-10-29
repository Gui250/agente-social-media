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
  const organization = await import("@/models/organization");
  const brand = await import("@/models/brand");
  const brandAsset = await import("@/models/brand-asset");
  const audit = await import("@/models/audit");

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
    await notFound(conversation.deleteConversation(bob, ids.conversation));
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

  it("organizations are only visible to their owner", async () => {
    const slug = `own-${crypto.randomUUID().slice(0, 8)}`;
    const org = await organization.insertOrganization({ userId: alice, name: "Clínica", slug });
    expect(await organization.listOrganizations(alice)).toMatchObject([{ id: org.id, brand_count: 0 }]);
    expect((await organization.getOrganizationBySlug(alice, slug)).id).toBe(org.id);

    expect(await organization.listOrganizations(bob)).toEqual([]);
    await notFound(organization.getOrganization(bob, org.id));
    await notFound(organization.getOrganizationBySlug(bob, slug));
    await notFound(organization.renameOrganization(bob, org.id, "Outra"));
    await notFound(organization.deleteOrganization(bob, org.id));
    expect((await organization.getOrganization(alice, org.id)).name).toBe("Clínica");
  });

  it("brands are only reachable through their owner's company", async () => {
    const org = await organization.insertOrganization({ userId: alice, name: "Clínica", slug: `own-${crypto.randomUUID().slice(0, 8)}` });
    const b = await brand.insertBrand(alice, org.id, { name: "Sorriso Kids" });
    expect(await brand.listBrands(alice, org.id)).toMatchObject([{ id: b.id }]);
    expect((await brand.getBrand(alice, b.id)).organization_slug).toBe(org.slug);
    expect((await organization.getOrganization(alice, org.id)).brand_count).toBe(1);

    expect(await brand.listBrands(bob, org.id)).toEqual([]);
    await notFound(brand.getBrand(bob, b.id));
    await notFound(brand.updateBrand(bob, b.id, { name: "Outra" }));
    await notFound(brand.deleteBrand(bob, b.id));
    await notFound(brand.insertBrand(bob, org.id, { name: "Intrusa" }));
    expect((await brand.getBrand(alice, b.id)).name).toBe("Sorriso Kids");

    await expect(brand.insertBrand(alice, org.id, { name: "sorriso KIDS" })).rejects.toMatchObject({ code: "23505" });
  });

  it("brand files: one logo, owner only, removed with the company", async () => {
    const org = await organization.insertOrganization({ userId: alice, name: "Clínica", slug: `own-${crypto.randomUUID().slice(0, 8)}` });
    const b = await brand.insertBrand(alice, org.id, { name: "Kids" });
    const file = (name: string) => ({
      brand_id: b.id, asset_type: "logo" as const, storage_key: `${alice}/brands/${b.id}/${name}.png`,
      mime_type: "image/png" as const, width: 128, height: 128, size_bytes: 100,
    });
    const first = await brandAsset.insertAsset(alice, file("a"));
    await expect(brandAsset.insertAsset(alice, file("b"))).rejects.toMatchObject({ code: "23505" });

    const { asset, oldKey } = await brandAsset.replaceLogo(alice, file("c"));
    expect(oldKey).toBe(first.storage_key);
    expect(await brandAsset.listAssets(alice, b.id)).toMatchObject([{ id: asset.id, asset_type: "logo" }]);
    await brandAsset.insertAsset(alice, { ...file("d"), asset_type: "other" });
    expect(await brandAsset.countNonLogoAssets(alice, b.id)).toBe(1);

    expect(await brandAsset.listAssets(bob, b.id)).toEqual([]);
    await notFound(brandAsset.deleteAsset(bob, b.id, asset.id));
    await notFound(brandAsset.insertAsset(bob, file("e")));
    await notFound(brandAsset.replaceLogo(bob, file("f")));
    expect(await brandAsset.listAssets(alice, b.id)).toHaveLength(2);

    await brand.updateBrand(alice, b.id, {
      color_palette: [{ hex: "#AABBCC", role: "primary" }], typography: [{ family: "Inter", usage: "body" }],
      visual_guidelines: ["Fundo claro"], forbidden_elements: [],
    });
    expect(await brand.getBrand(alice, b.id)).toMatchObject({
      color_palette: [{ hex: "#AABBCC", role: "primary" }], visual_guidelines: ["Fundo claro"], forbidden_elements: [],
    });

    const { keys } = await organization.deleteOrganization(alice, org.id);
    expect(keys.sort()).toEqual([`${alice}/brands/${b.id}/c.png`, `${alice}/brands/${b.id}/d.png`]);
    expect(await sql`select 1 from brands where organization_id = ${org.id}`).toHaveLength(0);
    expect(await sql`select 1 from brand_assets where brand_id = ${b.id}`).toHaveLength(0);
  });

  it("audit entries keep their metadata as JSON", async () => {
    const entityId = crypto.randomUUID();
    await audit.recordAudit({ userId: alice, action: "brand.update", entityType: "brand", entityId, metadata: { fields: ["name"] } });
    expect(await sql`select action, metadata from audit_log where entity_id = ${entityId}`).toEqual([
      { action: "brand.update", metadata: { fields: ["name"] } },
    ]);
  });
});
