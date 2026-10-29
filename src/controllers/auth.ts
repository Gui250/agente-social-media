import "server-only";
import { z } from "zod";
import {
  burnPasswordCheck,
  endSession,
  hashPassword,
  startSession,
  verifyPassword,
} from "@/lib/auth";
import { DomainError } from "@/lib/errors";
import {
  clearFailedLogins,
  deleteOtherSessions,
  findUserByEmail,
  getUser,
  insertUser,
  LOCK_MINUTES,
  recordFailedLogin,
  type SessionUser,
  setPasswordHash,
} from "@/models/user";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const email = z.string().trim().toLowerCase().pipe(z.email("E-mail inválido."));
// Upper bound keeps scrypt from hashing megabytes of input.
const password = z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(128, "A senha pode ter até 128 caracteres.");

export const Credentials = z.object({ email, password: z.string().min(1).max(128) });
export const SignUpInput = z.object({ email, password, timezone: z.string().max(64).optional() });
export const ChangePasswordInput = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password });

const wrongCredentials = () => new DomainError("invalid_credentials", "E-mail ou senha incorretos.", 401);

function validTimezone(tz: string | undefined) {
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export async function signUp(input: z.infer<typeof SignUpInput>) {
  const user = await insertUser(input.email, await hashPassword(input.password), validTimezone(input.timezone));
  if (!user) throw new DomainError("email_taken", "Este e-mail já tem conta. Entre com sua senha.", 409);
  await startSession(user.id);
}

export async function signIn(input: z.infer<typeof Credentials>) {
  const user = await findUserByEmail(input.email);
  if (!user) {
    await burnPasswordCheck(input.password);
    throw wrongCredentials();
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new DomainError(
      "locked",
      `Muitas tentativas erradas. Tente de novo em até ${LOCK_MINUTES} minutos.`,
      429,
    );
  }
  if (!(await verifyPassword(input.password, user.password_hash))) {
    await recordFailedLogin(user.id);
    throw wrongCredentials();
  }
  if (user.failed_logins > 0 || user.locked_until) await clearFailedLogins(user.id);
  await startSession(user.id);
}

export const signOut = endSession;

// Signs out every other device: whoever knew the old password loses access.
export async function changePassword(user: SessionUser, input: z.infer<typeof ChangePasswordInput>) {
  const row = await getUser(user.id);
  if (!row || !(await verifyPassword(input.currentPassword, row.password_hash))) {
    throw new DomainError("invalid_credentials", "Senha atual incorreta.", 401);
  }
  if (input.currentPassword === input.newPassword) {
    throw new DomainError("same_password", "A nova senha precisa ser diferente da atual.");
  }
  await setPasswordHash(user.id, await hashPassword(input.newPassword));
  await deleteOtherSessions(user.id, user.sessionId);
}
