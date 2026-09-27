import { useResident } from '../lib/runtime';
import { residentApi } from './resident-api';
export function useApi() {
  const { client, config, session } = useResident();
  return residentApi(client, config.barangayId, session?.user.id);
}
