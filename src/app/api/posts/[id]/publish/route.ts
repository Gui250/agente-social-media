import * as posts from "@/controllers/posts";
import { route } from "@/lib/http";

export const POST = route<undefined, { id: string }>(({ supabase, user }, { id }) =>
  posts.publishNow(supabase, user.id, { postId: id }),
);
