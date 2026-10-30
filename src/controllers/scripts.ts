import { z } from "zod";
import { writeScript } from "@/agent/script-writer";
import { getSkills } from "@/agent/skills";
import { activeKit, kitBlock } from "@/controllers/brands";
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

// Context the agent writes itself (summaries of references, identity, objective) is cut to size
// instead of rejected: a long summary used to fail the whole script.
const clipped = (max: number) =>
  z
    .string()
    .trim()
    .nullish()
    .transform((v) => v?.slice(0, max) || null);
const optionalText = clipped(300);

const ALWAYS_SKILL = "criativo-disruptivo";

export const GenerateInput = z.object({
  segment: z.string().trim().min(2).max(120),
  format: ScriptFormat,
  objective: optionalText,
  audience: optionalText,
  tone: optionalText,
  skills: z
    .array(z.string().max(60))
    .nullish()
    .transform((v) => v?.slice(0, 3)),
  visualIdentity: clipped(1500),
  references: clipped(4000),
});
export type GenerateInput = z.input<typeof GenerateInput>;

// brandId: the conversation's active brand; its kit goes to the writer as data.
export async function generate(userId: string, input: GenerateInput, brandId: string | null = null) {
  const parsed = GenerateInput.safeParse(input);
  if (!parsed.success) {
    // Say which field failed, so the agent can fix the call instead of calling it instability.
    const field = parsed.error.issues[0]?.path[0];
    throw new DomainError(
      "invalid_input",
      field === "segment"
        ? "Informe o segmento do negócio (2 a 120 caracteres)."
        : field === "format"
          ? "O formato precisa ser estático (post ou carrossel)."
          : `Campo inválido no pedido do roteiro: ${String(field)}.`,
    );
  }
  const { skills, visualIdentity, references, ...req } = parsed.data;
  // ALWAYS_SKILL goes into every script: without it the writer falls back to safe, institutional copy.
  const names = [...new Set([ALWAYS_SKILL, ...(skills ?? [])])];
  const guidelines = (await getSkills(names, userId)).map((s) => s.body).join("\n\n");
  const recent = (await listScripts(userId, { limit: 5 })).map(
    ({ content: c }) => `- ${c.title}: "${c.hook}"${c.artDirection ? ` (${c.artDirection})` : ""}`,
  );
  const kit = await activeKit(userId, brandId);
  const content = await writeScript({
    ...req,
    guidelines,
    visualIdentity,
    references,
    recent,
    brand: kit && kitBlock(kit),
    forbidden: kit?.proibidos,
  });
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
