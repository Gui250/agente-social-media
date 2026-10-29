import { requestUpload, UploadRequest } from "@/controllers/media";
import { route } from "@/lib/http";

export const POST = route(({ user, body }) => requestUpload(user.id, body.mimeType), { body: UploadRequest });
