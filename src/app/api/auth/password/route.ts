import { ChangePasswordInput, changePassword } from "@/controllers/auth";
import { route } from "@/lib/http";

export const POST = route(({ user, body }) => changePassword(user, body), { body: ChangePasswordInput });
