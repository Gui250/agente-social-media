import "server-only";
import { sql } from "@/lib/db";
import { notFound } from "@/lib/errors";

// A company has a single owner (specs/002-orgs-brands › FR-003): every query filters by user_id.
export type OrganizationRow = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  brand_count: number;
  created_at: string;
  updated_at: string;
};

const missing = () => notFound("Empresa", "a");

const withCount = () => sql()`
  select o.*, (select count(*)::int from brands b where b.organization_id = o.id) as brand_count
  from organizations o`;

export async function insertOrganization(row: { userId: string; name: string; slug: string }): Promise<OrganizationRow> {
  const [org] = await sql()<OrganizationRow[]>`
    insert into organizations (user_id, name, slug) values (${row.userId}, ${row.name}, ${row.slug})
    returning *, 0 as brand_count`;
  return org;
}

export async function listOrganizations(userId: string): Promise<OrganizationRow[]> {
  return sql()<OrganizationRow[]>`${withCount()} where o.user_id = ${userId} order by o.created_at desc`;
}

export async function getOrganization(userId: string, id: string): Promise<OrganizationRow> {
  const [org] = await sql()<OrganizationRow[]>`${withCount()} where o.id = ${id} and o.user_id = ${userId}`;
  if (!org) throw missing();
  return org;
}

export async function getOrganizationBySlug(userId: string, slug: string): Promise<OrganizationRow> {
  const [org] = await sql()<OrganizationRow[]>`${withCount()} where o.slug = ${slug} and o.user_id = ${userId}`;
  if (!org) throw missing();
  return org;
}

// The slug stays: links to the company keep working after a rename.
export async function renameOrganization(userId: string, id: string, name: string): Promise<OrganizationRow> {
  const [org] = await sql()<OrganizationRow[]>`
    update organizations o set name = ${name} where o.id = ${id} and o.user_id = ${userId}
    returning o.*, (select count(*)::int from brands b where b.organization_id = o.id) as brand_count`;
  if (!org) throw missing();
  return org;
}

// Brands and their files go with it (cascade). Returns the files' storage keys, read in the same
// statement before the delete, so the caller can remove them from Blob.
export async function deleteOrganization(userId: string, id: string): Promise<{ name: string; keys: string[] }> {
  const [row] = await sql()<{ name: string | null; keys: string[] }[]>`
    with files as (
      select a.storage_key from brand_assets a join brands b on b.id = a.brand_id
      where b.organization_id = ${id}
        and exists (select 1 from organizations o where o.id = ${id} and o.user_id = ${userId})
    ), gone as (
      delete from organizations where id = ${id} and user_id = ${userId} returning name
    )
    select (select name from gone) as name,
      coalesce((select array_agg(storage_key) from files), '{}') as keys`;
  if (row.name === null) throw missing();
  return { name: row.name, keys: row.keys };
}
