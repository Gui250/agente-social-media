import { describe, expect, it } from "vitest";
import { filterBrands, insertMention, mentionQuery, mentionedIds } from "@/lib/mentions";

const kids = { id: "b1", name: "Sorriso Kids", organizationName: "Clínica Sorriso" };
const estetica = { id: "b2", name: "Sorriso Estética", organizationName: "Clínica Sorriso" };
const padaria = { id: "b3", name: "Pão Quente", organizationName: "São João Padaria" };
const all = [kids, estetica, padaria];

describe("mentionQuery", () => {
  it.each([
    ["@", ""],
    ["oi @sor", "sor"],
    ["um post\n@Pao", "Pao"],
  ])("%j → %j", (input, query) => expect(mentionQuery(input)).toBe(query));

  it.each(["oi", "e-mail@x", "@sor kids", "@a @b c"])("%j has no open mention", (input) => {
    expect(mentionQuery(input)).toBeNull();
  });
});

describe("filterBrands", () => {
  it("matches the brand or the company, ignoring case and accents", () => {
    expect(filterBrands(all, "sorr")).toEqual([kids, estetica]);
    expect(filterBrands(all, "ESTETICA")).toEqual([estetica]);
    expect(filterBrands(all, "sao")).toEqual([padaria]);
    expect(filterBrands(all, "")).toEqual(all);
    expect(filterBrands(all, "xyz")).toEqual([]);
  });
});

describe("insertMention and mentionedIds", () => {
  it("replaces the open mention with the brand name", () => {
    expect(insertMention("um carrossel para @sor", kids)).toBe("um carrossel para @Sorriso Kids ");
    expect(insertMention("@", padaria)).toBe("@Pão Quente ");
  });

  it("keeps picked brands still mentioned in the text, without duplicates, up to 3", () => {
    expect(mentionedIds("@Sorriso Kids um carrossel", [kids, estetica])).toEqual(["b1"]);
    expect(mentionedIds("nada", [kids])).toEqual([]);
    expect(mentionedIds("@Sorriso Kids e @Sorriso Kids", [kids, kids])).toEqual(["b1"]);
    const four = [1, 2, 3, 4].map((n) => ({ id: `x${n}`, name: `M${n}`, organizationName: "E" }));
    expect(mentionedIds("@M1 @M2 @M3 @M4", four)).toEqual(["x1", "x2", "x3"]);
  });
});
