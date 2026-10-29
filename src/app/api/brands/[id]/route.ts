import * as brands from "@/controllers/brands";
import { route } from "@/lib/http";

export const GET = route<undefined, { id: string }>(({ user }, { id }) => brands.get(user.id, id));

export const PATCH = route<typeof brands.BrandInput, { id: string }>(
  ({ user, body }, { id }) => brands.update(user.id, id, body),
  { body: brands.BrandInput },
);

export const DELETE = route<undefined, { id: string }>(async ({ user }, { id }) => {
  await brands.remove(user.id, id);
});
