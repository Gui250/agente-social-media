import { disconnect } from "@/controllers/accounts";
import { route } from "@/lib/http";

export const DELETE = route<undefined, { id: string }>(({ supabase }, { id }) =>
  disconnect(supabase, id),
);
