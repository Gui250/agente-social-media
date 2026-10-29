// Browser-side JSON fetch that surfaces the API's Portuguese error message.
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? "Algo deu errado. Tente de novo.");
  return data as T;
}

// POST to a route that answers with ndjson() (src/lib/http.ts): calls onEvent for each progress
// event and resolves with the final response.
export async function apiStream<T, E>(path: string, body: unknown, onEvent: (event: E) => void): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message ?? "Algo deu errado. Tente de novo.");
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      const event = JSON.parse(line);
      if (event.type === "done") return event.response as T;
      if (event.type === "error") throw new Error(event.message);
      onEvent(event as E);
    }
  }
  throw new Error("A conexão caiu antes da resposta. Tente de novo.");
}
