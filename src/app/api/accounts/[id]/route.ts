import { disconnect } from "@/controllers/accounts";
import { route } from "@/lib/http";

export const DELETE = route<undefined, { id: string }>(({ user }, { id }) => disconnect(user.id, id));
