import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const users = new Map<string, Record<string, unknown>>();
const sessions: string[] = [];
const calls: string[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: () => {}, get: () => undefined, delete: () => {} }),
}));
vi.mock("@/models/user", () => ({
  MAX_FAILED_LOGINS: 5,
  LOCK_MINUTES: 15,
  findUserByEmail: async (email: string) => [...users.values()].find((u) => u.email === email) ?? null,
  getUser: async (id: string) => users.get(id) ?? null,
  insertUser: async (email: string, password_hash: string, timezone: string) => {
    if ([...users.values()].some((u) => u.email === email)) return null;
    const row = { id: `u${users.size + 1}`, email, password_hash, timezone, failed_logins: 0, locked_until: null };
    users.set(row.id, row);
    return row;
  },
  recordFailedLogin: async (id: string) => {
    const u = users.get(id)!;
    const n = (u.failed_logins as number) + 1;
    if (n >= 5) Object.assign(u, { failed_logins: 0, locked_until: new Date(Date.now() + 60_000).toISOString() });
    else u.failed_logins = n;
  },
  clearFailedLogins: async (id: string) => Object.assign(users.get(id)!, { failed_logins: 0, locked_until: null }),
  setPasswordHash: async (id: string, hash: string) => Object.assign(users.get(id)!, { password_hash: hash }),
  insertSession: async (id: string) => sessions.push(id),
  deleteOtherSessions: async () => calls.push("deleteOtherSessions"),
}));

const { hashPassword, verifyPassword } = await import("@/lib/auth");
const { signUp, signIn, changePassword, SignUpInput } = await import("@/controllers/auth");

const code = (p: Promise<unknown>) => p.then(() => "ok", (e: DomainError) => e.code);

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("senha-forte-1");
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await verifyPassword("senha-forte-1", hash)).toBe(true);
    expect(await verifyPassword("senha-forte-2", hash)).toBe(false);
    expect(await hashPassword("senha-forte-1")).not.toBe(hash); // random salt
  });
});

describe("auth controller", () => {
  beforeEach(() => {
    users.clear();
    sessions.length = 0;
    calls.length = 0;
  });

  it("normalizes the e-mail and rejects short passwords", () => {
    expect(SignUpInput.parse({ email: " Ana@Ex.com ", password: "12345678" }).email).toBe("ana@ex.com");
    expect(SignUpInput.safeParse({ email: "ana@ex.com", password: "1234567" }).success).toBe(false);
  });

  it("signs up once per e-mail and starts a session", async () => {
    expect(await code(signUp({ email: "a@x.com", password: "12345678" }))).toBe("ok");
    expect(await code(signUp({ email: "a@x.com", password: "12345678" }))).toBe("email_taken");
    expect(sessions).toHaveLength(1);
    expect(users.get("u1")?.timezone).toBe("America/Sao_Paulo");
  });

  it("gives the same error for an unknown e-mail and a wrong password", async () => {
    await signUp({ email: "a@x.com", password: "12345678" });
    expect(await code(signIn({ email: "b@x.com", password: "12345678" }))).toBe("invalid_credentials");
    expect(await code(signIn({ email: "a@x.com", password: "errada00" }))).toBe("invalid_credentials");
    expect(await code(signIn({ email: "a@x.com", password: "12345678" }))).toBe("ok");
  });

  it("locks the account after 5 wrong passwords, even for the right one", async () => {
    await signUp({ email: "a@x.com", password: "12345678" });
    for (let i = 0; i < 5; i++) await signIn({ email: "a@x.com", password: "errada00" }).catch(() => {});
    expect(await code(signIn({ email: "a@x.com", password: "12345678" }))).toBe("locked");
  });

  it("changes the password only with the current one and signs out other sessions", async () => {
    await signUp({ email: "a@x.com", password: "12345678" });
    const user = { id: "u1", email: "a@x.com", timezone: "America/Sao_Paulo", sessionId: "s1" };
    expect(await code(changePassword(user, { currentPassword: "errada00", newPassword: "novasenha1" }))).toBe(
      "invalid_credentials",
    );
    expect(await code(changePassword(user, { currentPassword: "12345678", newPassword: "12345678" }))).toBe(
      "same_password",
    );
    expect(await code(changePassword(user, { currentPassword: "12345678", newPassword: "novasenha1" }))).toBe("ok");
    expect(calls).toEqual(["deleteOtherSessions"]);
    expect(await code(signIn({ email: "a@x.com", password: "12345678" }))).toBe("invalid_credentials");
    expect(await code(signIn({ email: "a@x.com", password: "novasenha1" }))).toBe("ok");
  });
});
