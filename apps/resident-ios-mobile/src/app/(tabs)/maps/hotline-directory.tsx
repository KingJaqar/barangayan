import { Redirect } from 'expo-router';

/** Android's standalone hotline screen was a placeholder; its useful outcome is the hub's Hotlines section. */
export default function HotlineDirectory() {
  return <Redirect href={{ pathname: '/emergency', params: { section: 'hotlines' } }} />;
}
