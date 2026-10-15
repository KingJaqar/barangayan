import { useRouter } from 'expo-router';
import { useAuthFlow } from '../../auth/auth-flow';
import { Action, Body, Card, Screen } from '../../components/ui';
import { AuthenticatedRedirect, SignedOutBanner } from './parts';

/** Signed-out entry: create an account, log in, or browse public information as a guest. */
export default function ChoiceScreen() {
  const router = useRouter();
  const { setGuest } = useAuthFlow();
  return <Screen>
    <AuthenticatedRedirect />
    <Body heading>Barangayan</Body>
    <Body tone="secondary">One barangay, one account. Stay connected to your barangay community.</Body>
    <SignedOutBanner />
    <Card>
      <Action label="Create an account" onPress={() => router.push('/auth/register')} />
      <Action label="I'm a resident, log in" secondary onPress={() => router.push('/auth/login')} />
    </Card>
    <Action label="Continue as guest" secondary hint="Browse public information. Personal services need an account." onPress={() => { setGuest(true); router.replace('/home'); }} />
    <Body tone="secondary" role="footnote">Guests can read public information, appearance and help. Requests, emergency check-in and medical-drive registration need a resident account.</Body>
  </Screen>;
}
