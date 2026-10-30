import "server-only";
import { Agent, run, user } from "@openai/agents";
import { z } from "zod";

// Rubric points per criterion; the sum is the score (0-100).
const Review = z.object({
  brand: z.number().describe("0 a 25: segue a direção de arte e as cores da marca"),
  originality: z.number().describe("0 a 25: composição surpreendente; foto de banco de imagens ou template vale no máximo 10"),
  hierarchy: z.number().describe("0 a 20: texto sobreposto legível, um ponto focal claro"),
  message: z.number().describe("0 a 20: a imagem comunica a ideia e o texto do slide"),
  technical: z.number().describe("0 a 10: sem mãos, rostos ou objetos deformados"),
  critical: z
    .array(z.string())
    .describe(
      "Erros que reprovam sozinhos: letras ou palavras desenhadas pela IA (fora do texto sobreposto), logotipo inventado, defeito anatômico grave, antes e depois ou resultado de tratamento. Vazio se não houver.",
    ),
  fixes: z
    .string()
    .describe(
      "Correções da foto para a próxima versão (cena, ângulo, luz, cores, composição), em uma ou duas frases. Nunca peça texto, letreiro nem logotipo na imagem: o sistema aplica o texto depois.",
    ),
});

export type ArtReview = { score: number; critical: string[]; fixes: string };

// ponytail: threshold picked by hand, not calibrated against human designers yet; compare the
// logged scores with what the team approves and adjust.
export const MIN_SCORE = 85;

const critic = new Agent({
  name: "Crítico de arte",
  instructions: `Você é um diretor de arte sênior e exigente avaliando uma arte de anúncio para o
Instagram antes da entrega. O texto em branco e negrito no topo foi aplicado pelo sistema de
propósito: avalie a legibilidade dele, mas não o conte como texto desenhado pela IA.
Não confunda imagem bonita com boa peça publicitária: dê nota alta só quando a imagem para a
rolagem e comunica a ideia. Pessoas posando e sorrindo para a câmera, aperto de mão, fundo liso de
estúdio, gradientes genéricos, ícones 3D e estética de template corporativo são genéricos.
Se a direção de arte pedir um estilo (produto em estúdio, 3D, ilustração), ele é a escolha do
cliente: avalie a execução dentro dele, sem penalizar o estilo.
Responda em português do Brasil.`,
  model: process.env.OPENAI_MODEL || undefined,
  outputType: Review,
});

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n)));

export async function reviewArt(
  jpeg: Uint8Array,
  brief: { idea: string; text: string; artDirection?: string },
): Promise<ArtReview> {
  const image = `data:image/jpeg;base64,${Buffer.from(jpeg).toString("base64")}`;
  const context = [
    `Ideia do criativo: ${brief.idea}`,
    `Texto do slide: ${brief.text}`,
    brief.artDirection && `Direção de arte pedida: ${brief.artDirection}`,
  ]
    .filter(Boolean)
    .join("\n");
  const input = user([
    { type: "input_image", image },
    { type: "input_text", text: `Avalie esta arte.\n${context}` },
  ]);
  const result = await run(critic, [input], { maxTurns: 1 });
  const r = Review.parse(result.finalOutput);
  const score =
    clamp(r.brand, 25) + clamp(r.originality, 25) + clamp(r.hierarchy, 20) + clamp(r.message, 20) + clamp(r.technical, 10);
  return { score, critical: r.critical.filter((c) => c.trim()), fixes: r.fixes };
}

export const approved = (r: ArtReview) => r.score >= MIN_SCORE && r.critical.length === 0;
