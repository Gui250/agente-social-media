import "server-only";
import { sql } from "@/lib/db";
import { notFound } from "@/lib/errors";

// Authorized through brand → organization owner, like src/models/brand.ts.
export type AssetType = "logo" | "logo_alt" | "other";
export type BrandAssetRow = {
  id: string;
  brand_id: string;
  asset_type: AssetType;
  storage_key: string;
  mime_type: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
  size_bytes: number;
  created_at: string;
};
export type NewAsset = Omit<BrandAssetRow, "id" | "created_at">;

const missing = () => notFound("Arquivo");

const owned = (userId: string, brandId: string) => sql()`
  exists (
    select 1 from brands b join organizations o on o.id = b.organization_id
    where b.id = ${brandId} and o.user_id = ${userId}
  )`;

// Logo first, then the others in upload order.
export async function listAssets(userId: string, brandId: string): Promise<BrandAssetRow[]> {
  return sql()<BrandAssetRow[]>`
    select * from brand_assets where brand_id = ${brandId} and ${owned(userId, brandId)}
    order by asset_type = 'logo' desc, created_at`;
}

export async function countNonLogoAssets(userId: string, brandId: string): Promise<number> {
  const [{ count }] = await sql()<{ count: number }[]>`
    select count(*)::int as count from brand_assets
    where brand_id = ${brandId} and asset_type <> 'logo' and ${owned(userId, brandId)}`;
  return count;
}

export async function insertAsset(userId: string, row: NewAsset): Promise<BrandAssetRow> {
  const [asset] = await sql()<BrandAssetRow[]>`
    insert into brand_assets (brand_id, asset_type, storage_key, mime_type, width, height, size_bytes)
    select ${row.brand_id}, ${row.asset_type}, ${row.storage_key}, ${row.mime_type}, ${row.width}, ${row.height},
      ${row.size_bytes}
    where ${owned(userId, row.brand_id)}
    returning *`;
  if (!asset) throw notFound("Marca", "a");
  return asset;
}

// One logo per brand: swaps it in a transaction and returns the old file's key for removal.
export async function replaceLogo(userId: string, row: NewAsset): Promise<{ asset: BrandAssetRow; oldKey: string | null }> {
  return sql().begin(async (tx) => {
    const [old] = await tx<{ storage_key: string }[]>`
      delete from brand_assets
      where brand_id = ${row.brand_id} and asset_type = 'logo' and ${owned(userId, row.brand_id)}
      returning storage_key`;
    const [asset] = await tx<BrandAssetRow[]>`
      insert into brand_assets (brand_id, asset_type, storage_key, mime_type, width, height, size_bytes)
      select ${row.brand_id}, 'logo', ${row.storage_key}, ${row.mime_type}, ${row.width}, ${row.height}, ${row.size_bytes}
      where ${owned(userId, row.brand_id)}
      returning *`;
    if (!asset) throw notFound("Marca", "a");
    return { asset, oldKey: old?.storage_key ?? null };
  });
}

// Returns the deleted file's storage key.
export async function deleteAsset(userId: string, brandId: string, assetId: string): Promise<string> {
  const [row] = await sql()<{ storage_key: string }[]>`
    delete from brand_assets
    where id = ${assetId} and brand_id = ${brandId} and ${owned(userId, brandId)}
    returning storage_key`;
  if (!row) throw missing();
  return row.storage_key;
}
