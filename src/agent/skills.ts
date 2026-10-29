import "server-only";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { DomainError } from "@/lib/errors";
import { listUserSkills } from "@/models/skill";

// Skills are reusable creative know-how in skills/<name>/SKILL.md (front matter with `name` and
// `description`, then the guidelines), plus the ones each user imported (user_skills). The agent sees only names and descriptions in its
// instructions and loads a skill's body when it needs it (load_skill, or `skills` on scripts).
export type Skill = { name: string; description: string; body: string };

const DIR = join(process.cwd(), "skills");

export function parseSkill(source: string, fallbackName: string): Skill {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta = Object.fromEntries(
    (match?.[1] ?? "").split(/\r?\n/).flatMap((line) => {
      const i = line.indexOf(":");
      return i > 0 ? [[line.slice(0, i).trim(), line.slice(i + 1).trim()]] : [];
    }),
  );
  return {
    name: meta.name || fallbackName,
    description: meta.description ?? "",
    body: (match?.[2] ?? source).trim(),
  };
}

let cache: Promise<Skill[]> | undefined;

async function load(): Promise<Skill[]> {
  const dirs = await readdir(DIR, { withFileTypes: true }).catch(() => []);
  const skills = await Promise.all(
    dirs
      .filter((d) => d.isDirectory())
      .map(async (d) => parseSkill(await readFile(join(DIR, d.name, "SKILL.md"), "utf8"), d.name)),
  );
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

// Read once per server instance in production; re-read in dev so edits show up immediately.
export function builtinSkills(): Promise<Skill[]> {
  if (process.env.NODE_ENV !== "production") return load();
  return (cache ??= load());
}

// Built-in skills first, then the user's imports (an import can't take a built-in name).
export async function listSkills(userId?: string): Promise<Skill[]> {
  const [builtin, imported] = await Promise.all([builtinSkills(), userId ? listUserSkills(userId) : []]);
  return [...builtin, ...imported.map(({ name, description, body }) => ({ name, description, body }))];
}

export async function getSkills(names: string[], userId?: string): Promise<Skill[]> {
  const all = await listSkills(userId);
  return names.map((name) => {
    const skill = all.find((s) => s.name === name);
    if (!skill) {
      const available = all.map((s) => s.name).join(", ") || "nenhuma";
      throw new DomainError("skill_not_found", `Skill "${name}" não existe. Disponíveis: ${available}.`);
    }
    return skill;
  });
}
