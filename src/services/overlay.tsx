import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { DEFAULT_LAYOUT, isDark, type TextLayout } from "@/agent/visual-prompt";
import { IMAGE_SIZE } from "@/services/creative-gen";

const { width: W, height: H } = IMAGE_SIZE;
let font: Promise<Buffer> | undefined;

// Dark or light text, whichever reads better on a #RRGGBB background.
export const readableOn = (hex: string) => (isDark(hex) ? "#FFFFFF" : "#111111");

const JUSTIFY = { top: "flex-start", center: "center", bottom: "flex-end" } as const;
// The darkening behind light text starts at the text's side of the image.
const SHADE = {
  top: "linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0) 55%)",
  center: "linear-gradient(to bottom, rgba(0,0,0,0) 20%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 80%)",
  bottom: "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0) 55%)",
} as const;

// The model draws no text (visualPrompt leaves a clean area where the layout puts it); the slide
// text goes on top here, with the app's own font, so Portuguese is always spelled right. The
// layout comes from the reference creatives; `color` (the brand's) wins over theirs for the box
// or band, since the brand kit beats the references.
export async function withText(
  image: Uint8Array,
  text: string,
  { layout = DEFAULT_LAYOUT, color = null }: { layout?: TextLayout; color?: string | null } = {},
): Promise<Uint8Array> {
  if (!text.trim()) return image;
  font ??= readFile(join(process.cwd(), "assets/fonts/Geist-ExtraBold.ttf"));
  const src = `data:image/jpeg;base64,${Buffer.from(image).toString("base64")}`;
  const content = layout.uppercase ? text.toLocaleUpperCase("pt-BR") : text;
  const scale = layout.size === "large" ? 1 : 0.8;
  const fontSize = Math.round((text.length > 120 ? 48 : text.length > 60 ? 60 : 76) * scale);
  const { treatment } = layout;
  const fill = color ?? layout.background ?? "#111111";
  const look =
    treatment === "box"
      ? { color: readableOn(fill), backgroundColor: fill, padding: "20px 32px", borderRadius: 20 }
      : treatment === "band"
        ? { color: readableOn(fill), backgroundColor: fill, padding: "40px 80px", width: W }
        : treatment === "plain"
          ? { color: layout.color ?? "#111111" }
          : { color: layout.color && isDark(layout.color) ? "#FFFFFF" : (layout.color ?? "#FFFFFF"), textShadow: "0 4px 28px rgba(0,0,0,0.6)" };

  const png = new ImageResponse(
    <div style={{ width: W, height: H, display: "flex", position: "relative" }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- Satori, not the DOM */}
      <img src={src} width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }} />
      {treatment === "shadow" && (
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, backgroundImage: SHADE[layout.position] }} />
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: W,
          height: H,
          justifyContent: JUSTIFY[layout.position],
          alignItems: layout.align === "center" ? "center" : "flex-start",
          // A band runs edge to edge and touches the image's edge; everything else keeps the margins.
          padding: treatment === "band" ? 0 : "96px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize,
            lineHeight: 1.08,
            fontWeight: 800,
            textAlign: layout.align,
            justifyContent: layout.align === "center" ? "center" : "flex-start",
            maxWidth: treatment === "band" ? W : W - 160,
            ...look,
          }}
        >
          {content}
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

// The brand's logo on a white rounded badge in the bottom-right corner, or the top-right one when
// the text sits at the bottom. The badge works with any logo file: uploads are JPEG, so a
// transparent PNG logo already arrives on white.
export async function withLogo(image: Uint8Array, logo: Uint8Array, corner: "bottom" | "top" = "bottom"): Promise<Uint8Array> {
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
    .composite([{ input: badge, left: iw - width - margin, top: corner === "top" ? margin : ih - height - margin }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
