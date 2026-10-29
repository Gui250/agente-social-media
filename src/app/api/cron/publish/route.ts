import { publishTick } from "@/controllers/cron";
import { videoTick } from "@/controllers/creatives";
import { cronRoute } from "@/lib/cron-auth";

// GET: Vercel Cron. POST: any other scheduler. Also finishes AI videos still being generated.
export const GET = cronRoute(async () => ({ ...(await publishTick()), videos: await videoTick() }));
export const POST = GET;
