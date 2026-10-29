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

export type ConversationSummary = { id: string; title: string | null; updated_at: Date };

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

export async function setSummary(id: string, summary: string) {
  await sql()`update conversations set summary = ${summary} where id = ${id}`;
}

// Title = the AI summary, or the start of the first user message until there is one (its content
// is either a string or [{type: "input_text", text}]). A run paused on its first message has no
// saved history yet (it lives in pending_state): null.
// ponytail: newest 50 only, paginate when someone needs older conversations.
export async function listConversations(userId: string) {
  return sql()<ConversationSummary[]>`
    select id, updated_at,
      coalesce(summary, (select left(coalesce(m->'content'->0->>'text', m->>'content'), 80)
        from jsonb_array_elements(history) m where m->>'role' = 'user' limit 1)) as title
    from conversations
    where user_id = ${userId} and (jsonb_array_length(history) > 0 or pending_state is not null)
    order by updated_at desc
    limit 50`;
}

// Scripts, posts and media made in the conversation are their own rows and stay.
export async function deleteConversation(userId: string, id: string) {
  const { count } = await sql()`delete from conversations where id = ${id} and user_id = ${userId}`;
  if (!count) throw notFound("Conversa", "a");
}
