import { ResidentStack } from '../../../components/resident-stack';
export default function Layout() {
  return <ResidentStack title="Settings" settingsShortcut={false} screens={{ appearance: 'Appearance', profile: 'My profile', 'id-verification': 'ID verification', 'location-verification': 'Location verification', 'change-password': 'Change password', notifications: 'Notifications', 'help/index': 'Help', 'help/[id]': 'Help article', 'terms-privacy': 'Terms and Privacy', about: 'About Us', 'download-data': 'Download My Data', 'delete-account': 'Delete My Account' }} />;
}
