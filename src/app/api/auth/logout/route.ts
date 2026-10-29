import { connection } from "next/server";
import { signOut } from "@/controllers/auth";

// No session required: signing out twice is harmless.
export async function POST() {
  await connection();
  await signOut();
  return new Response(null, { status: 204 });
}
