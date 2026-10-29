import { publishTick } from "@/controllers/cron";
import { cronRoute } from "@/lib/cron-auth";

// GET: Vercel Cron. POST: any other scheduler.
export const GET = cronRoute(publishTick);
export const POST = GET;
