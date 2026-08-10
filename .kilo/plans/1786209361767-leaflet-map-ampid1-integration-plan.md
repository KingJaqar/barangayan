# Leaflet Map Integration Plan: Ampid 1, San Mateo Boundary in Emergency/DRRM Screen

## Overview
Integrate a Leaflet map view focused on Barangay Ampid I, San Mateo with a GeoJSON boundary overlay into the "Centers" tab of the Emergency & DRRM Info screen. The map will display evacuation centers and the barangay boundary from the provided GeoJSON file.

## Current State Analysis

### Existing Components
1. **EmergencyInfoScreen** (`apps/mobile/src/app/(app)/home/emergency-info/index.tsx`)
   - Has a "Centers" tab with list/map segmented control
   - Currently only shows list view (`CentersContent` component)
   - Map view is not implemented in the "Centers" tab

2. **MapView Component** (`apps/mobile/src/components/map-view.tsx`)
   - Fully functional Leaflet map in WebView
   - Supports markers, boundaries, and custom center points
   - Already used in the dedicated Maps screen (`apps/mobile/src/app/(app)/maps/index.tsx`)
   - Handles GeoJSON boundary rendering with red outline

3. **GeoJSON Data** (`apps/mobile/SanMateo_Ampid1_GEOjson.geojson`)
   - Contains FeatureCollection with Polygon geometry for Ampid I boundary
   - Properties include name, municipality, province

### Key Differences Between Screens
- **Maps Screen**: Full-screen map with floating controls, bottom panel for DRRM cards
- **Emergency Info Screen**: Tabbed interface with scrollable content, "Centers" tab has list/map toggle

## Implementation Plan

### Phase 1: Prepare GeoJSON Data
**Task 1.1**: Move GeoJSON file to appropriate location
- Copy `SanMateo_Ampid1_GEOjson.geojson` to `apps/mobile/src/assets/geojson/ampid1-boundary.geojson`
- Update import path in components

**Task 1.2**: Create boundary data hook
- Create `useAmpid1Boundary` hook in `apps/mobile/src/hooks/use-ampid1-boundary.ts`
- Load and parse GeoJSON file
- Return parsed Polygon geometry for MapView boundary prop

### Phase 2: Enhance CentersContent Component
**Task 2.1**: Import required dependencies
- Import `MapView` and `AMPID_I_SAN_MATEO_CENTER` from `@/components/map-view`
- Import `useAmpid1Boundary` hook
- Import `LatLng` type from `@barangayan/shared`

**Task 2.2**: Add map view state and logic
- Add boundary state from hook
- Convert evacuation centers to MapMarker format
- Handle map view rendering when `view === 'map'`

**Task 2.3**: Implement map marker conversion
- Transform evacuation center data to MapMarker array
- Include center name as label
- Use 'evacuation-center' as kind for consistent styling

### Phase 3: Update CentersContent Render Logic
**Task 3.1**: Conditional rendering based on view mode
- Show list view when `view === 'list'` (existing)
- Show MapView when `view === 'map'` (new)
- Ensure proper styling and sizing for map container

**Task 3.2**: Map container styling
- Fixed height for map view (e.g., 400px)
- Proper border radius and overflow handling
- Loading and error states

### Phase 4: Integration Testing
**Task 4.1**: Verify map displays correctly
- Boundary outline visible in red
- Evacuation center markers displayed
- Map centered on Ampid I by default

**Task 4.2**: Test interactions
- Segmented control switching between list/map
- Marker tap handling (if needed)
- Map recentering on "Maps" button press (if implemented)

## Technical Details

### Data Flow
```
GeoJSON File → useAmpid1Boundary hook → boundary prop → MapView → Leaflet WebView
Evacuation Centers → MapMarker conversion → markers prop → MapView → Leaflet WebView
```

### MapView Props for Emergency Info Screen
```typescript
<MapView
  markers={evacuationMarkers}
  center={AMPID_I_SAN_MATEO_CENTER}
  boundary={ampid1Boundary}
  kindColors={{ 'evacuation-center': '#F59E0B' }} // Amber color for evacuation centers
  style={{ height: 400, borderRadius: 16, overflow: 'hidden' }}
/>
```

### Evacuation Center to MapMarker Conversion
```typescript
const evacuationMarkers: MapMarker[] = centers.map(center => ({
  id: center.id,
  position: { lat: center.latitude, lng: center.longitude },
  kind: 'evacuation-center',
  label: center.name
}));
```

## File Changes Summary

### New Files
1. `apps/mobile/src/assets/geojson/ampid1-boundary.geojson` (copied from root)
2. `apps/mobile/src/hooks/use-ampid1-boundary.ts` (new hook)

### Modified Files
1. `apps/mobile/src/app/(app)/home/emergency-info/index.tsx`
   - Enhanced `CentersContent` component with map view implementation

### Unchanged Files (Reused)
1. `apps/mobile/src/components/map-view.tsx` (existing MapView component)
2. `apps/mobile/packages/shared/src/types/map-bridge.ts` (existing types)

## Dependencies
- No new dependencies required
- Uses existing: `react-native-webview`, `leaflet` (via CDN in WebView)
- Uses existing hooks: `useEvacuationCenters`, `useTheme`

## Validation Criteria
1. ✅ Map displays in "Centers" tab when "Map" segment is selected
2. ✅ Red boundary outline of Ampid I visible on map
3. ✅ Evacuation centers shown as markers on map
4. ✅ Map centered on Ampid I by default (14.680291, 121.1187445)
5. ✅ Smooth switching between List and Map views
6. ✅ Proper styling consistent with app theme
7. ✅ Loading states work correctly
8. ✅ No console errors or warnings

## Risks & Mitigations

### Risk 1: WebView Performance in ScrollView
**Mitigation**: Use fixed height for MapView, disable scroll on WebView (`scrollEnabled={false}`)

### Risk 2: GeoJSON Loading Failure
**Mitigation**: Add error boundary/fallback in hook, show boundary-less map if load fails

### Risk 3: Memory Leaks with WebView
**Mitigation**: Ensure proper cleanup in useEffect dependencies, use refs for WebView instance

### Risk 4: Coordinate System Mismatch
**Mitigation**: Verify GeoJSON coordinates are in WGS84 (EPSG:4326) - Leaflet standard

## Out of Scope
- Routing/navigation features (DRAW_ROUTE/CLEAR_ROUTE)
- User location tracking in this screen (handled in dedicated Maps screen)
- Offline map tile caching
- Clustering for high-density markers
- Custom marker icons beyond color differentiation

## Implementation Order
1. Copy GeoJSON to assets folder
2. Create boundary hook
3. Modify CentersContent component
4. Test integration
5. Validate all acceptance criteria

## Estimated Effort
- Phase 1: 30 minutes
- Phase 2: 60 minutes
- Phase 3: 45 minutes
- Phase 4: 30 minutes
- **Total: ~2.75 hours**