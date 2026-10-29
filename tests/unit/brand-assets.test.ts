import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const objectInfo = vi.fn();
const readObject = vi.fn();
const removeObjects = vi.fn();
const removeOrphans = vi.fn();
const uploadUrl = vi.fn();
const downloadUrl = vi.fn();
const getBrand = vi.fn();
const insertAsset = vi.fn();
const replaceLogo = vi.fn();
const countNonLogoAssets = vi.fn();
const deleteAsset = vi.fn();
const recordAudit = vi.fn();

vi.mock("@/lib/storage", () => ({ objectInfo, readObject, removeObjects, removeOrphans, uploadUrl, downloadUrl }));
vi.mock("@/models/brand", () => ({ getBrand }));
vi.mock("@/models/brand-asset", () => ({ insertAsset, replaceLogo, countNonLogoAssets, deleteAsset, listAssets: vi.fn() }));
vi.mock("@/models/audit", () => ({ recordAudit }));

const brands = await import("@/controllers/brands");

const BRAND = "33333333-3333-4333-8333-333333333333";
const ASSET = "44444444-4444-4444-8444-444444444444";
const key = (ext: string) => `u1/brands/${BRAND}/aaaa.${ext}`;

const image = (width: number, height: number, format: "png" | "jpeg" | "webp" = "png") =>
  sharp({ create: { width, height, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } } })
    .toFormat(format)
    .toBuffer();

// Stores `bytes` under the key as the Blob store would.
function stored(bytes: Uint8Array, size = bytes.byteLength) {
  objectInfo.mockResolvedValue({ contentType: "image/png", size });
  readObject.mockResolvedValue(new Uint8Array(bytes));
}

const rejected = async (p: Promise<unknown>, code = "invalid_asset") => {
  await expect(p).rejects.toMatchObject({ code });
};

describe("brands.registerAsset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBrand.mockResolvedValue({ id: BRAND });
    countNonLogoAssets.mockResolvedValue(0);
    downloadUrl.mockResolvedValue("https://signed");
    insertAsset.mockImplementation(async (_u, r) => ({ id: ASSET, ...r }));
    replaceLogo.mockImplementation(async (_u, r) => ({ asset: { id: ASSET, ...r }, oldKey: null }));
  });

  it("accepts a real PNG logo with its real type and size", async () => {
    stored(await image(128, 96));
    const asset = await brands.registerAsset("u1", BRAND, key("png"), "logo");
    expect(asset).toMatchObject({ id: ASSET, assetType: "logo", mimeType: "image/png", width: 128, height: 96, url: "https://signed" });
    expect(removeObjects).not.toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "brand_asset.create" }));
  });

  it("accepts JPEG and WebP", async () => {
    stored(await image(64, 64, "jpeg"));
    expect(await brands.registerAsset("u1", BRAND, key("jpg"), "other")).toMatchObject({ mimeType: "image/jpeg" });
    stored(await image(64, 64, "webp"));
    expect(await brands.registerAsset("u1", BRAND, key("webp"), "logo_alt")).toMatchObject({ mimeType: "image/webp" });
  });

  it.each([
    ["text under a .png key", async () => new TextEncoder().encode("não sou uma imagem"), "png"],
    ["a truncated PNG", async () => (await image(128, 128)).subarray(0, 60), "png"],
    ["a 32×32 PNG", () => image(32, 32), "png"],
    ["a 9000-px-wide PNG", () => image(9000, 64), "png"],
    ["a JPEG under a .png key", () => image(128, 128, "jpeg"), "png"],
  ])("rejects %s and deletes the object", async (_, bytes, ext) => {
    stored(new Uint8Array(await bytes()));
    await rejected(brands.registerAsset("u1", BRAND, key(ext), "logo"));
    expect(removeObjects).toHaveBeenCalledWith([key(ext)]);
    expect(insertAsset).not.toHaveBeenCalled();
    expect(replaceLogo).not.toHaveBeenCalled();
  });

  it("rejects more than 10 MB without reading it", async () => {
    objectInfo.mockResolvedValue({ contentType: "image/png", size: 10 * 1024 * 1024 + 1 });
    await rejected(brands.registerAsset("u1", BRAND, key("png"), "logo"));
    expect(readObject).not.toHaveBeenCalled();
    expect(removeObjects).toHaveBeenCalledWith([key("png")]);
  });

  it.each([
    `u2/brands/${BRAND}/aaaa.png`,
    `u1/brands/${ASSET}/aaaa.png`,
    `u1/brands/${BRAND}/../x.png`,
    `u1/brands/${BRAND}/aaaa.gif`,
  ])("treats %s as not found without reading it", async (k) => {
    await expect(brands.registerAsset("u1", BRAND, k, "logo")).rejects.toMatchObject({ status: 404 });
    expect(objectInfo).not.toHaveBeenCalled();
    expect(readObject).not.toHaveBeenCalled();
  });

  it("refuses a 6th file besides the logo", async () => {
    countNonLogoAssets.mockResolvedValue(5);
    stored(await image(128, 128));
    await rejected(brands.registerAsset("u1", BRAND, key("png"), "other"), "asset_limit");
    expect(removeObjects).toHaveBeenCalledWith([key("png")]);
    expect(insertAsset).not.toHaveBeenCalled();
  });

  it("replaces the logo and removes the old file", async () => {
    replaceLogo.mockImplementation(async (_u, r) => ({ asset: { id: ASSET, ...r }, oldKey: "u1/brands/old.png" }));
    stored(await image(128, 128));
    await brands.registerAsset("u1", BRAND, key("png"), "logo");
    expect(replaceLogo).toHaveBeenCalledWith("u1", expect.objectContaining({ brand_id: BRAND, storage_key: key("png") }));
    expect(removeOrphans).toHaveBeenCalledWith(["u1/brands/old.png"]);
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "brand_asset.replace" }));
  });
});

describe("brands.requestUpload and removeAsset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBrand.mockResolvedValue({ id: BRAND });
    uploadUrl.mockResolvedValue("https://put");
  });

  it("signs a PUT under the brand's folder, up to 10 MB, cached for 1 minute", async () => {
    const { storageKey, uploadUrl: url } = await brands.requestUpload("u1", BRAND, "image/webp");
    expect(storageKey).toMatch(new RegExp(`^u1/brands/${BRAND}/[0-9a-f-]{36}\\.webp$`));
    expect(url).toBe("https://put");
    expect(uploadUrl).toHaveBeenCalledWith(storageKey, "image/webp", 10 * 1024 * 1024, 60);
  });

  it("rejects other types", async () => {
    await rejected(brands.requestUpload("u1", BRAND, "image/gif"));
    expect(uploadUrl).not.toHaveBeenCalled();
  });

  it("deletes the file, its object and audits", async () => {
    deleteAsset.mockResolvedValue("u1/brands/x.png");
    await brands.removeAsset("u1", BRAND, ASSET);
    expect(deleteAsset).toHaveBeenCalledWith("u1", BRAND, ASSET);
    expect(removeOrphans).toHaveBeenCalledWith(["u1/brands/x.png"]);
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "brand_asset.delete", entityId: ASSET }));
  });
});
