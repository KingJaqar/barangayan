import { PlaceholderPanel } from '@/components/placeholder-panel';

// Guide-before-camera: shown before the QR Scanner ever mounts (a locked structural
// decision — AGENTS.md §4). Scanner itself (maps/qr-scanner.tsx) and the real guide
// copy/steps are built out with the rest of the Maps tab's content.
export default function QrGuideScreen() {
  return <PlaceholderPanel label="QR check-in guide goes here, then Start Scanning." />;
}
