import { z } from "zod";
import { approve } from "@/controllers/chat";
import { route } from "@/lib/http";

export const POST = route(
  ({ user, body }) => approve(user.id, body),
  {
    body: z.object({
      conversationId: z.uuid(),
      decisions: z.array(z.object({ id: z.string().min(1), approve: z.boolean() })).min(1),
    }),
  },
);
