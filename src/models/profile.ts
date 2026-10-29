import "server-only";
import { sql } from "@/lib/db";
import { notFound } from "@/lib/errors";

export type Profile = { id: string; timezone: string };

export async function getProfile(userId: string): Promise<Profile> {
  const [row] = await sql()<Profile[]>`select id, timezone from users where id = ${userId}`;
  if (!row) throw notFound("Perfil");
  return row;
}
