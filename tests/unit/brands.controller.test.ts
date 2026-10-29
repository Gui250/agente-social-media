import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError, notFound } from "@/lib/errors";

const insertBrand = vi.fn();
const updateBrand = vi.fn();
const deleteBrand = vi.fn();
const getBrand = vi.fn();
const recordAudit = vi.fn();
const removeOrphans = vi.fn();

vi.mock("@/models/brand", () => ({ insertBrand, updateBrand, deleteBrand, getBrand, listBrands: vi.fn() }));
vi.mock("@/models/audit", () => ({ recordAudit }));
vi.mock("@/lib/storage", () => ({ removeOrphans, downloadUrl: vi.fn() }));

const brands = await import("@/controllers/brands");

const ORG = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";
const row = (over: object = {}) => ({
  id: ID, organization_id: ORG, organization_slug: "clinica", organization_name: "Clínica",
  name: "Sorriso Kids", description: null, industry: null, target_audience: null, brand_voice: null,
  color_palette: [], typography: [], visual_guidelines: [], forbidden_elements: [],
  created_at: "2026-10-29T00:00:00.000Z", updated_at: "2026-10-29T00:00:00.000Z", ...over,
});
const uniqueViolation = () => Object.assign(new Error("duplicate key"), { code: "23505" });

describe("BrandInput", () => {
  it("trims and turns empty optional texts into null", () => {
    expect(brands.BrandInput.parse({ name: " Kids ", description: "  ", industry: " Odonto " })).toEqual({
      name: "Kids", description: null, industry: "Odonto",
    });
  });

  it.each([
    ["name", ""],
    ["name", "x".repeat(81)],
    ["description", "x".repeat(1001)],
    ["industry", "x".repeat(121)],
    ["targetAudience", "x".repeat(501)],
    ["brandVoice", "x".repeat(501)],
  ])("rejects %s with %#", (field, value) => {
    expect(brands.BrandInput.safeParse({ [field]: value }).success).toBe(false);
  });
});

describe("brands.create, update, remove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertBrand.mockImplementation(async (_u, _o, f) => row(f));
    updateBrand.mockImplementation(async () => row({ target_audience: "Pais" }));
  });

  it("creates inside the user's company and audits", async () => {
    const brand = await brands.create("u1", { organizationId: ORG, name: "Sorriso Kids", targetAudience: "Pais" });
    expect(insertBrand).toHaveBeenCalledWith("u1", ORG, { name: "Sorriso Kids", target_audience: "Pais" });
    expect(brand).toMatchObject({ id: ID, name: "Sorriso Kids", organizationSlug: "clinica" });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "brand.create", entityId: ID }));
  });

  it("propagates the 404 when the company is someone else's", async () => {
    insertBrand.mockRejectedValue(notFound("Empresa", "a"));
    await expect(brands.create("u2", { organizationId: ORG, name: "X" })).rejects.toMatchObject({ status: 404 });
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("turns a repeated name into a 409", async () => {
    insertBrand.mockRejectedValue(uniqueViolation());
    await expect(brands.create("u1", { organizationId: ORG, name: "sorriso kids" })).rejects.toMatchObject({
      code: "brand_conflict",
      status: 409,
    });
    updateBrand.mockRejectedValue(uniqueViolation());
    await expect(brands.update("u1", ID, { name: "Outra" })).rejects.toMatchObject({ status: 409 });
  });

  it("updates only the given fields and audits", async () => {
    await brands.update("u1", ID, { targetAudience: "Pais" });
    expect(updateBrand).toHaveBeenCalledWith("u1", ID, { target_audience: "Pais" });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "brand.update", metadata: { fields: ["targetAudience"] } }));
  });

  it("rejects invalid input before touching the model", async () => {
    await expect(brands.update("u1", ID, { name: "" })).rejects.toBeInstanceOf(DomainError);
    expect(updateBrand).not.toHaveBeenCalled();
  });

  it("deletes, removes the files and audits", async () => {
    deleteBrand.mockResolvedValue({ name: "Sorriso Kids", keys: ["u1/brands/b/a.png"] });
    await brands.remove("u1", ID);
    expect(removeOrphans).toHaveBeenCalledWith(["u1/brands/b/a.png"]);
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "brand.delete" }));
  });

  it("treats a malformed id as not found", async () => {
    await expect(brands.get("u1", "nope")).rejects.toMatchObject({ status: 404 });
    expect(getBrand).not.toHaveBeenCalled();
  });
});

describe("BrandInput brand kit", () => {
  const parse = (kit: object) => brands.BrandInput.safeParse(kit);

  it("accepts colors with roles and uppercases the hex", () => {
    const out = brands.BrandInput.parse({ colorPalette: [{ hex: "#1a2b3c", role: "primary" }] });
    expect(out.colorPalette).toEqual([{ hex: "#1A2B3C", role: "primary" }]);
  });

  it.each([
    ["a color name", { colorPalette: [{ hex: "azulzinho", role: "primary" }] }],
    ["a short hex", { colorPalette: [{ hex: "#abc", role: "primary" }] }],
    ["an unknown role", { colorPalette: [{ hex: "#AABBCC", role: "brand" }] }],
    ["11 colors", { colorPalette: Array.from({ length: 11 }, () => ({ hex: "#AABBCC", role: "other" })) }],
    ["6 fonts", { typography: Array.from({ length: 6 }, () => ({ family: "Inter", usage: "body" })) }],
    ["an empty font family", { typography: [{ family: " ", usage: "body" }] }],
    ["an unknown font usage", { typography: [{ family: "Inter", usage: "caption" }] }],
    ["a 501-char guideline", { visualGuidelines: ["x".repeat(501)] }],
    ["31 forbidden elements", { forbiddenElements: Array.from({ length: 31 }, () => "x") }],
    ["an empty forbidden element", { forbiddenElements: ["  "] }],
  ])("rejects %s", (_, kit) => expect(parse(kit).success).toBe(false));

  it("accepts the limits", () => {
    expect(
      parse({
        colorPalette: Array.from({ length: 10 }, () => ({ hex: "#AABBCC", role: "other" })),
        typography: Array.from({ length: 5 }, () => ({ family: "Inter", usage: "body" })),
        visualGuidelines: Array.from({ length: 30 }, () => "x".repeat(500)),
        forbiddenElements: [],
      }).success,
    ).toBe(true);
  });

  it("saves the kit in its columns", async () => {
    updateBrand.mockResolvedValue(row());
    await brands.update("u1", ID, { colorPalette: [], typography: [], visualGuidelines: ["Fundo claro"], forbiddenElements: ["Neon"] });
    expect(updateBrand).toHaveBeenCalledWith("u1", ID, {
      color_palette: [], typography: [], visual_guidelines: ["Fundo claro"], forbidden_elements: ["Neon"],
    });
  });
});
