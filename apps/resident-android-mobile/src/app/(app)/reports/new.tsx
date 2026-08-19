/**
 * Submit Incident Report screen — reached by tapping the FAB on My Incident Reports.
 *
 * Flow (mirrors the service_request form pattern from request/[documentId].tsx):
 *   1. Resident picks category, writes title + description, optionally attaches photos.
 *   2. Photos are uploaded to the `incident-photos` Storage bucket BEFORE the DB row is
 *      created, because residents have no UPDATE policy on incidents (same constraint as
 *      id-documents on service_requests). Uploaded paths are public URLs.
 *   3. Location defaults to the barangay polygon centroid (Phase 2 will add an
 *      interactive map picker; for MVP this lets the form be fully functional without a
 *      full embedded map).
 *   4. On success the user is replaced back to the Reports index so the new card
 *      appears immediately (Realtime subscription on useMyIncidents fires).
 */
import { Ionicons } from '@expo/vector-icons';
import { incidentReportSchema, reverseGeocode } from '@barangayan/shared';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import type { MultiPolygon, Polygon } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/reports/fade-in-view';
import { FeedbackModal } from '@/components/reports/feedback-modal';
import { LocationPickerModal } from '@/components/reports/location-picker-modal';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useIncidentCategories } from '@/hooks/use-incident-categories';
import { useProfile } from '@/hooks/use-profile';
import { useWasteZones } from '@/hooks/use-waste-zones';
import { useTheme } from '@/hooks/use-theme';
import {
  type PickedImage,
  imageExtension,
  isWithinSizeLimit,
  pickImageAsset,
  readImageBytes,
} from '@/lib/image-upload';
import { supabase } from '@/lib/supabase';

/** Matches the `incident-photos` bucket's file_size_limit (migration 0025). */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute the arithmetic centroid of a GeoJSON Polygon's outer ring. */
function polygonCentroid(boundary: unknown): { lat: number; lng: number } | null {
  const coords = (boundary as { coordinates?: [number, number][][] } | null)
    ?.coordinates?.[0];
  if (!Array.isArray(coords) || coords.length === 0) return null;
  const sum = coords.reduce(
    (acc, pt) => ({ lng: acc.lng + pt[0], lat: acc.lat + pt[1] }),
    { lng: 0, lat: 0 },
  );
  return { lat: sum.lat / coords.length, lng: sum.lng / coords.length };
}

// ─── Photo thumbnail ──────────────────────────────────────────────────────────

function PhotoThumb({
  uri,
  onRemove,
}: {
  uri: string;
  onRemove: () => void;
}) {
  return (
    <View style={photoStyles.wrap}>
      <Image source={{ uri }} style={photoStyles.img} contentFit="cover" />
      <Pressable
        style={({ pressed }) => [photoStyles.remove, pressed && photoStyles.removePressed]}
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel="Remove photo"
        hitSlop={Spacing.one}>
        <Ionicons name="close-circle" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

const photoStyles = StyleSheet.create({
  wrap: {
    position: 'relative',
    width: 80,
    height: 80,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  img:  { width: 80, height: 80, borderRadius: 12 },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(15,23,42,0.65)',
    borderRadius: 10,
  },
  removePressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
});

// ─── Category picker ──────────────────────────────────────────────────────────

function CategoryPicker({
  categories,
  selectedId,
  onSelect,
}: {
  categories: { id: string; name: string; color: string; icon: string | null }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={catStyles.row}>
      {categories.map((cat) => {
        const active = cat.id === selectedId;
        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              catStyles.chip,
              active
                ? { backgroundColor: cat.color }
                : { borderWidth: 1.5, borderColor: cat.color },
              pressed && catStyles.chipPressed,
            ]}>
            {cat.icon ? (
              <Ionicons
                name={cat.icon as keyof typeof Ionicons.glyphMap}
                size={14}
                color={active ? '#fff' : cat.color}
              />
            ) : null}
            <ThemedText
              type="small"
              style={{ color: active ? '#fff' : cat.color, fontWeight: '700' }}>
              {cat.name}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const catStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingBottom: Spacing.one },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NewIncidentScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { profile } = useProfile();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const barangayId = profile?.barangay_id ?? null;
  const { categories, isLoading: catsLoading } = useIncidentCategories(barangayId);
  const { zones } = useWasteZones(barangayId);
  // The resident's barangay boundary — passed to the location picker so residents can
  // only pin a spot inside it (mirrors the Maps tab / registration geofencing pattern).
  const boundary = (profile?.barangays?.boundary as Polygon | MultiPolygon | null) ?? null;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState('Detecting location…');
  // Reverse-geocoded (or resident-corrected, via the picker) address for `location`.
  const [address, setAddress] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  const [specificAreaDetails, setSpecificAreaDetails] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // ── Location: try GPS first, fall back to barangay centroid ──────────────
  const locationResolved = useRef(false);

  useEffect(() => {
    if (locationResolved.current) return;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationLabel('Using your current GPS location');
          locationResolved.current = true;
          return;
        }
      } catch {
        // GPS failed — fall through to centroid
      }

      // Centroid from boundary (set after profile loads)
      if (profile?.barangays?.boundary) {
        const centroid = polygonCentroid(profile.barangays.boundary);
        if (centroid) {
          setLocation(centroid);
          setLocationLabel(`Using ${profile.barangays.name ?? 'barangay'} centre (GPS unavailable)`);
          locationResolved.current = true;
          return;
        }
      }

      setLocationLabel('Location unavailable — please enable GPS');
    })();
  }, [profile]);

  // When profile loads after the effect ran, resolve centroid if GPS was denied.
  useEffect(() => {
    if (locationResolved.current) return;
    if (!profile?.barangays?.boundary) return;
    const centroid = polygonCentroid(profile.barangays.boundary);
    if (!centroid) return;
    setLocation(centroid);
    setLocationLabel(`Using ${profile.barangays.name ?? 'barangay'} centre (GPS unavailable)`);
    locationResolved.current = true;
  }, [profile]);

  // Auto-fetch a human-readable address for whatever location is currently set, as long
  // as one isn't already known — the location picker supplies its own address directly
  // (possibly resident-corrected), so this only fires for the initial GPS/centroid fix
  // and retries if that fetch failed (address stays '').
  useEffect(() => {
    if (!location || address) return;
    let cancelled = false;
    setAddressLoading(true);
    reverseGeocode(location).then((result) => {
      if (cancelled) return;
      setAddressLoading(false);
      if (result) setAddress(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // ── Photo picker ──────────────────────────────────────────────────────────
  async function handlePickPhoto() {
    if (photos.length >= 5) {
      Alert.alert('Limit reached', 'You can attach up to 5 photos per report.');
      return;
    }

    const picked = await pickImageAsset();
    if (!picked) return;

    if (!picked.mimeType.startsWith('image/')) {
      setError('Please choose a JPG, PNG, or WebP image.');
      return;
    }
    if (!isWithinSizeLimit(picked, MAX_PHOTO_BYTES)) {
      setError('Each photo must be 10 MB or smaller.');
      return;
    }

    setError(null);
    setPhotos((prev) => [...prev, picked]);
  }

  // ── Upload a single photo, return its storage path + public URL ────────────
  async function uploadPhoto(userId: string, photo: PickedImage): Promise<{ path: string; url: string }> {
    const prefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `${userId}/${prefix}/photo.${imageExtension(photo.mimeType)}`;

    const bytes = await readImageBytes(photo);

    const { error: uploadErr } = await supabase.storage
      .from('incident-photos')
      .upload(path, bytes, { contentType: photo.mimeType, upsert: false });

    if (uploadErr) throw new Error(uploadErr.message);

    const { data } = supabase.storage.from('incident-photos').getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!session || !barangayId) return;
    setError(null);

    // Validate form
    const parsed = incidentReportSchema.safeParse({
      title,
      categoryId: categoryId ?? '',
      description: description || undefined,
      photoUrls: [],         // photos aren't URLs yet — validated count separately
      location: location ?? { lat: 0, lng: 0 },
      address: address || undefined,
      specificAreaDetails: specificAreaDetails || undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please fill in all required fields.');
      return;
    }
    if (!categoryId) {
      setError('Please select an incident category.');
      return;
    }
    if (!location) {
      setError('Location is required. Please enable GPS or wait for barangay centre to load.');
      return;
    }

    setSubmitting(true);

    // Upload photos first (no resident UPDATE policy on incidents).
    let uploaded: { path: string; url: string }[] = [];
    try {
      uploaded = await Promise.all(
        photos.map((p) => uploadPhoto(session.user.id, p)),
      );
    } catch (uploadErr) {
      setSubmitting(false);
      setError(`Photo upload failed: ${(uploadErr as Error).message}`);
      return;
    }
    const photoUrls = uploaded.map((u) => u.url);

    // Insert incident row.
    const { error: insertErr } = await supabase.from('incidents').insert({
      barangay_id:  barangayId,
      reporter_id:  session.user.id,
      category_id:  categoryId,
      zone_id:      zoneId,
      title:        title.trim(),
      description:  description.trim() || null,
      photo_urls:   photoUrls,
      location:     location,
      address:      address.trim() || null,
      specific_area_details: specificAreaDetails.trim() || null,
      status:       'open',
    });

    setSubmitting(false);

    if (insertErr) {
      // Roll back the freshly uploaded photos since the DB write failed —
      // otherwise they're orphaned in storage forever, owned by no incident.
      if (uploaded.length) {
        await supabase.storage.from('incident-photos').remove(uploaded.map((u) => u.path));
      }
      setError(insertErr.message);
      return;
    }

    // Success — surface the centered confirmation; navigation happens once it's
    // dismissed (see handleSuccessDismiss). Realtime will update the list.
    setSubmitted(true);
  }

  /** Fires once the success pop-up is dismissed (auto or manual) — returns the resident
   * to the Reports index, same destination `handleSubmit` used to navigate to directly. */
  function handleSuccessDismiss() {
    setSubmitted(false);
    router.replace('/(app)/reports');
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={Spacing.two}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
        <View style={styles.headerContent}>
          <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>
            Report an Incident
          </ThemedText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Category ── */}
        <View>
        <ThemedView type="backgroundElement" style={[styles.section, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="small" style={[styles.sectionLabel, { color: theme.primary }]}>
            Category *
          </ThemedText>
          {catsLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <CategoryPicker
              categories={categories}
              selectedId={categoryId}
              onSelect={setCategoryId}
            />
          )}
        </ThemedView>
        </View>

        {/* ── Zone (trash/dumping reports only) ── */}
        {categories.find((c) => c.id === categoryId)?.is_trash_related && zones.length > 0 && (
          <FadeInView>
          <ThemedView type="backgroundElement" style={[styles.section, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="small" style={[styles.sectionLabel, { color: theme.primary }]}>
              Collection Zone
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Which zone is this in? Helps the barangay track dumping hotspots.
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={catStyles.row}>
              {zones.map((zone) => {
                const active = zoneId === zone.id;
                return (
                  <Pressable
                    key={zone.id}
                    onPress={() => setZoneId(active ? null : zone.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      catStyles.chip,
                      active
                        ? { backgroundColor: theme.primary }
                        : { borderWidth: 1.5, borderColor: theme.primary },
                      pressed && catStyles.chipPressed,
                    ]}>
                    <ThemedText type="small" style={{ color: active ? theme.onPrimary : theme.primary, fontWeight: '700' }}>
                      {zone.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </ThemedView>
          </FadeInView>
        )}

        {/* ── Title ── */}
        <View>
        <ThemedView type="backgroundElement" style={[styles.section, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="small" style={[styles.sectionLabel, { color: theme.primary }]}>
            Title *
          </ThemedText>
          <TextField
            placeholder="e.g. Broken streetlight on Purok 3"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.counter}>
            {title.length}/100
          </ThemedText>
        </ThemedView>
        </View>

        {/* ── Description ── */}
        <View>
        <ThemedView type="backgroundElement" style={[styles.section, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="small" style={[styles.sectionLabel, { color: theme.primary }]}>
            Description
          </ThemedText>
          <TextField
            placeholder="Describe the incident in detail…"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={1000}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.counter}>
            {description.length}/1000
          </ThemedText>
        </ThemedView>
        </View>

        {/* ── Photos ── */}
        <View>
        <ThemedView type="backgroundElement" style={[styles.section, { borderColor: theme.backgroundSelected }]}>
          <View style={styles.row}>
            <ThemedText type="small" style={[styles.sectionLabel, { color: theme.primary }]}>
              Photos
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {photos.length}/5
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Attach up to 5 photos as evidence (JPG, PNG, WebP — max 10 MB each).
          </ThemedText>

          <View style={styles.photoRow}>
            {photos.map((p, i) => (
              <PhotoThumb
                key={`${p.name}-${i}`}
                uri={p.uri}
                onRemove={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
            {photos.length < 5 && (
              <Pressable
                onPress={handlePickPhoto}
                accessibilityRole="button"
                accessibilityLabel="Add photo"
                style={({ pressed }) => [
                  styles.addPhoto,
                  { borderColor: theme.backgroundSelected },
                  pressed && styles.addPhotoPressed,
                ]}>
                <Ionicons name="camera-outline" size={22} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  Add photo
                </ThemedText>
              </Pressable>
            )}
          </View>
        </ThemedView>
        </View>

        {/* ── Location ── */}
        <View>
        <Pressable
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Pin exact location on map">
          {({ pressed }) => (
          <ThemedView
            type="backgroundElement"
            style={[styles.section, { borderColor: theme.backgroundSelected }, pressed && styles.sectionPressed]}>
            <View style={styles.row}>
              <ThemedText type="small" style={[styles.sectionLabel, { color: theme.primary }]}>
                Location
              </ThemedText>
              <View style={styles.locationEditHint}>
                {addressLoading && <ActivityIndicator size="small" color={theme.primary} />}
                <Ionicons name="create-outline" size={16} color={theme.primary} />
              </View>
            </View>
            <View style={styles.locationRow}>
              <View style={[styles.locationIconWrap, { backgroundColor: location ? `${theme.primary}1A` : theme.backgroundSelected }]}>
                <Ionicons
                  name={location ? 'location-outline' : 'location-sharp'}
                  size={15}
                  color={location ? theme.primary : theme.textSecondary}
                />
              </View>
              <ThemedText type="small" themeColor={location ? undefined : 'textSecondary'} style={styles.locationText}>
                {address || locationLabel}
              </ThemedText>
            </View>
            {location ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.coords}>
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </ThemedText>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary" style={styles.coords}>
              Tap to pin the exact location on the map
            </ThemedText>
          </ThemedView>
          )}
        </Pressable>
        </View>

        {/* ── Specific Area Details ── */}
        <View>
        <ThemedView type="backgroundElement" style={[styles.section, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="small" style={[styles.sectionLabel, { color: theme.primary }]}>
            Specific Area Details
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Add precise details to help find the spot (e.g. near the blue gate, 2nd house from the corner).
          </ThemedText>
          <TextField
            placeholder="e.g. Near the sari-sari store, blue gate"
            value={specificAreaDetails}
            onChangeText={setSpecificAreaDetails}
            maxLength={300}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.counter}>
            {specificAreaDetails.length}/300
          </ThemedText>
        </ThemedView>
        </View>
      </ScrollView>

      <LocationPickerModal
        visible={pickerVisible}
        initialPosition={location}
        initialAddress={address || null}
        boundary={boundary}
        barangayName={profile?.barangays?.name}
        onCancel={() => setPickerVisible(false)}
        onConfirm={({ position, address: pickedAddress }) => {
          setLocation(position);
          setAddress(pickedAddress ?? '');
          setLocationLabel('Pinned on map');
          setPickerVisible(false);
        }}
      />

      {/* ── Footer CTA ── */}
      <ThemedView style={[styles.footer, { borderTopColor: theme.backgroundSelected }]}>
        <PrimaryButton
          label={submitting ? 'Submitting…' : 'Submit Report'}
          loading={submitting}
          onPress={handleSubmit}
        />
      </ThemedView>

      {/* ── Centered feedback pop-ups ── */}
      <FeedbackModal
        visible={submitted}
        kind="success"
        title="Report submitted"
        message="Your incident report has been sent to the barangay."
        onDismiss={handleSuccessDismiss}
        autoDismissMs={1600}
      />
      <FeedbackModal
        visible={!!error}
        kind="error"
        title="Couldn't submit report"
        message={error ?? undefined}
        onDismiss={() => setError(null)}
        autoDismissMs={2800}
      />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  root: { flex: 1 },

  /* Header */
  header: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
    position: 'relative',
  },
  headerContent: {
    height: 25,
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    width: 44, height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontFamily: Fonts.gideonRoman },

  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  section: {
    padding: Spacing.three,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  sectionLabel: {
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 11.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  addPhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  addPhotoPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  locationIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: {
    flex: 1,
  },
  sectionPressed: {
    opacity: 0.85,
  },
  locationEditHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  coords: {
    marginLeft: 36,
    fontSize: 12,
  },
  footer: {
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.backgroundElement,
  },
});
