import "server-only";
import postgres from "postgres";
import { env } from "@/lib/env";

let client: postgres.Sql | undefined;

// One small pool per server instance. prepare: false because Neon's pooler (PgBouncer,
// transaction mode) can't keep prepared statements across transactions.
export function sql() {
  client ??= postgres(env().DATABASE_URL, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    onnotice: () => {},
    types: {
      // Rows keep the shapes the app (and the JSON API) already uses: ISO strings and numbers.
      timestamptz: {
        to: 1184,
        from: [1184],
        serialize: (v: Date | string) => (v instanceof Date ? v.toISOString() : v),
        parse: (s: string) => new Date(s).toISOString(),
      },
      int8: { to: 20, from: [20], serialize: (n: number) => String(n), parse: Number },
    },
  });
  return client;
}
