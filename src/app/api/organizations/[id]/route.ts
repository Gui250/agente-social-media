import * as organizations from "@/controllers/organizations";
import { route } from "@/lib/http";

export const PATCH = route<typeof organizations.OrganizationInput, { id: string }>(
  ({ user, body }, { id }) => organizations.rename(user.id, id, body.name),
  { body: organizations.OrganizationInput },
);

export const DELETE = route<undefined, { id: string }>(async ({ user }, { id }) => {
  await organizations.remove(user.id, id);
});
