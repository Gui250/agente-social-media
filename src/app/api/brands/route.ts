import * as brands from "@/controllers/brands";
import { route } from "@/lib/http";

export const POST = route(({ user, body }) => brands.create(user.id, body), { body: brands.CreateBrand, status: 201 });
