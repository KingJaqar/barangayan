import type { BrowseConfig } from './browse-state';
import { TABLE_CONFIGS } from './table-configs';

export type ProfileTable = 'residents' | 'households' | 'staff';
// Full Name is a toolbar-only sort in Directory, whose first column is First Name.
const columns = {
  residents: ['first_name', 'last_name', 'email', 'email_verification', 'id_status', 'joined'],
  households: ['name', 'head', 'relation', 'role', 'checked_in', 'center', 'added'],
  staff: ['name', 'role', 'email', 'hired'],
};
function profileConfig(name: ProfileTable): BrowseConfig {
  return { ...TABLE_CONFIGS[name], sorts: TABLE_CONFIGS[name].sorts.map(sort => ({ ...sort,
    ...(columns[name].includes(sort.key) ? { columnId: sort.key } : {}) })) };
}
export const PROFILE_TABLE_CONFIGS = {
  residents: profileConfig('residents'), households: profileConfig('households'), staff: profileConfig('staff'),
};
