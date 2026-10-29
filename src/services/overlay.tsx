import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { IMAGE_SIZE } from "@/services/creative-gen";

const { width: W, height: H } = IMAGE_SIZE;
let font: Promise<Buffer> | undefined;

// The model draws no text (visualPrompt asks for a clear top third); the slide text goes on top
// here, with the app's own font, so Portuguese is always spelled right and legible.
export async function withText(image: Uint8Array, text: string): Promise<Uint8Array> {
  if (!text.trim()) return image;
  font ??= readFile(join(process.cwd(), "assets/fonts/Geist-ExtraBold.ttf"));
  const src = `data:image/jpeg;base64,${Buffer.from(image).toString("base64")}`;
  const png = new ImageResponse(
    <div style={{ width: W, height: H, display: "flex", position: "relative" }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- Satori, not the DOM */}
      <img src={src} width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }} />
      {/* Darkens the top so white text reads even on a bright photo. */}
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
      <div
        style={{
          display: "flex",
          padding: "96px 80px",
          fontSize: text.length > 120 ? 48 : text.length > 60 ? 60 : 76,
          lineHeight: 1.08,
          color: "white",
          fontWeight: 800,
          textShadow: "0 4px 28px rgba(0,0,0,0.6)",
        }}
      >
        {text}
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
