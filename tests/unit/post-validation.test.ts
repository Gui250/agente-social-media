import { describe, expect, it } from "vitest";
import { validatePostInput } from "@/controllers/post-validation";
import { DomainError } from "@/lib/errors";

const now = new Date("2026-10-29T12:00:00Z");
const img = (id: string) => ({ id, kind: "image" as const });
const vid = (id: string) => ({ id, kind: "video" as const });
const active = { status: "active" as const };

function check(input: Partial<Parameters<typeof validatePostInput>[0]>, deps: Partial<Parameters<typeof validatePostInput>[1]> = {}) {
  return validatePostInput(
    { postType: "image", caption: "Oi", mediaIds: ["m1"], scheduledAt: null, ...input },
    { now, media: [img("m1")], account: active, ...deps },
  );
}

function errorOf(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    return e as DomainError;
  }
  throw new Error("expected an error");
}

describe("validatePostInput", () => {
  it("accepts a valid image post without a date", () => {
    expect(check({}).scheduledAt).toBeNull();
  });

  it("requires a future ISO 8601 date with offset", () => {
    expect(check({ scheduledAt: "2026-10-30T10:00:00-03:00" }).scheduledAt?.toISOString()).toBe(
      "2026-10-30T13:00:00.000Z",
    );
    expect(check({ scheduledAt: "2026-10-30T10:00:00Z" }).scheduledAt).toBeInstanceOf(Date);
    expect(() => check({ scheduledAt: "2026-10-30T10:00:00" })).toThrow(DomainError);
    expect(() => check({ scheduledAt: "amanhã" })).toThrow(DomainError);
    expect(() => check({ scheduledAt: "2026-10-29T08:59:00-03:00" })).toThrow(/passado/);
  });

  it("checks media count and kind per post type", () => {
    expect(() => check({ postType: "image", mediaIds: [] }, { media: [] })).toThrow(DomainError);
    expect(() => check({ postType: "image" }, { media: [vid("m1")] })).toThrow(DomainError);
    expect(() =>
      check({ postType: "carousel", mediaIds: ["m1"] }, { media: [img("m1")] }),
    ).toThrow(DomainError);
    const twenty = Array.from({ length: 20 }, (_, i) => img(`m${i}`));
    expect(() =>
      check({ postType: "carousel", mediaIds: twenty.map((m) => m.id) }, { media: twenty }),
    ).not.toThrow();
    const twentyOne = [...twenty, img("m21")];
    expect(() =>
      check({ postType: "carousel", mediaIds: twentyOne.map((m) => m.id) }, { media: twentyOne }),
    ).toThrow(DomainError);
    expect(() => check({ postType: "reel" }, { media: [vid("m1")] })).not.toThrow();
    expect(() => check({ postType: "reel" }, { media: [img("m1")] })).toThrow(DomainError);
  });

  it("limits caption to 2200 characters and 30 hashtags", () => {
    expect(() => check({ caption: "a".repeat(2201) })).toThrow(DomainError);
    const tags = (n: number) => Array.from({ length: n }, (_, i) => `#t${i}`).join(" ");
    expect(() => check({ caption: tags(30) })).not.toThrow();
    expect(() => check({ caption: tags(31) })).toThrow(/hashtags/);
  });

  it("returns 404 when a media id is not the user's", () => {
    expect(errorOf(() => check({ mediaIds: ["m1", "m2"], postType: "carousel" }, { media: [img("m1")] })).status).toBe(404);
  });

  it("rejects an account that is not active", () => {
    expect(errorOf(() => check({}, { account: { status: "expired" } })).message).toMatch(
      /conta Instagram expirada, reconecte em Contas/i,
    );
  });
});
