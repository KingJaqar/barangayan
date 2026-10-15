import { Bell, ClipboardList, Heart, Settings, TriangleAlert } from 'lucide-react';
import type { SearchCategory } from '@/lib/search/types';

/** Match each content destination to the resident web navbar's icon. */
export const SEARCH_ICONS = {
  documents: ClipboardList,
  requests: ClipboardList,
  announcements: Bell,
  health: Heart,
  reports: TriangleAlert,
  help: Settings,
} satisfies Record<SearchCategory, typeof ClipboardList>;
