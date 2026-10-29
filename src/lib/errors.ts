export type ErrorStatus = 400 | 401 | 404 | 409 | 502;

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
