import "server-only";
import { sql } from "@/lib/db";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  timezone: string;
  failed_logins: number;
  locked_until: string | null;
};
export type SessionUser = { id: string; email: string; timezone: string; sessionId: string };

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const [row] = await sql()<UserRow[]>`select * from users where email = ${email}`;
  return row ?? null;
}

export async function getUser(id: string): Promise<UserRow | null> {
  const [row] = await sql()<UserRow[]>`select * from users where id = ${id}`;
  return row ?? null;
}

// null when the e-mail is already taken.
export async function insertUser(email: string, passwordHash: string, timezone: string) {
  const [row] = await sql()<UserRow[]>`
    insert into users (email, password_hash, timezone) values (${email}, ${passwordHash}, ${timezone})
    on conflict (email) do nothing
    returning *`;
  return row ?? null;
}

// The 5th failure locks the account for LOCK_MINUTES and starts the count again.
export async function recordFailedLogin(id: string) {
  await sql()`
    update users set
      failed_logins = case when failed_logins + 1 >= ${MAX_FAILED_LOGINS} then 0 else failed_logins + 1 end,
      locked_until = case when failed_logins + 1 >= ${MAX_FAILED_LOGINS}
        then now() + make_interval(mins => ${LOCK_MINUTES}) else locked_until end
    where id = ${id}`;
}

export async function clearFailedLogins(id: string) {
  await sql()`update users set failed_logins = 0, locked_until = null where id = ${id}`;
}

export async function setPasswordHash(id: string, passwordHash: string) {
  await sql()`update users set password_hash = ${passwordHash} where id = ${id}`;
}

// Sessions: `id` is the sha256 of the cookie token.
export async function insertSession(id: string, userId: string, expiresAt: Date) {
  await sql()`delete from sessions where user_id = ${userId} and expires_at < now()`;
  await sql()`insert into sessions (id, user_id, expires_at) values (${id}, ${userId}, ${expiresAt})`;
}

export async function findSessionUser(id: string): Promise<SessionUser | null> {
  const [row] = await sql()<SessionUser[]>`
    select u.id, u.email, u.timezone, s.id as "sessionId"
    from sessions s join users u on u.id = s.user_id
    where s.id = ${id} and s.expires_at > now()`;
  return row ?? null;
}

export async function deleteSession(id: string) {
  await sql()`delete from sessions where id = ${id}`;
}

export async function deleteOtherSessions(userId: string, keepId: string) {
  await sql()`delete from sessions where user_id = ${userId} and id <> ${keepId}`;
}
