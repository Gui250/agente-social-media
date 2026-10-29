import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { writeScript } from "@/agent/script-writer";
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
});
export type GenerateInput = z.input<typeof GenerateInput>;

export async function generate(supabase: SupabaseClient, userId: string, input: GenerateInput) {
  const parsed = GenerateInput.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      "invalid_input",
      "Informe o segmento (2 a 120 caracteres) e o formato: vídeo ou estático.",
    );
  }
  const req = parsed.data;
  const content = await writeScript(req);
  return insertScript(supabase, { user_id: userId, ...req, content });
}

export const list = (supabase: SupabaseClient, opts?: { limit?: number; cursor?: string }) =>
  listScripts(supabase, opts);

export async function update(supabase: SupabaseClient, id: string, content: unknown) {
  const current = await getScript(supabase, id);
  const parsed = creativeScriptFor(current.format).safeParse(content);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new DomainError(
      "invalid_script",
      `Roteiro inválido em "${issue.path.join(".")}": ${issue.message}`,
    );
  }
  return updateScriptContent(supabase, id, parsed.data);
}

export const remove = deleteScript;
