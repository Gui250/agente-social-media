import "server-only";
import { sql } from "@/lib/db";
import { notFound } from "@/lib/errors";

export type UserSkillRow = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export async function listUserSkills(userId: string): Promise<UserSkillRow[]> {
  return sql()<UserSkillRow[]>`select * from user_skills where user_id = ${userId} order by name`;
}

// Same name again = new version of that skill.
export async function upsertUserSkill(
  row: Pick<UserSkillRow, "user_id" | "name" | "description" | "body">,
): Promise<UserSkillRow> {
  const [skill] = await sql()<UserSkillRow[]>`
    insert into user_skills (user_id, name, description, body)
    values (${row.user_id}, ${row.name}, ${row.description}, ${row.body})
    on conflict (user_id, name) do update set description = excluded.description, body = excluded.body
    returning *`;
  return skill;
}

export async function deleteUserSkill(userId: string, id: string) {
  const { count } = await sql()`delete from user_skills where id = ${id} and user_id = ${userId}`;
  if (!count) throw notFound("Skill", "a");
}
