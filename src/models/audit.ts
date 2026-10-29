import "server-only";
import type { JSONValue } from "postgres";
import { sql } from "@/lib/db";

export type AuditEntity = "organization" | "brand" | "brand_asset";

// e.g. organization.create, brand.update, brand_asset.replace. Metadata never holds secrets.
export async function recordAudit(row: {
  userId: string;
  action: string;
  entityType: AuditEntity;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  await sql()`
    insert into audit_log (user_id, action, entity_type, entity_id, metadata)
    values (${row.userId}, ${row.action}, ${row.entityType}, ${row.entityId}, ${sql().json((row.metadata ?? {}) as JSONValue)})`;
}
