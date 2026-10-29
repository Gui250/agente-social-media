import * as skills from "@/controllers/skills";
import { route } from "@/lib/http";

export const DELETE = route<undefined, { id: string }>(async ({ user }, { id }) => {
  await skills.remove(user.id, id);
});
