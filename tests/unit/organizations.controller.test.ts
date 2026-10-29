import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const insertOrganization = vi.fn();
const renameOrganization = vi.fn();
const deleteOrganization = vi.fn();
const recordAudit = vi.fn();
const removeOrphans = vi.fn();

vi.mock("@/models/organization", () => ({
  insertOrganization,
  renameOrganization,
  deleteOrganization,
  listOrganizations: vi.fn(),
  getOrganizationBySlug: vi.fn(),
}));
vi.mock("@/models/audit", () => ({ recordAudit }));
vi.mock("@/lib/storage", () => ({ removeOrphans }));

const organizations = await import("@/controllers/organizations");
const { slugify } = organizations;

const ID = "11111111-1111-4111-8111-111111111111";
const row = (over: object = {}) => ({
  id: ID, user_id: "u1", name: "Ação & Cia", slug: "acao-cia", brand_count: 0,
  created_at: "2026-10-29T00:00:00.000Z", updated_at: "2026-10-29T00:00:00.000Z", ...over,
});
const uniqueViolation = () => Object.assign(new Error("duplicate key"), { code: "23505" });

describe("slugify", () => {
  it.each([
    ["Ação & Cia", "acao-cia"],
    ["  Clínica   Sorriso!! ", "clinica-sorriso"],
    ["--Já--Vai--", "ja-vai"],
    ["!!!", "empresa"],
  ])("%s → %s", (name, slug) => expect(slugify(name)).toBe(slug));

  it("caps at 60 chars without a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(59)} bcd`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("organizations.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertOrganization.mockImplementation(async (r) => row({ name: r.name, slug: r.slug }));
  });

  it("creates with the slug of the trimmed name and audits it", async () => {
    const org = await organizations.create("u1", "  Ação & Cia ");
    expect(insertOrganization).toHaveBeenCalledWith({ userId: "u1", name: "Ação & Cia", slug: "acao-cia" });
    expect(org).toMatchObject({ id: ID, name: "Ação & Cia", slug: "acao-cia", brandCount: 0 });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "organization.create", entityId: ID }));
  });

  it("retries with a random suffix when the slug is taken", async () => {
    insertOrganization.mockRejectedValueOnce(uniqueViolation());
    await organizations.create("u1", "Ação & Cia");
    expect(insertOrganization.mock.calls[1][0].slug).toMatch(/^acao-cia-[0-9a-f]{4}$/);
  });

  it("gives up after 3 attempts", async () => {
    insertOrganization.mockRejectedValue(uniqueViolation());
    await expect(organizations.create("u1", "Ação & Cia")).rejects.toMatchObject({ code: "23505" });
    expect(insertOrganization).toHaveBeenCalledTimes(3);
  });

  it.each(["", "   ", "a", "x".repeat(81)])("rejects the name %j", async (name) => {
    await expect(organizations.create("u1", name)).rejects.toBeInstanceOf(DomainError);
    expect(insertOrganization).not.toHaveBeenCalled();
  });
});

describe("organizations.rename and remove", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renames and audits", async () => {
    renameOrganization.mockResolvedValue(row({ name: "Nova" }));
    expect(await organizations.rename("u1", ID, "Nova")).toMatchObject({ name: "Nova", slug: "acao-cia" });
    expect(renameOrganization).toHaveBeenCalledWith("u1", ID, "Nova");
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "organization.rename" }));
  });

  it("deletes, removes the brand files and audits", async () => {
    deleteOrganization.mockResolvedValue({ name: "Ação & Cia", keys: ["u1/brands/b/x.png"] });
    await organizations.remove("u1", ID);
    expect(removeOrphans).toHaveBeenCalledWith(["u1/brands/b/x.png"]);
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "organization.delete", entityId: ID }));
  });

  it("treats a malformed id as not found", async () => {
    await expect(organizations.remove("u1", "abc")).rejects.toMatchObject({ status: 404 });
    expect(deleteOrganization).not.toHaveBeenCalled();
  });
});
