import "server-only";
import type { JSONValue } from "postgres";
import { sql } from "@/lib/db";
import { notFound } from "@/lib/errors";

// Brands are authorized through their company's owner: every query joins organizations o and
// filters o.user_id.
export type ColorRole = "primary" | "secondary" | "accent" | "background" | "text" | "other";
export type FontUsage = "heading" | "subheading" | "body" | "other";
export type BrandColor = { hex: string; role: ColorRole };
export type BrandFont = { family: string; usage: FontUsage };

export type BrandRow = {
  id: string;
  organization_id: string;
  organization_slug: string;
  organization_name: string;
  name: string;
  description: string | null;
  industry: string | null;
  target_audience: string | null;
  brand_voice: string | null;
  color_palette: BrandColor[];
  typography: BrandFont[];
  visual_guidelines: string[];
  forbidden_elements: string[];
  created_at: string;
  updated_at: string;
};

export type BrandFields = Partial<
  Pick<
    BrandRow,
    | "name"
    | "description"
    | "industry"
    | "target_audience"
    | "brand_voice"
    | "color_palette"
    | "typography"
    | "visual_guidelines"
    | "forbidden_elements"
  >
>;

const missing = () => notFound("Marca", "a");

// jsonb columns go in as JSON; postgres.js would otherwise send an array of objects as a PG array.
function columns(fields: BrandFields) {
  const { color_palette, typography, ...rest } = fields;
  return {
    ...rest,
    ...(color_palette && { color_palette: sql().json(color_palette as JSONValue) }),
    ...(typography && { typography: sql().json(typography as JSONValue) }),
  };
}

// Only inserts when the company belongs to userId. The kit starts empty and is set by updateBrand.
export async function insertBrand(
  userId: string,
  organizationId: string,
  f: Pick<BrandFields, "description" | "industry" | "target_audience" | "brand_voice"> & { name: string },
): Promise<BrandRow> {
  const [brand] = await sql()<BrandRow[]>`
    with b as (
      insert into brands (organization_id, name, description, industry, target_audience, brand_voice)
      select o.id, ${f.name}, ${f.description ?? null}, ${f.industry ?? null}, ${f.target_audience ?? null},
        ${f.brand_voice ?? null}
      from organizations o where o.id = ${organizationId} and o.user_id = ${userId}
      returning *
    )
    select b.*, o.slug as organization_slug, o.name as organization_name
    from b join organizations o on o.id = b.organization_id`;
  if (!brand) throw notFound("Empresa", "a");
  return brand;
}

export async function listBrands(userId: string, organizationId: string): Promise<BrandRow[]> {
  return sql()<BrandRow[]>`
    select b.*, o.slug as organization_slug, o.name as organization_name
    from brands b join organizations o on o.id = b.organization_id
    where o.id = ${organizationId} and o.user_id = ${userId}
    order by b.name`;
}

export async function getBrand(userId: string, id: string): Promise<BrandRow> {
  const [brand] = await sql()<BrandRow[]>`
    select b.*, o.slug as organization_slug, o.name as organization_name
    from brands b join organizations o on o.id = b.organization_id
    where b.id = ${id} and o.user_id = ${userId}`;
  if (!brand) throw missing();
  return brand;
}

// Updates only the given columns.
export async function updateBrand(userId: string, id: string, fields: BrandFields): Promise<BrandRow> {
  if (Object.keys(fields).length === 0) return getBrand(userId, id);
  const [brand] = await sql()<BrandRow[]>`
    update brands b set ${sql()(columns(fields))}
    from organizations o
    where b.id = ${id} and o.id = b.organization_id and o.user_id = ${userId}
    returning b.*, o.slug as organization_slug, o.name as organization_name`;
  if (!brand) throw missing();
  return brand;
}

// Its files go with it (cascade); returns their storage keys so the caller removes them from Blob.
export async function deleteBrand(userId: string, id: string): Promise<{ name: string; keys: string[] }> {
  const [row] = await sql()<{ name: string | null; keys: string[] }[]>`
    with files as (
      select storage_key from brand_assets where brand_id = ${id}
    ), gone as (
      delete from brands b using organizations o
      where b.id = ${id} and o.id = b.organization_id and o.user_id = ${userId}
      returning b.name
    )
    select (select name from gone) as name,
      coalesce((select array_agg(storage_key) from files), '{}') as keys`;
  if (row.name === null) throw missing();
  return { name: row.name, keys: row.keys };
}
