import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { parseSlide, readableOn, withLogo } from "@/services/overlay";

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
    const [r, g, b] = pixel(1088 - 72 - 100, 1360 - 72 - 44); // inside the logo
    expect(r).toBeGreaterThan(200);
    expect(g + b).toBeLessThan(80);
    expect(Math.max(...pixel(40, 40))).toBeLessThan(20); // rest of the image untouched
  });

  it("moves to the top-right corner when the text is at the bottom", async () => {
    const image = await sharp({ create: { width: 1088, height: 1360, channels: 3, background: "#000000" } }).jpeg().toBuffer();
    const logo = await sharp({ create: { width: 400, height: 100, channels: 3, background: "#FF0000" } }).jpeg().toBuffer();

    const { data, info } = await sharp(await withLogo(image, logo, "top")).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
    expect(pixel(1088 - 72 - 100, 72 + 44)[0]).toBeGreaterThan(200); // inside the logo, at the top
    expect(Math.max(...pixel(1088 - 72 - 100, 1360 - 72 - 44))).toBeLessThan(20); // bottom corner free
  });
});

describe("parseSlide", () => {
  it("splits headline and support line and keeps a highlighted phrase whole", () => {
    expect(parseSlide("Seu sorriso *chega antes*\nAgende uma *avaliação*.")).toEqual({
      words: [
        { word: "Seu", mark: false },
        { word: "sorriso", mark: false },
        { word: "chega antes", mark: true },
      ],
      body: "Agende uma avaliação.",
    });
  });

  it("treats plain text as all headline", () => {
    expect(parseSlide("Uma colher. Silêncio.")).toEqual({
      words: [
        { word: "Uma", mark: false },
        { word: "colher.", mark: false },
        { word: "Silêncio.", mark: false },
      ],
      body: null,
    });
  });
});
