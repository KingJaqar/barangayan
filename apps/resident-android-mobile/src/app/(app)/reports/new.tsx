import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { ScrollableChevronRow } from '@/components/scrollable-chevron-row';
import { ReportSourceState, useReportTone } from '@/components/reports/report-presentation';
import { ResidentActionGate } from '@/components/resident-action-gate';
/**
 * Submit Incident Report screen — reached by tapping the FAB on My Incident Reports.
 *
 * Flow (mirrors the service_request form pattern from request/[documentId].tsx):
 *   1. Resident picks category, writes title + description, optionally attaches photos.
 *   2. Photos are uploaded to the `incident-photos` Storage bucket BEFORE the DB row is
 *      created, because residents have no UPDATE policy on incidents (same constraint as
 *      id-documents on service_requests). Uploaded paths are public URLs.
 *   3. Location uses the existing GPS/centroid fallback and boundary-constrained picker.
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
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedbackModal } from '@/components/reports/feedback-modal';
import { LocationPickerModal } from '@/components/reports/location-picker-modal';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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
  width,
}: {
  width: number;
  uri: string;
  onRemove: () => void;
}) {
  const { resident } = useTheme();
  return (
    <View style={[photoStyles.wrap, { width, height: width }]}>
      <Image source={{ uri }} style={photoStyles.img} contentFit="cover" />
      <Pressable
        style={({ pressed }) => [photoStyles.remove, { backgroundColor: resident.mediaScrim }, pressed && photoStyles.removePressed]}
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel="Remove photo"
        hitSlop={Spacing.one}>
        <Ionicons name="close-circle" size={20} color={resident.mediaForeground} />
      </Pressable>
    </View>
  );
}

const photoStyles = StyleSheet.create({
  wrap: {
    position: 'relative',
    width: 80,
    height: 80,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  img: { width: '100%', height: '100%', borderRadius: 12 },
  remove: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10,
  },
  removePressed: {
    opacity: 0.7,

  },
});

// ─── Category picker ──────────────────────────────────────────────────────────

function CategoryPicker({
  categories,
  selectedId,
  onSelect,
  disabled,
}: {
  disabled: boolean;
  categories: { id: string; name: string; color: string; icon: string | null }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return <ScrollableChevronRow label="report categories" contentContainerStyle={catStyles.row}>
    {categories.map(cat => <CategoryOption key={cat.id} category={cat} active={selectedId === cat.id} disabled={disabled} onSelect={() => onSelect(cat.id)} />)}
  </ScrollableChevronRow>;
}
function CategoryOption({ category, active, onSelect, disabled }: {
  category: { name: string; color: string; icon: string | null }; active: boolean; onSelect: () => void; disabled: boolean;
}) {
  const { resident } = useTheme();
  const tone = useReportTone(category.color);
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={onSelect}
    style={({ pressed }) => [catStyles.chip, { borderColor: active ? tone.ink : tone.ink + '55', backgroundColor: pressed ? resident.pressed : active ? tone.soft : resident.card }]}>
    <Ionicons name={active ? 'checkmark' : (category.icon ?? 'alert-circle-outline') as keyof typeof Ionicons.glyphMap} size={16} color={tone.ink} accessible={false} />
    <ThemedText style={{ color: resident.text, fontSize: 13.5, lineHeight: 20, fontWeight: '700' }}>{category.name}</ThemedText>
  </Pressable>;
}
const catStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  chip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 100, borderWidth: 2, paddingHorizontal: 14, paddingVertical: 8 },
  chipPressed: { opacity: 0.85 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

function IncidentFormField({ label, value, onChangeText, limit, placeholder, required = false, multiline = false, disabled, helper }: {
  label: string; value: string; onChangeText: (value: string) => void; limit: number; placeholder: string;
  required?: boolean; multiline?: boolean; disabled: boolean; helper?: string;
}) {
  const { resident } = useTheme();
  return <View style={[styles.field, { borderTopColor: resident.border }]}>
    <View style={styles.row}><ThemedText style={[styles.sectionLabel, { color: resident.muted }]}>{label}{required ? <ThemedText style={{ color: resident.danger }}> *</ThemedText> : null}</ThemedText><ThemedText style={{ color: resident.muted, fontSize: 12 }}>{value.length}/{limit}</ThemedText></View>
    <TextField presentation="resident" appearance="requestForm" accessibilityLabel={required ? label + ', required' : label === 'Specific area details' ? 'Specific area details' : label}
      value={value} onChangeText={onChangeText} maxLength={limit} placeholder={placeholder} editable={!disabled} multiline={multiline}
      style={{ backgroundColor: resident.card, borderWidth: 0, borderRadius: 0, padding: 0, paddingHorizontal: 0, paddingVertical: 0, minHeight: multiline ? 64 : 28, fontSize: 15, lineHeight: 21, textAlignVertical: 'top' }} />
    {helper ? <ThemedText style={{ color: resident.muted, fontSize: 12.5, lineHeight: 17 }}>{helper}</ThemedText> : null}
  </View>;
}

export default function NewIncidentScreen() {
  return <ResidentActionGate><NewIncidentScreenContent /></ResidentActionGate>;
}

function NewIncidentScreenContent() {
  const router = useRouter();
  const { session } = useAuth();
  const { profile } = useProfile();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const barangayId = profile?.barangay_id ?? null;
  const { categories, isLoading: catsLoading, error: catsError, retry: retryCategories } = useIncidentCategories(barangayId);
  const { zones, isLoading: zonesLoading, error: zonesError, retry: retryZones } = useWasteZones(barangayId);
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
  const [photoWidth, setPhotoWidth] = useState(72);
  const submitLock = useRef(false);
  const pickerLock = useRef(false);

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
    if (pickerLock.current || submitting) return;
    if (photos.length >= 5) {
      setError('You can attach up to 5 photos per report.');
      return;
    }

    pickerLock.current = true;
    try {
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
    setPhotos((prev) => prev.length < 5 ? [...prev, picked] : prev);
    } catch { setError('The photo could not be opened. Please choose it again.'); }
    finally { pickerLock.current = false; }
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
    if (!session || !barangayId || submitLock.current || submitted) return;
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

    submitLock.current = true;
    setSubmitting(true);
    try {

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
    } catch { setError('Your report could not be submitted. Please try again.'); }
    finally { submitLock.current = false; setSubmitting(false); }
  }

  /** Fires once the success pop-up is dismissed (auto or manual) — returns the resident
   * to the Reports index, same destination `handleSubmit` used to navigate to directly. */
  function handleSuccessDismiss() {
    setSubmitted(false);
    router.replace('/(app)/reports');
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.safeArea, { backgroundColor: theme.resident.card }]}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
      <ServiceScreenHeader title="Report an Incident" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <ThemedText style={[styles.sectionLabel, { color: theme.resident.muted }]}>Category <ThemedText style={{ color: theme.resident.danger }}>*</ThemedText></ThemedText>
          {catsError ? <ReportSourceState message={catsError} retry={retryCategories} /> : !catsLoading && categories.length === 0 ? <ReportSourceState message="No incident categories are available. Contact your barangay." /> : catsLoading ? <ActivityIndicator color={theme.resident.accentText} /> :
            <CategoryPicker disabled={submitting || submitted} categories={categories} selectedId={categoryId} onSelect={setCategoryId} />}
        </View>
        {/* ── Zone (trash/dumping reports only) ── */}
        {categories.find((c) => c.id === categoryId)?.is_trash_related && (
          <View>
          <ThemedView type="backgroundElement" style={[styles.section, { borderColor: theme.resident.border }]}>
            <ThemedText type="small" style={[styles.sectionLabel, { color: theme.resident.text }]}>
              Collection Zone
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Which zone is this in? Helps the barangay track dumping hotspots.
            </ThemedText>
            {zonesError ? <ReportSourceState message={zonesError} retry={retryZones} /> : zonesLoading ? <ThemedText>Loading zones…</ThemedText> : zones.length === 0 ? <ThemedText>No collection zones are available.</ThemedText> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={catStyles.row}>
              {zones.map((zone) => {
                const active = zoneId === zone.id;
                return (
                  <Pressable
                    key={zone.id}
                    disabled={submitting || submitted}
                    onPress={() => setZoneId(active ? null : zone.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      catStyles.chip,
                      active
                        ? { backgroundColor: theme.resident.accent }
                        : { borderWidth: 1.5, borderColor: theme.resident.accentText },
                      pressed && catStyles.chipPressed,
                    ]}>
                    <ThemedText type="small" style={{ color: active ? theme.resident.onAccent : theme.resident.accentText, fontWeight: '700' }}>
                      {zone.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </ThemedView>
          </View>
        )}


        <View style={[styles.panel, { borderColor: theme.resident.border, backgroundColor: theme.resident.card }]}>
          <IncidentFormField label="Title" required limit={100} value={title} onChangeText={setTitle} disabled={submitting || submitted} placeholder="e.g. Broken streetlight on Purok 3" />
          <IncidentFormField label="Description" limit={1000} value={description} onChangeText={setDescription} disabled={submitting || submitted} multiline placeholder="Describe the incident in detail…" />
          <View style={[styles.field, { borderTopColor: theme.resident.border }]}>
            <View style={styles.row}><ThemedText style={[styles.sectionLabel, { color: theme.resident.muted }]}>Photos</ThemedText><ThemedText style={{ color: theme.resident.muted, fontSize: 12 }}>{photos.length}/5</ThemedText></View>
            <ThemedText style={{ color: theme.resident.muted, fontSize: 12.5, lineHeight: 17 }}>Attach up to 5 photos as evidence (JPG, PNG, WebP — max 10 MB each).</ThemedText>
            <View style={styles.photoRow} onLayout={event => { const next = Math.min(72, Math.max(0, (event.nativeEvent.layout.width - 16) / 3)); setPhotoWidth(current => current === next ? current : next); }}>
              {photos.map((photo, index) => <PhotoThumb key={photo.name + index} width={photoWidth} uri={photo.uri} onRemove={() => setPhotos(current => current.filter((_, i) => i !== index))} />)}
              {photos.length < 5 ? <Pressable onPress={handlePickPhoto} disabled={submitting || submitted} accessibilityRole="button" accessibilityLabel="Add photo"
                style={({ pressed }) => [styles.addPhoto, { width: photoWidth, height: photoWidth, borderColor: theme.resident.border }, pressed && styles.addPhotoPressed]}>
                <Ionicons name="camera-outline" size={21} color={theme.resident.muted} /><ThemedText style={{ fontSize: 12, color: theme.resident.muted }}>Add photo</ThemedText>
              </Pressable> : null}
            </View>
          </View>
        </View>
        <View style={[styles.panel, { borderColor: theme.resident.border, backgroundColor: theme.resident.card }]}>
          <Pressable disabled={submitting || submitted} onPress={() => setPickerVisible(true)} accessibilityRole="button" accessibilityLabel="Pin exact location on map"
            style={({ pressed }) => [styles.locationRow, pressed && styles.sectionPressed]}>
            <View style={[styles.locationIconWrap, { backgroundColor: theme.resident.accentSoft }]}><Ionicons name="location-outline" size={21} color={theme.resident.accentText} /></View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={[styles.row, { flexWrap: 'wrap', gap: 4 }]}>
                <ThemedText style={[styles.sectionLabel, { color: theme.resident.muted }]}>Location</ThemedText>
                {location ? <ThemedText style={{ color: theme.resident.muted, fontSize: 12 }}>{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</ThemedText> : null}
              </View>
              <ThemedText style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: theme.resident.text }}>{address || locationLabel}</ThemedText>
              {addressLoading ? <ActivityIndicator size="small" color={theme.resident.accentText} /> : null}
              <ThemedText style={{ fontSize: 13, lineHeight: 18, fontWeight: '700', color: theme.resident.accentText }}>Tap to pin the exact location on the map</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={21} color={theme.resident.muted} />
          </Pressable>
          <IncidentFormField label="Specific area details" limit={300} value={specificAreaDetails} onChangeText={setSpecificAreaDetails} disabled={submitting || submitted} multiline
            placeholder="e.g. Near the sari-sari store, blue gate" helper="Add precise details to help find the spot (e.g. near the blue gate, 2nd house from the corner)." />
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
      <ThemedView style={[styles.footer, { borderTopColor: theme.resident.border, backgroundColor: theme.resident.card, paddingBottom: Math.max(insets.bottom, 16) }]}>
        {error ? <ThemedText accessibilityRole="alert" style={{ color: theme.resident.danger, marginBottom: 8 }}>{error}</ThemedText> : null}
        <PrimaryButton
          presentation="resident"
          disabled={!categoryId || title.length < 3 || !location || submitted || catsLoading || !!catsError}
          appearance="requestForm"
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 }, root: { flex: 1 }, content: { padding: 16, gap: 16, paddingBottom: 32 },
  section: { gap: 8, backgroundColor: 'transparent' }, sectionLabel: { fontSize: 12.5, lineHeight: 18, fontWeight: '700' },
  panel: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  field: { padding: 16, gap: 6, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  addPhoto: { borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: 4 },
  addPhotoPressed: { opacity: 0.7 }, sectionPressed: { opacity: 0.85 },
  locationRow: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  locationIconWrap: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
});
