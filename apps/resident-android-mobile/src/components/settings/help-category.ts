import type { Ionicons } from '@expo/vector-icons';
import { FAQ_CATEGORIES, FAQ_CATEGORY_META } from '@barangayan/shared';
import type { useTheme } from '@/hooks/use-theme';

const icons: Record<(typeof FAQ_CATEGORIES)[number], keyof typeof Ionicons.glyphMap> = {
  general: 'information-circle-outline', services: 'briefcase-outline', emergency: 'alert-circle-outline',
  health: 'medkit-outline', billing: 'card-outline', account: 'person-circle-outline',
};
export function helpCategory(value: string, resident: ReturnType<typeof useTheme>['resident']) {
  const key = FAQ_CATEGORIES.find(category => category === value);
  const tone = key === 'emergency' ? { ink: resident.danger, soft: resident.dangerSoft }
    : key === 'health' ? { ink: resident.info, soft: resident.infoSoft }
      : key === 'billing' ? { ink: resident.warning, soft: resident.warningSoft }
        : { ink: resident.accentText, soft: resident.accentSoft };
  return { ...tone, label: key ? FAQ_CATEGORY_META[key].label : value, icon: key ? icons[key] : 'help-circle-outline' as const };
}
