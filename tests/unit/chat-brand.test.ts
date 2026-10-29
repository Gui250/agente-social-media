import { beforeEach, describe, expect, it, vi } from "vitest";

const KIDS = "11111111-1111-4111-8111-111111111111";
const EST = "22222222-2222-4222-8222-222222222222";
const FOREIGN = "33333333-3333-4333-8333-333333333333";

const conversation = {
  id: "c1",
  user_id: "u1",
  history: [] as unknown[],
  pending_state: null as string | null,
  pending_approval_ids: [] as string[],
  brand_id: null as string | null,
};
const setConversationBrand = vi.fn();
const runs: { input: unknown; context: { brandId: string | null } }[] = [];
let interruptions: unknown[] = [];

vi.mock("@/agent/agent", () => ({ socialMediaAgent: {} }));
vi.mock("@/models/profile", () => ({ getProfile: async () => ({ timezone: "America/Sao_Paulo" }) }));
vi.mock("@/models/account", () => ({ listAccounts: async () => [] }));
vi.mock("@/models/conversation", () => ({
  getOrCreateConversation: vi.fn(async () => conversation),
  setConversationBrand,
  clearPending: vi.fn(),
  setPending: vi.fn(),
  saveHistory: vi.fn(),
  setSummary: vi.fn(),
}));
vi.mock("@/controllers/brands", () => ({
  activeKit: async (_u: string, id: string | null) => (id === KIDS ? { id: KIDS, name: "Sorriso Kids" } : null),
  options: async () => [
    { id: KIDS, name: "Sorriso Kids", organizationName: "Clínica Sorriso" },
    { id: EST, name: "Sorriso Estética", organizationName: "Clínica Sorriso" },
  ],
}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/agent/summarizer", () => ({ summarizeConversation: async () => "" }));
vi.mock("@openai/agents", () => ({
  run: vi.fn(async (_agent, input, opts) => {
    runs.push({ input, context: opts.context });
    return {
      interruptions,
      history: [],
      state: { toString: () => "STATE" },
      finalOutput: "Pronto.",
      completed: Promise.resolve(),
      async *[Symbol.asyncIterator]() {},
    };
  }),
  user: (t: string) => t,
}));

const { sendMessage } = await import("@/controllers/chat");
const { summarize } = await import("@/agent/approval-summary");

const lastUserText = () => (runs.at(-1)!.input as string[]).at(-1)!;

describe("chat.sendMessage with brand mentions", () => {
  beforeEach(() => {
    runs.length = 0;
    setConversationBrand.mockClear();
    conversation.brand_id = null;
  });

  it("one owned brand: becomes the active brand and is marked in the message", async () => {
    await sendMessage("u1", { conversationId: "c1", message: "@Sorriso Kids um carrossel", brandIds: [KIDS] });
    expect(setConversationBrand).toHaveBeenCalledWith("u1", "c1", KIDS);
    expect(lastUserText()).toBe(
      `@Sorriso Kids um carrossel\n\n[marca mencionada: ${KIDS} — Sorriso Kids (Clínica Sorriso)]`,
    );
    expect(runs[0].context.brandId).toBe(KIDS);
  });

  it("drops a brand that isn't the user's, silently", async () => {
    await sendMessage("u1", { conversationId: "c1", message: "@Outra post", brandIds: [FOREIGN] });
    expect(setConversationBrand).not.toHaveBeenCalled();
    expect(lastUserText()).toBe("@Outra post");
    expect(runs[0].context.brandId).toBeNull();
  });

  it("two brands: both marked, the active brand stays as it was", async () => {
    conversation.brand_id = EST;
    await sendMessage("u1", { conversationId: "c1", message: "@Sorriso Kids ou @Sorriso Estética?", brandIds: [KIDS, EST] });
    expect(setConversationBrand).not.toHaveBeenCalled();
    expect(lastUserText().match(/\[marca mencionada:/g)).toHaveLength(2);
    expect(runs[0].context.brandId).toBe(EST);
  });

  it("marks brands after the attached media", async () => {
    const media = "44444444-4444-4444-8444-444444444444";
    await sendMessage("u1", { conversationId: "c1", message: "arte", mediaIds: [media], brandIds: [KIDS] });
    expect(lastUserText()).toMatch(/\[mídias anexadas: .+\]\n\[marca mencionada: .+\]$/);
  });

  it("without mentions, keeps the conversation's active brand in the context", async () => {
    conversation.brand_id = KIDS;
    await sendMessage("u1", { conversationId: "c1", message: "outro roteiro" });
    expect(runs[0].context.brandId).toBe(KIDS);
    expect(lastUserText()).toBe("outro roteiro");
  });
});

describe("approval summary with an active brand", () => {
  const options = { timezone: "America/Sao_Paulo", accounts: [] };

  it("names the brand on the paid generation card", () => {
    expect(summarize("generate_creative_media", "{}", { ...options, brandName: "Sorriso Kids" })).toMatch(
      /^Gerar com IA as mídias do roteiro para a marca Sorriso Kids\. Cada geração tem custo/,
    );
    expect(summarize("generate_creative_media", "{}", options)).toMatch(/^Gerar com IA as mídias do roteiro \(/);
  });

  it("the card built by the chat carries the active brand's name", async () => {
    conversation.brand_id = KIDS;
    interruptions = [{ rawItem: { callId: "call-1" }, name: "generate_creative_media", arguments: "{}" }];
    const res = await sendMessage("u1", { conversationId: "c1", message: "gera a arte" });
    interruptions = [];
    expect(res).toMatchObject({ status: "needs_approval" });
    if (res.status !== "needs_approval") return;
    expect(res.approvals[0].summary).toContain("para a marca Sorriso Kids");
  });
});

describe("run deadline", () => {
  it("answers with a clear error before the platform kills the request", async () => {
    vi.useFakeTimers();
    try {
      const { run } = await import("@openai/agents");
      let signal: AbortSignal | undefined;
      vi.mocked(run).mockImplementationOnce(async (_agent, _input, opts) => {
        signal = (opts as { signal?: AbortSignal }).signal;
        return new Promise(() => {}) as never; // a step that never answers
      });
      const reply = sendMessage("u1", { conversationId: "c1", message: "oi" });
      const outcome = expect(reply).rejects.toMatchObject({ code: "timeout", message: expect.stringContaining("demorou demais") });
      await vi.advanceTimersByTimeAsync(270_000);
      await outcome;
      expect(signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
