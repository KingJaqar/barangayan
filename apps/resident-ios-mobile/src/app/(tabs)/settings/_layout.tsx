import { ResidentStack } from '../../../components/resident-stack';
export default function Layout() {
  return <ResidentStack title="Settings" settingsShortcut={false} screens={{ profile: 'My profile', 'id-verification': 'ID verification', 'location-verification': 'Location verification', 'change-password': 'Change password', 'help/index': 'Help', 'help/[id]': 'Help article', information: 'Resident information' }} />;
}
