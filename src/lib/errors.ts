import type { z } from "zod";

export type ErrorStatus = 400 | 401 | 404 | 409 | 429 | 502;

// `message` is shown to the user, so it is always Portuguese.
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: ErrorStatus = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

// Pass "a" for feminine nouns: notFound("Mídia", "a") → "Mídia não encontrada."
export const notFound = (what = "Item", ending: "o" | "a" = "o") =>
  new DomainError("not_found", `${what} não encontrad${ending}.`, 404);

// Parses `value` or throws the 400 the API sends for bad input, naming the first bad field.
export function validate<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  throw new DomainError(
    "invalid_input",
    `Dados inválidos${issue?.path.length ? ` em "${issue.path.join(".")}"` : ""}: ${issue?.message}`,
  );
}
