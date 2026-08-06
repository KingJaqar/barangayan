import { Stack } from 'expo-router';

// Native Stack nested inside the "Services" NativeTabs tab, so screens here (Document
// Detail, Request Form, Payment, Request Tracking detail) can push over the
// Documents/Requests/Logs segmented-control index screen — see Expo Router's guidance on
// nesting a Stack inside NativeTabs for header + push support.
export default function ServicesLayout() {
  return <Stack />;
}
