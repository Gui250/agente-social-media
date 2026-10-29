import { createBrowserClient } from "@supabase/ssr";

// Browser client: used only for auth and direct Storage uploads.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
