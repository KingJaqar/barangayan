export const ANNOUNCEMENT_CATEGORY_META = {
  general:   { label: 'General',   color: '#1565C0', icon: 'information-circle-outline' },
  emergency: { label: 'Emergency', color: '#93000A', icon: 'warning-outline'            },
  health:    { label: 'Health',    color: '#0F6E5B', icon: 'heart-outline'              },
  events:    { label: 'Events',    color: '#B45309', icon: 'calendar-outline'           },
} as const;

export type AnnouncementCategory = keyof typeof ANNOUNCEMENT_CATEGORY_META;
export const ANNOUNCEMENT_CATEGORIES = Object.keys(ANNOUNCEMENT_CATEGORY_META) as AnnouncementCategory[];
