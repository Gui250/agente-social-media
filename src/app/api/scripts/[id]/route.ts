import { z } from "zod";
import * as scripts from "@/controllers/scripts";
import { route } from "@/lib/http";

type Params = { id: string };

export const PATCH = route<z.ZodObject<{ content: z.ZodUnknown }>, Params>(
  ({ user, body }, { id }) => scripts.update(user.id, id, body.content),
  { body: z.object({ content: z.unknown() }) },
);

export const DELETE = route<undefined, Params>(async ({ user }, { id }) => {
  await scripts.remove(user.id, id);
});
