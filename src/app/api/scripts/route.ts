import * as scripts from "@/controllers/scripts";
import { route } from "@/lib/http";

export const GET = route(({ user, req }) => {
  const params = new URL(req.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 50);
  return scripts.list(user.id, { limit, cursor: params.get("cursor") ?? undefined });
});

export const POST = route(
  ({ user, body }) => scripts.generate(user.id, body),
  { body: scripts.GenerateInput, status: 201 },
);
