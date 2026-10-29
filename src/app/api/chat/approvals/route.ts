import { z } from "zod";
import { approve } from "@/controllers/chat";
import { ndjson, route } from "@/lib/http";

export const POST = route(
  async ({ user, body }) => ndjson((emit) => approve(user.id, body, emit)),
  {
    body: z.object({
      conversationId: z.uuid(),
      decisions: z.array(z.object({ id: z.string().min(1), approve: z.boolean() })).min(1),
    }),
  },
);
