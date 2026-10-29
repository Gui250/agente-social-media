import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { readableOn, withLogo } from "@/services/overlay";

describe("readableOn", () => {
  it("puts white text on dark colors and dark text on light ones", () => {
    expect(readableOn("#1A2B4C")).toBe("#FFFFFF");
    expect(readableOn("#000000")).toBe("#FFFFFF");
    expect(readableOn("#FFD400")).toBe("#111111");
    expect(readableOn("#FFFFFF")).toBe("#111111");
  });
});

describe("withLogo", () => {
  it("stamps the logo in the bottom-right corner and keeps the image size", async () => {
    const image = await sharp({ create: { width: 1088, height: 1360, channels: 3, background: "#000000" } }).jpeg().toBuffer();
    const logo = await sharp({ create: { width: 400, height: 100, channels: 3, background: "#FF0000" } }).jpeg().toBuffer();

    const out = sharp(await withLogo(image, logo));
    expect(await out.metadata()).toMatchObject({ width: 1088, height: 1360 });
    const { data, info } = await out.raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
    const [r, g, b] = pixel(1088 - 48 - 160, 1360 - 48 - 50); // inside the logo
    expect(r).toBeGreaterThan(200);
    expect(g + b).toBeLessThan(80);
    expect(Math.max(...pixel(40, 40))).toBeLessThan(20); // rest of the image untouched
  });
});
