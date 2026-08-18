import { z } from 'zod';

export const SITE_CONTENT_SECTIONS = ['terms_of_service', 'privacy_policy'] as const;
export type SiteContentSection = (typeof SITE_CONTENT_SECTIONS)[number];

export const SITE_CONTENT_SECTION_META: Record<SiteContentSection, { label: string }> = {
  terms_of_service: { label: 'Terms of Service' },
  privacy_policy: { label: 'Privacy Policy' },
};

export const siteContentSchema = z.object({
  section: z.enum(SITE_CONTENT_SECTIONS),
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().min(1, 'Content is required').max(5000),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export type SiteContentFormValues = z.infer<typeof siteContentSchema>;
