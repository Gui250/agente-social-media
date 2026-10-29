import { startConnect } from "@/controllers/accounts";
import { oauthStart } from "@/lib/oauth-routes";

export const GET = oauthStart(() => startConnect("instagram"));
