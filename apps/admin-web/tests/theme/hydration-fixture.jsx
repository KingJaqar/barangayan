import { ThemeForm } from '../../src/app/(admin)/theme/theme-form';
import { ThemeControllerProvider } from '../../src/components/ui/theme-controller';
import { AccentControllerProvider } from '../../src/components/ui/accent-controller';
import { FontControllerProvider } from '../../src/components/ui/font-controller';

export function ThemeFixture({ initialCustomColors = [] }) {
  return <ThemeControllerProvider><AccentControllerProvider><FontControllerProvider>
    <ThemeForm initialTheme="dark" initialAccentColor="#0F6E5B" initialCustomColors={initialCustomColors} initialFontId="system" />
  </FontControllerProvider></AccentControllerProvider></ThemeControllerProvider>;
}
