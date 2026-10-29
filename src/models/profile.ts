import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "@/lib/errors";

export type Profile = { id: string; timezone: string };

export async function getProfile(supabase: SupabaseClient, userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, timezone")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Perfil");
  return data;
}
