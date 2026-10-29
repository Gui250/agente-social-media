// Plain data only: RunState.toString() serializes the context into the database.
export type AgentContext = {
  userId: string;
  timezone: string;
  conversationId: string;
};
