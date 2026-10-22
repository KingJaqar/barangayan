import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { householdQrPayloadSchema } from '@barangayan/shared';
import { DrrmSourceState } from '@/components/drrm/presentation';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

export function HouseholdCode({ size }: { size: number }) {
  const { session } = useAuth();
  const { profile, refetch } = useProfile();
  const parsed = householdQrPayloadSchema.safeParse({ type: 'household', version: '1.0', profileId: profile?.id });
  if (!parsed.success || profile?.id !== session?.user.id) {
    return <DrrmSourceState message="Your household QR code is unavailable. Refresh your profile and try again." retry={refetch} />;
  }
  return <LocalHouseholdCode key={parsed.data.profileId} size={size} value={JSON.stringify(parsed.data)} />;
}

function LocalHouseholdCode({ size, value }: { size: number; value: string }) {
  const { resident } = useTheme();
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return <View style={styles.root}>
    {failed ? <DrrmSourceState message="Your QR code could not be displayed. Close it and try again." />
      : <View accessibilityLabel="Your Family QR code" style={[styles.frame, { borderColor: resident.border, backgroundColor: resident.mediaForeground }]}>
        <QRCode value={value} size={size} quietZone={16} color={resident.mediaBackdrop} backgroundColor={resident.mediaForeground}
          onError={() => { void Promise.resolve().then(() => { if (mounted.current) setFailed(true); }); }} />
      </View>}
  </View>;
}
const styles = StyleSheet.create({ root: { gap: 12, alignItems: 'center', maxWidth: '100%' }, frame: { borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } });
