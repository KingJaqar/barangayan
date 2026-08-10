# Emergency & DRRM Sidebar Section - Implementation Plan

## Goal
Add a new "Emergency & DRRM" navigation section to the web admin sidebar, positioned directly below "Directories & Mapping".

## Current State
- Sidebar defined in `apps/web/src/components/admin/sidebar-nav.tsx`
- `NAV_GROUPS` array contains 4 groups: Overview, Operations, Directories & Mapping, Administration
- Each group has `title` and `items` (href, label, icon, exactMatch)

## Changes Required

### 1. Add Lucide Imports
Add required icons to existing import from `lucide-react`:
- `Building2` (for Hub)
- `MapPin` (for Evacuation Centers - already imported)
- `QrCode` (for Emergency QR)
- `Users` (for Households & Residents - already imported as `UsersRound`)

### 2. Insert New Nav Group
Add new group at index 3 (after "Directories & Mapping", before "Administration"):

```typescript
{
  title: 'Emergency & DRRM',
  items: [
    { href: '/hub', label: 'Hub', icon: Building2 },
    { href: '/evacuation-centers', label: 'Evacuation Centers', icon: MapPin },
    { href: '/emergency-qr', label: 'Emergency QR', icon: QrCode },
    { href: '/households-residents', label: 'Households & Residents', icon: Users },
  ],
}
```

### 3. Update Group Rendering
No changes needed - existing `.map()` renders all groups in order.

## Files to Modify
- `apps/web/src/components/admin/sidebar-nav.tsx`

## Validation
1. Run `npm run lint` (or equivalent) to check for TypeScript/ESLint errors
2. Verify sidebar renders correctly in browser at `/dashboard` (or any admin route)
3. Confirm new section appears between "Directories & Mapping" and "Administration"
4. Verify all 4 links navigate to correct placeholder routes

## Notes
- Routes are placeholders (`/hub`, `/evacuation-centers`, `/emergency-qr`, `/households-residents`) — actual pages to be implemented separately
- Icons selected per user preference: Building2, MapPin, QrCode, Users
- No changes to collapsed/expanded behavior needed — existing logic handles new items automatically