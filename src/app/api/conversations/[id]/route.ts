import * as chat from "@/controllers/chat";
import { route } from "@/lib/http";

export const DELETE = route<undefined, { id: string }>(async ({ user }, { id }) => {
  await chat.remove(user.id, id);
});
