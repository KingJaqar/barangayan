import { useLocalSearchParams } from 'expo-router';
import { DriveDetail } from '../../../features/health/drive-detail';
export default function Drive() {
  const { id } = useLocalSearchParams();
  return <DriveDetail id={id} />;
}
