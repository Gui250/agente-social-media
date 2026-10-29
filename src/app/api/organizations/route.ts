import * as organizations from "@/controllers/organizations";
import { route } from "@/lib/http";

export const GET = route(({ user }) => organizations.list(user.id));

export const POST = route(
  ({ user, body }) => organizations.create(user.id, body.name),
  { body: organizations.OrganizationInput, status: 201 },
);
