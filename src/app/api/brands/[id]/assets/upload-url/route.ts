import { z } from "zod";
import * as brands from "@/controllers/brands";
import { route } from "@/lib/http";

const Body = z.object({
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"], {
    error: "Formato não suportado: envie uma imagem PNG, JPEG ou WebP.",
  }),
});

export const POST = route<typeof Body, { id: string }>(
  ({ user, body }, { id }) => brands.requestUpload(user.id, id, body.mimeType),
  { body: Body },
);
