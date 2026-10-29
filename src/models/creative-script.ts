import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
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

export async function insertScript(supabase: SupabaseClient, row: NewScript): Promise<ScriptRow> {
  const { data, error } = await supabase.from("creative_scripts").insert(row).select().single();
  if (error) throw error;
  return data;
}

// Cursor = created_at of the last item of the previous page.
export async function listScripts(
  supabase: SupabaseClient,
  { limit = 20, cursor }: { limit?: number; cursor?: string } = {},
): Promise<ScriptRow[]> {
  let q = supabase
    .from("creative_scripts")
    .select()
    .order("created_at", { ascending: false })
    .limit(limit);
  if (cursor) q = q.lt("created_at", cursor);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getScript(supabase: SupabaseClient, id: string): Promise<ScriptRow> {
  const { data, error } = await supabase.from("creative_scripts").select().eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Roteiro");
  return data;
}

export async function updateScriptContent(
  supabase: SupabaseClient,
  id: string,
  content: CreativeScript,
): Promise<ScriptRow> {
  const { data, error } = await supabase
    .from("creative_scripts")
    .update({ content })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Roteiro");
  return data;
}

export async function deleteScript(supabase: SupabaseClient, id: string) {
  const { error, count } = await supabase
    .from("creative_scripts")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw error;
  if (!count) throw notFound("Roteiro");
}
