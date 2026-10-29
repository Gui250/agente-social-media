import * as posts from "@/controllers/posts";
import { route } from "@/lib/http";

export const PATCH = route<typeof posts.PostPatch, { id: string }>(
  ({ user, body }, { id }) => posts.update(user.id, id, body),
  { body: posts.PostPatch },
);
