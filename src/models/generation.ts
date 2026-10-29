import "server-only";
import { sql } from "@/lib/db";

export type GenerationKind = "image" | "video";
export type GenerationStatus = "running" | "done" | "failed";
export type GenerationRow = {
  id: string;
  user_id: string;
  script_id: string | null;
  kind: GenerationKind;
  prompt: string;
  provider_job_id: string | null;
  status: GenerationStatus;
  media_id: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

type NewGeneration = Pick<GenerationRow, "user_id" | "script_id" | "kind" | "prompt"> &
  Partial<Pick<GenerationRow, "provider_job_id" | "status" | "media_id">>;

export async function insertGeneration(row: NewGeneration): Promise<GenerationRow> {
  const [generation] = await sql()<GenerationRow[]>`
    insert into generations (user_id, script_id, kind, prompt, provider_job_id, status, media_id)
    values (${row.user_id}, ${row.script_id}, ${row.kind}, ${row.prompt}, ${row.provider_job_id ?? null},
            ${row.status ?? "running"}, ${row.media_id ?? null})
    returning *`;
  return generation;
}

export async function listGenerations(
  userId: string,
  { scriptId, limit = 10 }: { scriptId?: string; limit?: number } = {},
): Promise<GenerationRow[]> {
  return sql()<GenerationRow[]>`
    select * from generations
    where user_id = ${userId} ${scriptId ? sql()`and script_id = ${scriptId}` : sql()``}
    order by created_at desc
    limit ${limit}`;
}

// Cron only (no user session): videos still being made by the provider, oldest first.
export async function runningVideos(limit: number): Promise<GenerationRow[]> {
  return sql()<GenerationRow[]>`
    select * from generations
    where status = 'running' and kind = 'video'
    order by created_at
    limit ${limit}`;
}

// Only moves a job out of 'running'; returns null if another tick already finished it.
export async function finishGeneration(
  id: string,
  patch: { status: "done"; media_id: string } | { status: "failed"; failure_reason: string },
): Promise<GenerationRow | null> {
  const [row] = await sql()<GenerationRow[]>`
    update generations set ${sql()(patch)}
    where id = ${id} and status = 'running'
    returning *`;
  return row ?? null;
}
