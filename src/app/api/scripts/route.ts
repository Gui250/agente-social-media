import * as scripts from "@/controllers/scripts";
import { route } from "@/lib/http";

export const GET = route(({ supabase, req }) => {
  const params = new URL(req.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 50);
  return scripts.list(supabase, { limit, cursor: params.get("cursor") ?? undefined });
});

export const POST = route(
  ({ supabase, user, body }) => scripts.generate(supabase, user.id, body),
  { body: scripts.GenerateInput, status: 201 },
);
