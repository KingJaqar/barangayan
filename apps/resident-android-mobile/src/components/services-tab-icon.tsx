import { Image } from 'react-native';

/** Shared Services artwork for the tab bar and home quick action. */
export function ServicesTabIcon({ color, size = 24 }: { color: string; size?: number }) {
  return <Image source={require('../../assets/images/services-icon.png')}
    style={{ width: size, height: size, tintColor: color }} resizeMode="contain" accessible={false} />;
}
