import { qrStepItemSchema } from '@barangayan/shared';
import type { z } from 'zod';
import type { emergencyQrContentRow } from '../../data/schemas';
import { safeColor } from '../emergency/content';

export type QrContentRow = z.infer<typeof emergencyQrContentRow>;
export type GuideStep = { step: number; title: string; desc: string };
export type GuideCard = { title: string; body: string; icon: string; color: string | null; background: string | null };
export type GuideSteps = { title: string; body: string; steps: GuideStep[] };
export type QrGuide = { why: GuideCard | null; how: GuideSteps | null };

const byOrder = (a: QrContentRow, b: QrContentRow) => a.sort_order - b.sort_order || a.id.localeCompare(b.id);

/** Steps an operator wrote; a step missing its number, title or text is dropped, never invented, and the rest keep their order. */
export function stepsFrom(content: unknown): GuideStep[] {
  if (!Array.isArray(content)) return [];
  return content.flatMap((entry): GuideStep[] => {
    const parsed = qrStepItemSchema.safeParse(entry);
    if (!parsed.success) return [];
    const title = parsed.data.title.trim();
    const desc = parsed.data.desc.trim();
    return title && desc ? [{ step: parsed.data.step, title, desc }] : [];
  }).sort((a, b) => a.step - b.step);
}

/** The "why scan" card and the "how it works" steps: the first published row of each section. */
export function guideFrom(rows: readonly QrContentRow[]): QrGuide {
  const ordered = [...rows].sort(byOrder);
  const why = ordered.find((row) => row.section === 'why_scan');
  const how = ordered.find((row) => row.section === 'how_it_works');
  return {
    why: why ? { title: why.title.trim(), body: why.body.trim(), icon: why.icon ?? 'qr-code-outline', color: safeColor(why.icon_color ?? ''), background: safeColor(why.icon_bg ?? '') } : null,
    how: how ? { title: how.title.trim(), body: how.body.trim(), steps: stepsFrom(how.content) } : null,
  };
}

/**
 * Built-in guidance, shown only when the barangay has published none and no saved copy exists. It is written for this app: a check-in
 * counts only when the app says the server confirmed it, which the Android fallback ("automatically recorded") does not promise.
 */
export const SEED_QR_GUIDE: QrGuide = {
  why: {
    title: 'Why scan a QR code?', icon: 'qr-code-outline', color: null, background: null,
    body: 'Scanning the barangay’s check-in code at an evacuation center lets the barangay record that you arrived, so responders can account for residents.',
  },
  how: {
    title: 'How it works',
    body: 'Follow these steps to check in at an evacuation center.',
    steps: [
      { step: 1, title: 'Open the scanner', desc: 'Choose Scan QR on this screen and allow camera access when asked.' },
      { step: 2, title: 'Scan the center’s code', desc: 'Point your camera at the QR code displayed at the evacuation center.' },
      { step: 3, title: 'Wait for confirmation', desc: 'Your check-in counts only when the app says it was confirmed. If it cannot confirm it, try again when your connection is back, or ask center staff.' },
    ],
  },
};
