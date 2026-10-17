import { z } from 'zod';
import { EMERGENCY_CONTENT_POLICY } from '../../data/public-cache';
import { emergencyInformationRow } from '../../data/schemas';
import { useApi } from '../../data/use-api';
import { usePublicResource } from '../../data/use-public-resource';
import { guidelinesFrom, hotlinesFrom, type Guideline, type Hotline } from './content';
import { SEED_GUIDELINES, SEED_HOTLINES } from './seed';

const rows = z.array(emergencyInformationRow);

/**
 * Guidelines and hotlines from one tenant read with an offline copy. Bundled reference content is
 * used only for a category the barangay has not published (or that could not be loaded and has no
 * saved copy), and `bundled` says so, so the screen can label it.
 */
export function useEmergencyContent() {
  const api = useApi();
  const resource = usePublicResource('emergency-information', api.emergencyInformation, rows, EMERGENCY_CONTENT_POLICY);
  const settled = !resource.loading || resource.data !== undefined;
  const live = resource.data ?? [];
  const published = { guidelines: guidelinesFrom(live), hotlines: hotlinesFrom(live) };
  const guidelines: Guideline[] = published.guidelines.length || !settled ? published.guidelines : guidelinesFrom(SEED_GUIDELINES);
  const hotlines: Hotline[] = published.hotlines.length || !settled ? published.hotlines : hotlinesFrom(SEED_HOTLINES);
  return {
    resource, settled, guidelines, hotlines,
    bundled: { guidelines: settled && published.guidelines.length === 0, hotlines: settled && published.hotlines.length === 0 },
  };
}
