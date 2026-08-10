import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function QrGuideScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/home/emergency-info');
  }, [router]);

  return null;
}
