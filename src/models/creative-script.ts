import type { JSONValue } from "postgres";
import { z } from "zod";
import { sql } from "@/lib/db";
import { notFound } from "@/lib/errors";

export const ScriptFormat = z.enum(["video", "static"]);
export type ScriptFormat = z.infer<typeof ScriptFormat>;

export const CreativeScriptBase = z.object({
  title: z.string().min(1).max(120),
  hook: z.string().min(1).max(300),
  blocks: z
    .array(
      z.object({
        label: z.string().min(1),
        durationSeconds: z.number().positive().nullable(),
        visual: z.string(),
        text: z.string(),
      }),
    )
    .min(1)
    .max(20),
  caption: z.string().max(2200),
  cta: z.string().min(1).max(200),
  hashtags: z
    .array(z.string().regex(/^#/, "Hashtag deve começar com #"))
    .max(30),
});
export type CreativeScript = z.infer<typeof CreativeScriptBase>;

export function creativeScriptFor(format: ScriptFormat) {
  return CreativeScriptBase.superRefine((s, ctx) => {
    s.blocks.forEach((b, i) => {
      const bad = format === "video" ? b.durationSeconds === null : b.durationSeconds !== null;
      if (bad) {
        ctx.addIssue({
          code: "custom",
          path: ["blocks", i, "durationSeconds"],
          message:
            format === "video"
              ? "Cenas de vídeo precisam de duração"
              : "Slides não têm duração",
        });
      }
    });
  });
}

export type ScriptRow = {
  id: string;
  user_id: string;
  segment: string;
  objective: string | null;
  audience: string | null;
  tone: string | null;
  format: ScriptFormat;
  content: CreativeScript;
  created_at: string;
  updated_at: string;
};

type NewScript = Omit<ScriptRow, "id" | "created_at" | "updated_at">;

const json = (content: CreativeScript) => sql().json(content as unknown as JSONValue);

export async function insertScript(row: NewScript): Promise<ScriptRow> {
  const [script] = await sql()<ScriptRow[]>`
    insert into creative_scripts (user_id, segment, objective, audience, tone, format, content)
    values (${row.user_id}, ${row.segment}, ${row.objective}, ${row.audience}, ${row.tone}, ${row.format},
            ${json(row.content)})
    returning *`;
  return script;
}

// Cursor = created_at of the last item of the previous page.
export async function listScripts(
  userId: string,
  { limit = 20, cursor }: { limit?: number; cursor?: string } = {},
): Promise<ScriptRow[]> {
  return sql()<ScriptRow[]>`
    select * from creative_scripts
    where user_id = ${userId} ${cursor ? sql()`and created_at < ${cursor}` : sql()``}
    order by created_at desc
    limit ${limit}`;
}

export async function getScript(userId: string, id: string): Promise<ScriptRow> {
  const [row] = await sql()<ScriptRow[]>`
    select * from creative_scripts where id = ${id} and user_id = ${userId}`;
  if (!row) throw notFound("Roteiro");
  return row;
}

export async function updateScriptContent(userId: string, id: string, content: CreativeScript): Promise<ScriptRow> {
  const [row] = await sql()<ScriptRow[]>`
    update creative_scripts set content = ${json(content)}
    where id = ${id} and user_id = ${userId}
    returning *`;
  if (!row) throw notFound("Roteiro");
  return row;
}

export async function deleteScript(userId: string, id: string) {
  const { count } = await sql()`delete from creative_scripts where id = ${id} and user_id = ${userId}`;
  if (!count) throw notFound("Roteiro");
}
