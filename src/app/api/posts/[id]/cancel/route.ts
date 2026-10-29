import * as posts from "@/controllers/posts";
import { route } from "@/lib/http";

export const POST = route<undefined, { id: string }>(({ user }, { id }) => posts.cancel(user.id, id));
