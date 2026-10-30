import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { DEFAULT_LAYOUT, isDark, type TextLayout } from "@/agent/visual-prompt";
import { IMAGE_SIZE } from "@/services/creative-gen";

const { width: W, height: H } = IMAGE_SIZE;
const fontFile = (name: string) => readFile(join(process.cwd(), "assets/fonts", name));
let fonts: Promise<[Buffer, Buffer]> | undefined;

// The grid every slide shares: outer margin, and the "chrome" row (page bar on the left, logo on the
// right) on the side opposite the text. withLogo uses the same numbers so the logo lines up with it.
const M = 72;
const ROW = 88;
const GAP = 32;

// Dark or light text, whichever reads better on a #RRGGBB background.
export const readableOn = (hex: string) => (isDark(hex) ? "#FFFFFF" : "#111111");

// The chrome row and the logo go on the side the text leaves free.
export const chromeSide = (layout: TextLayout) => (layout.position === "bottom" ? "top" : "bottom");

const JUSTIFY = { top: "flex-start", center: "center", bottom: "flex-end" } as const;
// The darkening behind light text starts at the text's side of the image.
const SHADE = {
  top: "linear-gradient(to bottom, rgba(0,0,0,0.65), rgba(0,0,0,0) 60%)",
  center: "linear-gradient(to bottom, rgba(0,0,0,0) 15%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0) 85%)",
  bottom: "linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0) 60%)",
} as const;

// Slide text: the first line is the headline, the rest a supporting line; *words* between asterisks
// are highlighted. Text without line breaks or asterisks is all headline, as before.
export function parseSlide(text: string) {
  const [first, ...rest] = text.trim().split(/\n+/);
  // A highlighted phrase stays one piece (one highlight, never split across lines).
  const words = first.split(/(\*[^*]+\*)/).flatMap((part): { word: string; mark: boolean }[] => {
    const mark = /^\*[^*]+\*$/.test(part);
    const clean = part.replace(/\*/g, "").trim();
    if (!clean) return [];
    return mark ? [{ word: clean, mark }] : clean.split(/\s+/).map((word) => ({ word, mark }));
  });
  const body = rest.join(" ").replace(/\*/g, "").trim();
  return { words, body: body || null };
}

// Headline size by its length, so a short punchline fills the slide and a long one still fits.
function headlineSize(chars: number, layout: TextLayout) {
  const base = chars > 80 ? 54 : chars > 45 ? 66 : chars > 22 ? 80 : 96;
  return Math.round(base * (layout.size === "large" ? 1 : 0.8) * (layout.uppercase ? 0.9 : 1));
}

type Design = {
  layout?: TextLayout;
  // The brand's color: fills the box or band and the highlights (it beats the references' colors).
  color?: string | null;
  // Position in a carousel: draws the page bar, and "Arraste" on the cover.
  page?: { index: number; total: number };
  // Call to action, drawn as a button (only passed for the last slide).
  cta?: string | null;
};

// The model draws no text (visualPrompt leaves a clean area where the layout puts it); the slide
// text goes on top here, with the app's own fonts, so Portuguese is always spelled right. The
// layout comes from the reference creatives; the rest of the design (hierarchy, highlights, page
// bar, CTA button) is the same on every slide so a carousel reads as one piece.
export async function withText(
  image: Uint8Array,
  text: string,
  { layout = DEFAULT_LAYOUT, color = null, page, cta = null }: Design = {},
): Promise<Uint8Array> {
  if (!text.trim()) return image;
  fonts ??= Promise.all([fontFile("Geist-ExtraBold.ttf"), fontFile("Geist-Regular.ttf")]);
  const [bold, regular] = await fonts;
  const src = `data:image/jpeg;base64,${Buffer.from(image).toString("base64")}`;
  const { treatment, position, align } = layout;
  const upper = (s: string) => (layout.uppercase ? s.toLocaleUpperCase("pt-BR") : s);
  const { words, body } = parseSlide(text);
  const fontSize = headlineSize(words.reduce((n, w) => n + w.word.length + 1, 0), layout);

  // Text on a colored block (box/band) vs. straight on the photo (shadow/plain).
  const fill = color ?? layout.background ?? "#111111";
  const onBlock = treatment === "box" || treatment === "band";
  const ink = onBlock
    ? readableOn(fill)
    : treatment === "plain"
      ? (layout.color ?? "#111111")
      : layout.color && !isDark(layout.color) ? layout.color : "#FFFFFF";
  // Highlights and the CTA: inverted inside a block, the brand color (or white) on the photo.
  const accent = onBlock ? ink : (color ?? layout.background ?? (treatment === "plain" ? ink : "#FFFFFF"));
  const onAccent = onBlock ? fill : readableOn(accent);
  // Satori breaks on style keys set to undefined, so optional styles are spread in.
  const shadow = treatment === "shadow" ? { textShadow: "0 4px 28px rgba(0,0,0,0.55)" } : {};

  const side = chromeSide(layout);
  const showCta = !!cta && cta.length <= 48 && !text.toLowerCase().includes(cta.toLowerCase());
  const carousel = page && page.total > 1;
  // A band touches the edge on the text's side; everything else keeps the margin, and the side
  // with the chrome row keeps clear of it.
  const clear = M + ROW + GAP;
  const pad = {
    top: position === "top" ? (treatment === "band" ? 0 : M) : clear,
    bottom: position === "bottom" ? (treatment === "band" ? 0 : M) : clear,
  };
  const block =
    treatment === "box"
      ? { backgroundColor: fill, padding: "28px 36px", borderRadius: 24 }
      : treatment === "band"
        ? { backgroundColor: fill, padding: `48px ${M}px`, width: W }
        : {};
  const items = align === "center" ? "center" : "flex-start";

  const png = new ImageResponse(
    <div style={{ width: W, height: H, display: "flex", position: "relative", fontFamily: "Geist" }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- Satori, not the DOM */}
      <img src={src} width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }} />
      {treatment === "shadow" && (
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, backgroundImage: SHADE[position] }} />
      )}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          display: "flex",
          flexDirection: "column",
          width: W,
          height: H,
          justifyContent: JUSTIFY[position],
          alignItems: items,
          paddingTop: pad.top,
          paddingBottom: pad.bottom,
          paddingLeft: treatment === "band" ? 0 : M,
          paddingRight: treatment === "band" ? 0 : M,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: items, maxWidth: W - 2 * M, ...block }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: items,
              columnGap: Math.round(fontSize * 0.22),
              rowGap: Math.round(fontSize * 0.08),
              fontSize,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -fontSize * 0.02,
              color: ink,
              ...shadow,
            }}
          >
            {words.map(({ word, mark }, i) => (
              <span
                key={i}
                style={
                  mark
                    ? {
                        color: onAccent,
                        backgroundColor: accent,
                        padding: `0 ${Math.round(fontSize * 0.12)}px`,
                        borderRadius: Math.round(fontSize * 0.12),
                        textShadow: "none",
                      }
                    : {}
                }
              >
                {upper(word)}
              </span>
            ))}
          </div>
          {body && (
            <div
              style={{
                display: "flex",
                marginTop: Math.round(fontSize * 0.35),
                maxWidth: 760,
                fontSize: layout.size === "large" ? 40 : 34,
                fontWeight: 400,
                lineHeight: 1.3,
                color: ink,
                textAlign: align,
                ...shadow,
              }}
            >
              {body}
            </div>
          )}
          {showCta && (
            <div
              style={{
                display: "flex",
                marginTop: 36,
                padding: "20px 36px",
                borderRadius: 999,
                fontSize: 32,
                fontWeight: 800,
                color: onAccent,
                backgroundColor: accent,
                ...(onBlock ? {} : { boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }),
              }}
            >
              {cta}
            </div>
          )}
        </div>
      </div>
      {carousel && (
        <div
          style={{
            position: "absolute",
            left: M,
            [side]: M,
            height: ROW,
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            {Array.from({ length: page.total }, (_, i) => (
              <div
                key={i}
                style={{
                  width: i === page.index ? 56 : 24,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === page.index ? "#FFFFFF" : "rgba(255,255,255,0.45)",
                  boxShadow: "0 1px 6px rgba(0,0,0,0.35)",
                }}
              />
            ))}
          </div>
          {page.index === 0 && (
            <div style={{ display: "flex", fontSize: 30, fontWeight: 400, color: "#FFFFFF", textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
              Arraste →
            </div>
          )}
        </div>
      )}
    </div>,
    {
      width: W,
      height: H,
      fonts: [
        { name: "Geist", data: bold, weight: 800, style: "normal" },
        { name: "Geist", data: regular, weight: 400, style: "normal" },
      ],
    },
  );
  return sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 92 }).toBuffer();
}

// Any JPEG → exactly width x height (center crop), e.g. a product photo as a video's first frame.
export function fitTo(image: Uint8Array, { width, height }: { width: number; height: number }) {
  return sharp(image).resize(width, height, { fit: "cover" }).jpeg({ quality: 90 }).toBuffer();
}

// The brand's logo on a white rounded badge at the right end of the chrome row (bottom, or top when
// the text sits at the bottom). The badge works with any logo file: uploads are JPEG, so a
// transparent PNG logo already arrives on white.
export async function withLogo(image: Uint8Array, logo: Uint8Array, corner: "bottom" | "top" = "bottom"): Promise<Uint8Array> {
  const pad = 16;
  const inner = await sharp(logo)
    .resize({ width: 200, height: ROW - 2 * pad, fit: "inside" })
    .flatten({ background: "#ffffff" })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#ffffff" })
    .png()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = inner.info;
  const mask = Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="18"/></svg>`);
  const badge = await sharp(inner.data).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const { width: iw = W, height: ih = H } = await sharp(image).metadata();
  const rowTop = corner === "top" ? M : ih - M - ROW;
  return sharp(image)
    .composite([{ input: badge, left: iw - width - M, top: rowTop + Math.round((ROW - height) / 2) }])
    .jpeg({ quality: 92 })
    .toBuffer();
}
