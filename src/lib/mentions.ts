// The chat's "@" menu (specs/003-brand-kit-no-chat). Pure, so the panel and the tests share it.
export type BrandOption = { id: string; name: string; organizationName: string };

const MAX_MENTIONS = 3;

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// What follows an "@" that starts the last word, or null when no mention is being typed.
export function mentionQuery(input: string): string | null {
  return input.match(/(?:^|\s)@([^\s@]*)$/)?.[1] ?? null;
}

export function filterBrands(options: BrandOption[], query: string) {
  const q = fold(query);
  return options.filter((o) => fold(o.name).includes(q) || fold(o.organizationName).includes(q));
}

// Swaps the "@query" being typed for "@Brand Name ".
export function insertMention(input: string, option: BrandOption) {
  const query = mentionQuery(input) ?? "";
  return `${input.slice(0, input.length - query.length - 1)}@${option.name} `;
}

// Ids of the picked brands whose "@Name" is still in the message.
export function mentionedIds(text: string, picked: BrandOption[]) {
  const ids = picked.filter((o) => text.includes(`@${o.name}`)).map((o) => o.id);
  return [...new Set(ids)].slice(0, MAX_MENTIONS);
}
