import { publishTick } from "@/controllers/cron";
import { cronRoute } from "@/lib/cron-auth";

export const POST = cronRoute(publishTick);
