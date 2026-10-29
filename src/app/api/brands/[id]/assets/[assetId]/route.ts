import * as brands from "@/controllers/brands";
import { route } from "@/lib/http";

export const DELETE = route<undefined, { id: string; assetId: string }>(async ({ user }, { id, assetId }) => {
  await brands.removeAsset(user.id, id, assetId);
});
