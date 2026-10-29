export function formatInTimeZone(date: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

// Readable "now" for the agent, e.g. "quarta-feira, 29/10/2026 09:15 (America/Sao_Paulo, UTC-03:00)".
export function nowIn(timeZone: string, now = new Date()) {
  const text = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")
    ?.value.replace("GMT", "UTC");
  return `${text} (${timeZone}, ${offset})`;
}
