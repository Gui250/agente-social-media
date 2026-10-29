import * as skills from "@/controllers/skills";
import { route } from "@/lib/http";

export const POST = route(
  ({ user, body }) => skills.importSkill(user.id, body.source),
  { body: skills.ImportInput, status: 201 },
);
