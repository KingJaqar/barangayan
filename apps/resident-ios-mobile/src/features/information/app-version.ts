import { nativeApplicationVersion, nativeBuildVersion } from 'expo-application';
import { versionLabel } from './about-model';

/** The version and build of the installed binary (CFBundleShortVersionString and CFBundleVersion), never a configured value. */
export const appVersionLabel = (): string => versionLabel(nativeApplicationVersion, nativeBuildVersion);
