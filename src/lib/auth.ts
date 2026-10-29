import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import {
  deleteSession,
  findSessionUser,
  insertSession,
  type SessionUser,
} from "@/models/user";

export const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;

// scrypt (node:crypto) with N=2^15, r=8, p=1. Stored as scrypt$N$r$p$salt$hash (base64url),
// so the cost can be raised later without breaking existing hashes.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;

function derive(password: string, salt: Buffer, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEYLEN, { N: n, r, p, maxmem: 256 * n * r }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await derive(password, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Used when the e-mail doesn't exist, so a login takes the same time either way.
const DUMMY_HASH = hashPassword(randomBytes(16).toString("hex"));
export const burnPasswordCheck = async (password: string) => verifyPassword(password, await DUMMY_HASH);

const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

// The cookie holds a random token; the database only stores its hash.
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await insertSession(tokenId(token), userId, expires);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(tokenId(token));
  store.delete(SESSION_COOKIE);
}

// Once per request. Server Components call it inside a <Suspense> boundary (Cache Components).
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? findSessionUser(tokenId(token)) : null;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
