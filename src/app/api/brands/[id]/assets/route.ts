import { z } from "zod";
import * as brands from "@/controllers/brands";
import { route } from "@/lib/http";

const Body = z.object({
  storageKey: z.string().max(300),
  assetType: z.enum(["logo", "logo_alt", "other"], { error: "Tipo de arquivo inválido: use logo, logo_alt ou other." }),
});

export const POST = route<typeof Body, { id: string }>(
  ({ user, body }, { id }) => brands.registerAsset(user.id, id, body.storageKey, body.assetType),
  { body: Body, status: 201 },
);
