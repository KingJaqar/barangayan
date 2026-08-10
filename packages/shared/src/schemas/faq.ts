import { z } from 'zod';

export const FAQ_CATEGORIES = ['general', 'services', 'emergency', 'health', 'billing', 'account'] as const;

export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export const FAQ_CATEGORY_META: Record<FaqCategory, { label: string; color: string; bg: string }> = {
  general:   { label: 'General',    color: '#6B7280', bg: '#F3F4F6' },
  services:  { label: 'Services',   color: '#0F6E5B', bg: '#E6F2EF' },
  emergency: { label: 'Emergency',  color: '#DC2626', bg: '#FEE2E2' },
  health:    { label: 'Health',     color: '#2563EB', bg: '#DBEAFE' },
  billing:   { label: 'Billing',    color: '#D97706', bg: '#FEF3C7' },
  account:   { label: 'Account',    color: '#7C3AED', bg: '#EDE9FE' },
};

export const faqArticleSchema = z.object({
  question:   z.string().min(1, 'Question is required').max(300),
  answer:     z.string().min(1, 'Answer is required').max(2000),
  category:   z.enum(FAQ_CATEGORIES),
  is_active:  z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export type FaqArticleFormValues = z.infer<typeof faqArticleSchema>;
