import type { Database, Json } from '@barangayan/shared';
import type { AdminBrowseDatabase } from './queries/schema';
import type { TableName } from './table-configs';

export type AdminRecordDatabase = Omit<AdminBrowseDatabase, 'public'> & {
  public: Omit<AdminBrowseDatabase['public'], 'Views' | 'Functions'> & {
    Views: AdminBrowseDatabase['public']['Views'] & {
      [K in TableName as `admin_${K}_records`]: { Row: { id: string; tenant_id: string; row: Json; f_archived: boolean } & Record<string, Json>; Relationships: [] }
    };
    Functions: Database['public']['Functions'] & {
      admin_mutate_record: { Args: { p_screen: string; p_id: string; p_operation: string; p_patch: Json; p_expected: string }; Returns: Json };
    };
  };
};
