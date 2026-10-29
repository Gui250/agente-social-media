import "server-only";
import { z } from "zod";
import { builtinSkills, parseSkill } from "@/agent/skills";
import { DomainError } from "@/lib/errors";
import { deleteUserSkill, listUserSkills, upsertUserSkill } from "@/models/skill";

// ponytail: every description goes into each agent prompt, so a fixed cap per user; raise it (or
// stop listing descriptions) if someone needs more.
export const MAX_SKILLS = 20;
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const ImportInput = z.object({ source: z.string().max(20_000) });

const invalid = (message: string) => new DomainError("invalid_skill", message);

// `source` is the SKILL.md text, same format as skills/<name>/SKILL.md.
export async function importSkill(userId: string, source: string) {
  const { name, description, body } = parseSkill(source, "");
  if (!name || name.length < 2 || name.length > 60 || !NAME.test(name)) {
    throw invalid(
      'O SKILL.md precisa começar com o cabeçalho "---", ter "name:" com 2 a 60 letras minúsculas, ' +
        'números ou hífens (ex.: name: promocao-relampago) e fechar com "---".',
    );
  }
  if (description.length < 10 || description.length > 300) {
    throw invalid('Informe "description:" no cabeçalho (10 a 300 caracteres): quando a skill deve ser usada.');
  }
  if (!body) throw invalid("O SKILL.md não tem diretrizes depois do cabeçalho.");

  const [builtin, mine] = await Promise.all([builtinSkills(), listUserSkills(userId)]);
  if (builtin.some((s) => s.name === name)) {
    throw new DomainError("skill_conflict", `Já existe uma skill do app chamada "${name}". Use outro name.`, 409);
  }
  if (!mine.some((s) => s.name === name) && mine.length >= MAX_SKILLS) {
    throw invalid(`Limite de ${MAX_SKILLS} skills importadas. Exclua uma para importar outra.`);
  }
  return upsertUserSkill({ user_id: userId, name, description, body });
}

export const list = listUserSkills;
export const remove = deleteUserSkill;
