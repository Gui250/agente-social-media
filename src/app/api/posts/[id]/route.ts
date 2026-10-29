import * as posts from "@/controllers/posts";
import { route } from "@/lib/http";

export const PATCH = route<typeof posts.PostPatch, { id: string }>(
  ({ supabase, user, body }, { id }) => posts.update(supabase, user.id, id, body),
  { body: posts.PostPatch },
);
