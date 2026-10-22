import { useWindowDimensions } from 'react-native';
import { ScanFamilySheet } from '@/components/drrm/scan-family-sheet';
import { HouseholdCode } from '@/components/drrm/household-code';
import { ThemedText } from '@/components/themed-text';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

export function HouseholdQrModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { profile } = useProfile();
  const { resident } = useTheme();
  const { width } = useWindowDimensions();
  return <ScanFamilySheet visible={visible} onClose={onClose} title={profile?.full_name || 'Household QR Code'} slide>
    <HouseholdCode size={Math.max(80, Math.min(208, width - 64))} />
    <ThemedText style={{ fontSize: 13, lineHeight: 20, textAlign: 'center', color: resident.muted }}>Show this Family QR to barangay staff. They confirm each person who is present.</ThemedText>
  </ScanFamilySheet>;
}
