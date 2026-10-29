import type { AgentInputItem } from "@openai/agents";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "@/lib/errors";

export type ConversationRow = {
  id: string;
  user_id: string;
  history: AgentInputItem[];
  pending_state: string | null;
  pending_approval_ids: string[];
};

// RLS hides other users' rows, so a foreign id reads as "not found" (404).
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  userId: string,
  id?: string,
): Promise<ConversationRow> {
  if (id) {
    const { data, error } = await supabase
      .from("conversations")
      .select()
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound("Conversa", "a");
    return data;
  }
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function update(supabase: SupabaseClient, id: string, patch: Partial<ConversationRow>) {
  const { error } = await supabase.from("conversations").update(patch).eq("id", id);
  if (error) throw error;
}

export const saveHistory = (supabase: SupabaseClient, id: string, history: AgentInputItem[]) =>
  update(supabase, id, { history });

export const setPending = (
  supabase: SupabaseClient,
  id: string,
  state: string,
  approvalIds: string[],
) => update(supabase, id, { pending_state: state, pending_approval_ids: approvalIds });

export const clearPending = (supabase: SupabaseClient, id: string) =>
  update(supabase, id, { pending_state: null, pending_approval_ids: [] });
