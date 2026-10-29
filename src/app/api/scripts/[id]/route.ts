import { z } from "zod";
import * as scripts from "@/controllers/scripts";
import { route } from "@/lib/http";

type Params = { id: string };

export const PATCH = route<z.ZodObject<{ content: z.ZodUnknown }>, Params>(
  ({ supabase, body }, { id }) => scripts.update(supabase, id, body.content),
  { body: z.object({ content: z.unknown() }) },
);

export const DELETE = route<undefined, Params>(async ({ supabase }, { id }) => {
  await scripts.remove(supabase, id);
});
