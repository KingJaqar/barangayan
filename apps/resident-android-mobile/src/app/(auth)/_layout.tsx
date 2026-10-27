import { Stack, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Alert, BackHandler } from 'react-native';

import { AuthHeader } from '@/components/auth-header';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { authSetupRequests } from '@/lib/setup-request';
import { passwordRecovery } from '@/lib/supabase';

// Mounted for signed-out users and password recovery — see the root _layout.tsx.
// Blank titles + native back button, approximating the design file's
// minimal back-chevron header without a bespoke header component.
export default function AuthLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { session, setPasswordRecovery } = useAuth();
  const recoveryScreen = ['forgot-password', 'otp', 'reset-password'].includes(segments.at(-1) ?? '');
  const cancelRecovery = useCallback(() => {
    if (authSetupRequests.busy) {
      Alert.alert('Please wait', 'A recovery request is still finishing. Wait before leaving.');
      return true;
    }
    passwordRecovery.clear();
    setPasswordRecovery(false);
    router.replace(session ? '/settings/change-password' : '/(auth)/login');
    return true;
  }, [router, session, setPasswordRecovery]);

  useEffect(() => {
    if (!recoveryScreen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', cancelRecovery);
    return () => subscription.remove();
  }, [recoveryScreen, cancelRecovery]);

  const recoveryOptions = (title: string) => ({
    gestureEnabled: false,
    header: () => <AuthHeader title={title} onBack={cancelRecovery} />,
  });
  return (
    <Stack screenOptions={{ headerTitle: '', headerShadowVisible: false, headerTitleStyle: { fontFamily: Fonts.gideonRoman, fontWeight: '400' } }}>
      <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="value-prop" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="personalization" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="auth-choice" options={{ headerShown: false, animation: 'fade' }} />
      {/* login/register render their own AuthHeader (green bar + back chevron) —
          the native Stack header would otherwise stack a second header above it. */}
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={recoveryOptions('Forgot Password')} />
      <Stack.Screen name="otp" options={recoveryOptions('Enter Reset Code')} />
      <Stack.Screen name="reset-password" options={recoveryOptions('Reset Password')} />
    </Stack>
  );
}
