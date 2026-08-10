import type { Polygon } from 'geojson';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const BOUNDARY_ASSET = require('@/assets/geojson/ampid1-boundary.json') as {
  type: string;
  features: Array<{
    type: string;
    geometry: { type: string; coordinates: number[][][] };
  }>;
};

export function useAmpid1Boundary(): Polygon | null {
  return BOUNDARY_ASSET.features?.[0]?.geometry?.type === 'Polygon'
    ? (BOUNDARY_ASSET.features[0].geometry as Polygon)
    : null;
}
