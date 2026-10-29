import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const objectInfo = vi.fn();
const readObject = vi.fn();
const putObject = vi.fn();
const removeObjects = vi.fn();
const insertMedia = vi.fn();

vi.mock("@/lib/storage", () => ({ objectInfo, readObject, putObject, removeObjects, uploadUrl: vi.fn() }));
vi.mock("@/models/media", () => ({ insertMedia }));

const { register, requestUpload } = await import("@/controllers/media");

describe("media.register with PNG", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMedia.mockImplementation(async (row) => ({ id: "m1", ...row }));
  });

  it("accepts PNG uploads", async () => {
    const { uploadUrl } = await import("@/lib/storage");
    vi.mocked(uploadUrl).mockResolvedValue("https://put");
    expect((await requestUpload("u1", "image/png")).storagePath).toMatch(/^u1\/.+\.png$/);
  });

  it("stores a JPEG (transparency over white) and deletes the PNG", async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer();
    objectInfo.mockResolvedValue({ contentType: "image/png", size: png.byteLength });
    readObject.mockResolvedValue(new Uint8Array(png));

    const media = await register("u1", "u1/abc.png");

    const [path, bytes, type] = putObject.mock.calls[0];
    expect([path, type]).toEqual(["u1/abc.jpg", "image/jpeg"]);
    const { format } = await sharp(bytes).metadata();
    const { dominant } = await sharp(bytes).stats();
    expect(format).toBe("jpeg");
    expect(dominant.r).toBeGreaterThan(240); // white, not black
    expect(removeObjects).toHaveBeenCalledWith(["u1/abc.png"]);
    expect(media).toMatchObject({ storage_path: "u1/abc.jpg", mime_type: "image/jpeg", kind: "image" });
  });

  it("rejects and deletes a file that isn't really a PNG", async () => {
    objectInfo.mockResolvedValue({ contentType: "image/png", size: 10 });
    readObject.mockResolvedValue(new Uint8Array([1, 2, 3]));

    await expect(register("u1", "u1/bad.png")).rejects.toBeInstanceOf(DomainError);
    expect(removeObjects).toHaveBeenCalledWith(["u1/bad.png"]);
    expect(putObject).not.toHaveBeenCalled();
    expect(insertMedia).not.toHaveBeenCalled();
  });
});
