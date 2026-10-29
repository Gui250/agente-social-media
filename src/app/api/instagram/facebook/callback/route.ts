import { handleFacebookCallback } from "@/controllers/accounts";
import { oauthCallback } from "@/lib/oauth-routes";

export const GET = oauthCallback(handleFacebookCallback);
