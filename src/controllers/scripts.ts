import { z } from "zod";
import { writeScript } from "@/agent/script-writer";
import { getSkills } from "@/agent/skills";
import { DomainError } from "@/lib/errors";
import {
  creativeScriptFor,
  deleteScript,
  getScript,
  insertScript,
  listScripts,
  ScriptFormat,
  updateScriptContent,
} from "@/models/creative-script";

const optionalText = z
  .string()
  .trim()
  .max(300)
  .nullish()
  .transform((v) => v || null);

export const GenerateInput = z.object({
  segment: z.string().trim().min(2).max(120),
  format: ScriptFormat,
  objective: optionalText,
  audience: optionalText,
  tone: optionalText,
  skills: z.array(z.string().max(60)).max(3).nullish(),
  visualIdentity: z.string().trim().max(1000).nullish().transform((v) => v || null),
});
export type GenerateInput = z.input<typeof GenerateInput>;

export async function generate(userId: string, input: GenerateInput) {
  const parsed = GenerateInput.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      "invalid_input",
      "Informe o segmento (2 a 120 caracteres) e o formato: vídeo ou estático.",
    );
  }
  const { skills, visualIdentity, ...req } = parsed.data;
  const guidelines = skills?.length ? (await getSkills(skills)).map((s) => s.body).join("\n\n") : null;
  const content = await writeScript({ ...req, guidelines, visualIdentity });
  return insertScript({ user_id: userId, ...req, content });
}

export const list = listScripts;

export async function update(userId: string, id: string, content: unknown) {
  const current = await getScript(userId, id);
  const parsed = creativeScriptFor(current.format).safeParse(content);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new DomainError(
      "invalid_script",
      `Roteiro inválido em "${issue.path.join(".")}": ${issue.message}`,
    );
  }
  return updateScriptContent(userId, id, parsed.data);
}

export const remove = deleteScript;
