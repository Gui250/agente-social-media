import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { env } from "@/lib/env";
import { errorResponse } from "@/lib/http";

const digest = (s: string) => createHash("sha256").update(s).digest();

// Cron routes are called by pg_cron with `Authorization: Bearer <CRON_SECRET>`.
// Hashing first gives equal-length buffers, so the comparison is constant-time.
export function cronRoute(handler: () => Promise<unknown>) {
  return async (req: Request) => {
    await connection();
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token || !timingSafeEqual(digest(token), digest(env().CRON_SECRET))) {
      return Response.json({ error: { code: "unauthorized", message: "Não autorizado." } }, { status: 401 });
    }
    try {
      return Response.json(await handler());
    } catch (e) {
      return errorResponse(e);
    }
  };
}
