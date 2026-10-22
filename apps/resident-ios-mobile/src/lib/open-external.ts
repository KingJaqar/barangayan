import { Linking } from 'react-native';
import { safeExternalUrl } from './external-link';

/** Opens an allowlisted address. Resolves false when it cannot be opened (for example no mail account), so the screen can say so. */
export async function openExternal(url: string): Promise<boolean> {
  const safe = safeExternalUrl(url);
  if (!safe) return false;
  try {
    await Linking.openURL(safe);
    return true;
  } catch {
    return false;
  }
}
