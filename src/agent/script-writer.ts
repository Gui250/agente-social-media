import "server-only";
import { Agent, run } from "@openai/agents";
import { z } from "zod";
import { DomainError } from "@/lib/errors";
import { type CreativeScript, creativeScriptFor, type ScriptFormat } from "@/models/creative-script";

const instructions = `Você é um roteirista de criativos para Instagram de pequenos negócios brasileiros.
Escreva sempre em português do Brasil, com linguagem natural do segmento informado.

Estrutura obrigatória:
- title: nome curto do criativo.
- hook: a primeira frase ou cena, feita para prender a atenção nos primeiros 3 segundos.
- blocks:
  - Formato "video" (Reels): cenas "Cena 1", "Cena 2"... com durationSeconds (total entre 15 e 60 s),
    visual (o que gravar) e text (fala ou texto na tela).
  - Formato "static" (post/carrossel): slides "Slide 1", "Slide 2"... com durationSeconds = null,
    visual (descrição da arte) e text (texto do slide). Carrossel tem de 2 a 10 slides; post único, 1.
- caption: legenda pronta para publicar, até 2200 caracteres.
- cta: chamada para ação clara e alinhada ao objetivo.
- hashtags: de 5 a 15, todas começando com "#", relevantes para o segmento.

Não invente preços, endereços, promoções ou números que o usuário não informou.`;

// Same shape as CreativeScript without length/regex limits, which strict structured outputs
// don't reliably support; the real limits are checked with creativeScriptFor() below.
const Output = z.object({
  title: z.string(),
  hook: z.string().describe("Gancho de abertura"),
  blocks: z.array(
    z.object({
      label: z.string().describe('"Cena 1" ou "Slide 1"'),
      durationSeconds: z.number().nullable().describe("Segundos em vídeo; null em estático"),
      visual: z.string().describe("O que aparece na tela"),
      text: z.string().describe("Fala ou texto na tela/slide"),
    }),
  ),
  caption: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()),
});

const scriptWriter = new Agent({
  name: "Roteirista",
  instructions,
  model: process.env.OPENAI_MODEL || undefined,
  outputType: Output,
});

export type ScriptRequest = {
  segment: string;
  format: ScriptFormat;
  objective?: string | null;
  audience?: string | null;
  tone?: string | null;
  // Bodies of the skills the agent chose (src/agent/skills.ts).
  guidelines?: string | null;
};

export async function writeScript(req: ScriptRequest): Promise<CreativeScript> {
  const prompt = [
    `Segmento: ${req.segment}`,
    `Formato: ${req.format}`,
    req.objective && `Objetivo: ${req.objective}`,
    req.audience && `Público-alvo: ${req.audience}`,
    req.tone && `Tom: ${req.tone}`,
    req.guidelines && `Siga estas diretrizes de criação:\n${req.guidelines}`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await run(scriptWriter, prompt, { maxTurns: 1 });
  const parsed = creativeScriptFor(req.format).safeParse(result.finalOutput);
  if (!parsed.success) {
    throw new DomainError(
      "invalid_script",
      "Não consegui gerar um roteiro válido, tente de novo.",
      502,
    );
  }
  return parsed.data;
}
