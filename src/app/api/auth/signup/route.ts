import { SignUpInput, signUp } from "@/controllers/auth";
import { publicRoute } from "@/lib/http";

export const POST = publicRoute(signUp, { body: SignUpInput });
