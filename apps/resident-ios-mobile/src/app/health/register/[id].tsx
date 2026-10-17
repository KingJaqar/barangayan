import { useLocalSearchParams } from 'expo-router';
import { RequireResident } from '../../../components/require-resident';
import { RegisterScreen } from '../../../features/health/register-screen';

export default function DriveRegistrationRoute() {
  const { id } = useLocalSearchParams();
  return <RequireResident purpose="register for medical drives"><RegisterScreen id={id} /></RequireResident>;
}
