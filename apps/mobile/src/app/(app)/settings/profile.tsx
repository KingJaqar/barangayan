import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { supabase } from '@/lib/supabase';

// Real, editable — the same profile row created at the end of Register/OTP verification
// (see (auth)/otp.tsx), so what a resident typed into Register is exactly what shows up
// here after they log in. Household Information and Identification (design file) stay
// out of scope: no household_members table or ID storage bucket exists yet.
export default function ProfileScreen() {
  const { session } = useAuth();
  const { profile, isLoading, refetch } = useProfile();

  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setMobileNumber(profile.mobile_number ?? '');
      setHomeAddress(profile.home_address ?? '');
    }
  }, [profile]);

  async function handleSave() {
    if (!session) return;
    setError(null);
    setSaved(false);
    setSaving(true);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        mobile_number: mobileNumber || null,
        home_address: homeAddress || null,
      })
      .eq('id', session.user.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);
    refetch();
  }

  if (isLoading) {
    return <PlaceholderPanel label="Loading profile…" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Profile
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">Personal Information</ThemedText>

          <TextField label="Full Name" value={fullName} onChangeText={setFullName} />
          <TextField label="Email" value={session?.user.email ?? ''} editable={false} />
          <TextField label="Mobile Number" value={mobileNumber} onChangeText={setMobileNumber} />
          <TextField label="Home Address" value={homeAddress} onChangeText={setHomeAddress} multiline />

          <View style={styles.barangayRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Barangay
            </ThemedText>
            <ThemedText type="small">{profile?.barangays?.name ?? '—'}</ThemedText>
          </View>
        </ThemedView>

        {error ? (
          <ThemedText type="small" themeColor="accentRed">
            {error}
          </ThemedText>
        ) : null}
        {saved ? (
          <ThemedText type="small" themeColor="primary">
            Saved.
          </ThemedText>
        ) : null}

        <PrimaryButton label="Save Changes" loading={saving} onPress={handleSave} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 26,
  },
  section: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  barangayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.one,
  },
});
