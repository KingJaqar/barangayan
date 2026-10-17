import { z } from 'zod';
import { EMERGENCY_QR_POLICY } from '../../data/public-cache';
import { emergencyQrContentRow } from '../../data/schemas';
import { useApi } from '../../data/use-api';
import { usePublicResource } from '../../data/use-public-resource';
import { guideFrom, SEED_QR_GUIDE } from './guide';

const rows = z.array(emergencyQrContentRow);

/**
 * QR check-in guidance from the barangay's published content with an offline copy. The built-in guide is used only when the barangay
 * has published none (or it could not be loaded and nothing is saved), and `bundled` says so, so the screen can label it.
 */
export function useQrGuide() {
  const api = useApi();
  const resource = usePublicResource('emergency-qr-content', api.emergencyQrContent, rows, EMERGENCY_QR_POLICY);
  const settled = !resource.loading || resource.data !== undefined;
  const published = guideFrom(resource.data ?? []);
  const nothing = published.why === null && published.how === null;
  return { resource, settled, guide: nothing && settled ? SEED_QR_GUIDE : published, bundled: nothing && settled };
}
