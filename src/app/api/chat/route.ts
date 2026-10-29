import { z } from "zod";
import { sendMessage } from "@/controllers/chat";
import { route } from "@/lib/http";

export const POST = route(
  ({ user, body }) => sendMessage(user.id, body),
  {
    body: z.object({
      conversationId: z.uuid().optional(),
      message: z.string().trim().min(1).max(4000),
      mediaIds: z.array(z.uuid()).max(20).optional(),
    }),
  },
);
