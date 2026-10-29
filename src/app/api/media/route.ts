import { z } from "zod";
import { register } from "@/controllers/media";
import { route } from "@/lib/http";

export const POST = route(
  async ({ supabase, user, body }) => {
    const m = await register(supabase, user.id, body.storagePath);
    return { id: m.id, kind: m.kind, mimeType: m.mime_type, sizeBytes: m.size_bytes };
  },
  { body: z.object({ storagePath: z.string().min(3).max(300) }), status: 201 },
);
