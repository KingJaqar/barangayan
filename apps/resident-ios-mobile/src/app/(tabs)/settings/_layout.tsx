import { ResidentStack } from '../../../components/resident-stack';
export default function Layout() {
  return <ResidentStack title="Settings" settingsShortcut={false} screens={{ profile: 'My profile', 'change-password': 'Change password', 'help/index': 'Help', 'help/[id]': 'Help article', information: 'Resident information' }} />;
}
