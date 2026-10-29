import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { IMAGE_SIZE } from "@/services/creative-gen";

const { width: W, height: H } = IMAGE_SIZE;
let font: Promise<Buffer> | undefined;

// Dark or light text, whichever reads better on a #RRGGBB background (WCAG relative luminance).
export function readableOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#111111" : "#FFFFFF";
}

// The model draws no text (visualPrompt asks for a clear top third); the slide text goes on top
// here, with the app's own font, so Portuguese is always spelled right and legible. With a brand
// color the text sits on a band of that color; without one, on a dark gradient.
export async function withText(image: Uint8Array, text: string, color?: string | null): Promise<Uint8Array> {
  if (!text.trim()) return image;
  font ??= readFile(join(process.cwd(), "assets/fonts/Geist-ExtraBold.ttf"));
  const src = `data:image/jpeg;base64,${Buffer.from(image).toString("base64")}`;
  const png = new ImageResponse(
    <div style={{ width: W, height: H, display: "flex", position: "relative" }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- Satori, not the DOM */}
      <img src={src} width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }} />
      {/* Darkens the top so white text reads even on a bright photo. */}
      {!color && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: W,
            height: H * 0.55,
            backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0))",
          }}
        />
      )}
      <div style={{ display: "flex", alignItems: "flex-start", padding: "96px 80px" }}>
        <div
          style={{
            display: "flex",
            fontSize: text.length > 120 ? 48 : text.length > 60 ? 60 : 76,
            lineHeight: 1.08,
            fontWeight: 800,
            ...(color
              ? { color: readableOn(color), backgroundColor: color, padding: "20px 32px", borderRadius: 20 }
              : { color: "white", textShadow: "0 4px 28px rgba(0,0,0,0.6)" }),
          }}
        >
          {text}
        </div>
      </div>
    </div>,
    { width: W, height: H, fonts: [{ name: "Geist", data: await font, weight: 800, style: "normal" }] },
  );
  return sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 90 }).toBuffer();
}

// Any JPEG → exactly width x height (center crop), e.g. a product photo as a video's first frame.
export function fitTo(image: Uint8Array, { width, height }: { width: number; height: number }) {
  return sharp(image).resize(width, height, { fit: "cover" }).jpeg({ quality: 90 }).toBuffer();
}

// The brand's logo on a white rounded badge in the bottom-right corner. The badge works with any
// logo file: uploads are JPEG, so a transparent PNG logo already arrives on white.
export async function withLogo(image: Uint8Array, logo: Uint8Array): Promise<Uint8Array> {
  const pad = 20;
  const margin = 48;
  const inner = await sharp(logo)
    .resize({ width: 280, height: 140, fit: "inside" })
    .flatten({ background: "#ffffff" })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#ffffff" })
    .png()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = inner.info;
  const mask = Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="24"/></svg>`);
  const badge = await sharp(inner.data).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const { width: iw = W, height: ih = H } = await sharp(image).metadata();
  return sharp(image)
    .composite([{ input: badge, left: iw - width - margin, top: ih - height - margin }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
