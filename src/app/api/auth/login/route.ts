import { Credentials, signIn } from "@/controllers/auth";
import { publicRoute } from "@/lib/http";

export const POST = publicRoute(signIn, { body: Credentials });
