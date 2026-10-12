import type { Database, Json } from '@barangayan/shared';
import type { TableName } from '../table-configs';

// Admin-only read views are deliberately local to the admin app. No resident
// DTO or write contract changes. JSON payloads match the existing route rows.
type ProjectionRow = { id: string; tenant_id: string; row: Json } & Record<string, Json>;
type SummaryRow = { summary: Json };
type View<Row> = { Row: Row; Relationships: [] };
export type AdminBrowseDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Views'> & {
    Views: { [K in TableName as `admin_${K}_browse`]: View<ProjectionRow> }
      & { [K in TableName as `admin_${K}_summary`]: View<SummaryRow> };
  };
};
