import { ResidentStack } from '../../../components/resident-stack';
export default function Layout() {
  return <ResidentStack title="Reports" screens={{ 'announcements/[announcementId]': 'Announcement', 'incidents/[incidentId]': 'Concern details', '[id]': 'Announcement' }} />;
}
