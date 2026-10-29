import * as posts from "@/controllers/posts";
import { DomainError } from "@/lib/errors";
import { route } from "@/lib/http";
import { getProfile } from "@/models/profile";

export const GET = route(async ({ supabase, user, req }) => {
  const parsed = posts.ListFilters.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) throw new DomainError("invalid_input", "Filtros inválidos.");
  const { timezone } = await getProfile(supabase, user.id);
  return posts.list(supabase, timezone, parsed.data);
});

export const POST = route(
  ({ supabase, user, body }) => posts.create(supabase, user.id, body),
  { body: posts.PostInput, status: 201 },
);
