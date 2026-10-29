import "server-only";
import type { AgentInputItem } from "@openai/agents";
import type { JSONValue } from "postgres";
import { sql } from "@/lib/db";
import { notFound } from "@/lib/errors";

export type ConversationRow = {
  id: string;
  user_id: string;
  history: AgentInputItem[];
  pending_state: string | null;
  pending_approval_ids: string[];
};

// Another user's id reads as "not found" (404).
export async function getOrCreateConversation(userId: string, id?: string): Promise<ConversationRow> {
  if (id) {
    const [row] = await sql()<ConversationRow[]>`
      select * from conversations where id = ${id} and user_id = ${userId}`;
    if (!row) throw notFound("Conversa", "a");
    return row;
  }
  const [row] = await sql()<ConversationRow[]>`
    insert into conversations (user_id) values (${userId}) returning *`;
  return row;
}

// Callers only pass ids from getOrCreateConversation, which already checked the owner.
export async function saveHistory(id: string, history: AgentInputItem[]) {
  await sql()`update conversations set history = ${sql().json(history as unknown as JSONValue)} where id = ${id}`;
}

export async function setPending(id: string, state: string, approvalIds: string[]) {
  await sql()`
    update conversations set pending_state = ${state}, pending_approval_ids = ${approvalIds}::text[]
    where id = ${id}`;
}

export async function clearPending(id: string) {
  await sql()`update conversations set pending_state = null, pending_approval_ids = '{}' where id = ${id}`;
}
