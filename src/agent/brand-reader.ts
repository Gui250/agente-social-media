import "server-only";
import { Agent, run, user } from "@openai/agents";
import { z } from "zod";

const VisualIdentity = z.object({
  colors: z.array(
    z.object({
      hex: z.string().describe("#RRGGBB"),
      name: z.string().describe("Nome da cor em português, ex.: azul-marinho"),
      role: z.string().describe("primária, secundária, destaque, fundo ou texto"),
    }),
  ),
  logo: z.string().describe("Símbolo, texto e formato do logo; vazio se a imagem não tiver logo"),
  typography: z.string().describe("Estilo das letras, ex.: sem serifa, arredondada, em negrito"),
  style: z.string().describe("Estilo visual e sensação que a marca passa, em uma frase"),
});
export type VisualIdentity = z.infer<typeof VisualIdentity>;

const reader = new Agent({
  name: "Leitor de identidade visual",
  instructions: `Você analisa o logo ou uma arte de uma marca e descreve a identidade visual dela,
em português do Brasil. Liste de 2 a 6 cores da marca, da mais importante para a menos, com o hex
mais próximo do que aparece na imagem. Ignore o fundo branco liso se ele não fizer parte da marca.
Descreva só o que se vê; não invente nome, slogan nem cores.`,
  model: process.env.OPENAI_MODEL || undefined,
  outputType: VisualIdentity,
});

const HEX = /^#[0-9a-f]{6}$/i;

export async function readVisualIdentity(jpeg: Uint8Array): Promise<VisualIdentity> {
  const image = `data:image/jpeg;base64,${Buffer.from(jpeg).toString("base64")}`;
  const input = user([
    { type: "input_image", image },
    { type: "input_text", text: "Extraia a identidade visual desta imagem." },
  ]);
  const result = await run(reader, [input], { maxTurns: 1 });
  const identity = VisualIdentity.parse(result.finalOutput);
  // Strict structured outputs don't enforce regexes, so malformed colors are dropped here.
  return { ...identity, colors: identity.colors.filter((c) => HEX.test(c.hex)).map((c) => ({ ...c, hex: c.hex.toUpperCase() })) };
}
