import { z } from "zod";
import { sendMessage } from "@/controllers/chat";
import { ndjson, route } from "@/lib/http";

export const POST = route(
  async ({ user, body }) => ndjson((emit) => sendMessage(user.id, body, emit)),
  {
    body: z.object({
      conversationId: z.uuid().optional(),
      message: z.string().trim().min(1).max(4000),
      mediaIds: z.array(z.uuid()).max(20).optional(),
      brandIds: z.array(z.uuid()).max(3).optional(),
    }),
  },
);
