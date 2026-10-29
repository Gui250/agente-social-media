import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { notFound, validate } from "@/lib/errors";
import { removeOrphans } from "@/lib/storage";
import { recordAudit } from "@/models/audit";
import {
  deleteOrganization,
  getOrganizationBySlug,
  insertOrganization,
  listOrganizations,
  renameOrganization,
  type OrganizationRow,
} from "@/models/organization";

export const OrganizationName = z
  .string()
  .trim()
  .min(2, "O nome da empresa precisa ter pelo menos 2 caracteres.")
  .max(80, "O nome da empresa pode ter até 80 caracteres.");
export const OrganizationInput = z.object({ name: OrganizationName });

export type Organization = ReturnType<typeof view>;

const view = (o: OrganizationRow) => ({
  id: o.id,
  name: o.name,
  slug: o.slug,
  brandCount: o.brand_count,
  createdAt: o.created_at,
  updatedAt: o.updated_at,
});

// Malformed ids would be a Postgres cast error (500); they are just ids that don't exist.
export function assertId(id: string, what: () => Error) {
  if (!z.uuid().safeParse(id).success) throw what();
}

const missing = () => notFound("Empresa", "a");

// "Ação & Cia" → "acao-cia". Never empty, at most 60 chars (a collision suffix adds 5).
export function slugify(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return slug || "empresa";
}

const isUniqueViolation = (e: unknown) => (e as { code?: string }).code === "23505";

export async function create(userId: string, rawName: string) {
  const name = validate(OrganizationName, rawName);
  const base = slugify(name);
  let org: OrganizationRow | undefined;
  for (let attempt = 0; !org; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    try {
      org = await insertOrganization({ userId, name, slug });
    } catch (e) {
      if (!isUniqueViolation(e) || attempt === 2) throw e;
    }
  }
  await recordAudit({ userId, action: "organization.create", entityType: "organization", entityId: org.id, metadata: { name } });
  return view(org);
}

export async function list(userId: string) {
  return (await listOrganizations(userId)).map(view);
}

export async function getBySlug(userId: string, slug: string) {
  return view(await getOrganizationBySlug(userId, slug));
}

export async function rename(userId: string, id: string, rawName: string) {
  assertId(id, missing);
  const name = validate(OrganizationName, rawName);
  const org = await renameOrganization(userId, id, name);
  await recordAudit({ userId, action: "organization.rename", entityType: "organization", entityId: id, metadata: { name } });
  return view(org);
}

export async function remove(userId: string, id: string) {
  assertId(id, missing);
  const { name, keys } = await deleteOrganization(userId, id);
  await recordAudit({ userId, action: "organization.delete", entityType: "organization", entityId: id, metadata: { name } });
  await removeOrphans(keys);
}
