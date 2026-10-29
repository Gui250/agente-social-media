import * as posts from "@/controllers/posts";
import { DomainError } from "@/lib/errors";
import { route } from "@/lib/http";

export const GET = route(async ({ user, req }) => {
  const parsed = posts.ListFilters.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) throw new DomainError("invalid_input", "Filtros inválidos.");
  return posts.list(user.id, user.timezone, parsed.data);
});

export const POST = route(
  ({ user, body }) => posts.create(user.id, body),
  { body: posts.PostInput, status: 201 },
);
