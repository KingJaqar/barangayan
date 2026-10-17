import { Redirect } from 'expo-router';

/** Android's standalone guide screen was a placeholder; its useful outcome is the hub's Guidelines section. */
export default function PreparednessGuide() {
  return <Redirect href={{ pathname: '/emergency', params: { section: 'guidelines' } }} />;
}
