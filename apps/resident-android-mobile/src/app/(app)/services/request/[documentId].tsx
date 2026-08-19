import { formatCentavosAsPHP, requestFormSchema, type Tables } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { AnimatedAppear } from '@/components/services/animated-appear';
import { SkeletonBlock } from '@/components/services/skeleton';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import {
  displayName,
  imageExtension,
  isWithinSizeLimit,
  pickImageAsset,
  readImageBytes,
  type PickedImage,
} from '@/lib/image-upload';
import { supabase } from '@/lib/supabase';

type DocumentType = Tables<'document_types'>;

const MAX_ID_BYTES = 5 * 1024 * 1024;

function Chip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.chip, styles.hairline]}>
      <Ionicons name={icon} size={14} color={theme.textSecondary} />
      <ThemedText type="small">{label}</ThemedText>
    </ThemedView>
  );
}

/** Shimmer stand-in for the loading state, shaped like the form below it. Rendered only
 * while `doc === undefined` — same early-return slot `PlaceholderPanel` used to occupy. */
function RequestFormSkeleton() {
  const theme = useTheme();
  return (
    <View style={[styles.skeletonContainer, { backgroundColor: theme.background }]}>
      <SkeletonBlock width="100%" height={96} borderRadius={Spacing.three} />
      <SkeletonBlock width="100%" height={80} borderRadius={Spacing.three} style={styles.skeletonBlockGap} />
      <SkeletonBlock width="100%" height={64} borderRadius={Spacing.three} style={styles.skeletonBlockGap} />
      <SkeletonBlock width="100%" height={140} borderRadius={Spacing.three} style={styles.skeletonBlockGap} />
    </View>
  );
}

export default function RequestFormScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { profile } = useProfile();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [doc, setDoc] = useState<DocumentType | null | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [pickedIdImage, setPickedIdImage] = useState<PickedImage | null>(null);
  const [idUploadError, setIdUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('document_types').select('*').eq('id', documentId).single().then(({ data }) => setDoc(data));
  }, [documentId]);

  async function handlePickFile() {
    const picked = await pickImageAsset();
    if (!picked) return;

    if (!picked.mimeType.startsWith('image/')) {
      setIdUploadError('Please choose a JPG or PNG image of your valid ID.');
      return;
    }
    if (!isWithinSizeLimit(picked, MAX_ID_BYTES)) {
      setIdUploadError('Your ID image must be 5MB or smaller.');
      return;
    }

    setIdUploadError(null);
    setPickedIdImage(picked);
  }

  // S0-8: uploads the picked ID image to Storage *before* the service_requests insert
  // and returns its path. Must happen first — residents have no UPDATE/DELETE policy on
  // service_requests (see 0002's "no client update/delete policy" comment), so there's
  // no way to patch the path in after the fact or roll back a row left without one.
  async function uploadIdDocument(userId: string): Promise<{ path: string | null; error: string | null }> {
    if (!pickedIdImage) return { path: null, error: null };

    const ext = imageExtension(pickedIdImage.mimeType);
    const folderId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const path = `${userId}/${folderId}/id.${ext}`;

    try {
      const bytes = await readImageBytes(pickedIdImage);
      const { error: uploadError } = await supabase.storage
        .from('id-documents')
        .upload(path, bytes, { contentType: pickedIdImage.mimeType, upsert: false });
      if (uploadError) {
        return { path: null, error: uploadError.message };
      }
      return { path, error: null };
    } catch (readError) {
      return { path: null, error: (readError as Error).message };
    }
  }

  async function handleSubmit() {
    if (!doc || !session) return;
    setError(null);

    const result = requestFormSchema.safeParse({
      documentTypeId: doc.id,
      requesterNotes: notes || undefined,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);

    const { path: idDocumentPath, error: uploadError } = await uploadIdDocument(session.user.id);
    if (uploadError) {
      setSubmitting(false);
      setError(uploadError);
      return;
    }

    const { data, error: insertError } = await supabase
      .from('service_requests')
      .insert({
        barangay_id: doc.barangay_id,
        resident_id: session.user.id,
        document_type_id: doc.id,
        requester_notes: result.data.requesterNotes ?? null,
        id_document_path: idDocumentPath,
      })
      .select()
      .single();
    setSubmitting(false);

    if (insertError || !data) {
      setError(insertError?.message ?? 'Could not submit request.');
      return;
    }

    router.replace(`/services/payment/${data.id}`);
  }

  if (doc === undefined) {
    return <RequestFormSkeleton />;
  }
  if (doc === null) {
    return <PlaceholderPanel label="Document not found." />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
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
              Request Form
            </ThemedText>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView type="backgroundElement" style={[styles.section, styles.shadowSm, styles.hairline]}>
            <ThemedText type="small" style={{ color: theme.primary }}>
              Purpose of Request
            </ThemedText>
            <TextField
              placeholder="e.g. Employment requirement"
              value={notes}
              onChangeText={setNotes}
              multiline
            />

          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.section, styles.shadowSm, styles.hairline]}>
            <View style={styles.rowBetween}>
              <ThemedText type="small" style={styles.sectionLabel} themeColor="textSecondary">
                Resident Details
              </ThemedText>
              <ThemedText type="link" onPress={() => router.push('/settings/profile')}>
                Edit in Profile
              </ThemedText>
            </View>
            <View style={styles.chipRow}>
              <Chip icon="person-outline" label={profile?.full_name ?? '—'} />
              <Chip icon="call-outline" label={profile?.mobile_number ?? 'No mobile number on file'} />
            </View>
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.noticeCard, styles.shadowSm, styles.hairline]}>
            <Ionicons name="storefront-outline" size={18} color={theme.primary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
              You&apos;ll pick up this document in person at the Barangay Hall once it&apos;s ready.
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.section, styles.shadowSm, styles.hairline]}>
            <ThemedText type="small">Valid ID Upload</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Please upload a clear copy of a government-issued ID.
            </ThemedText>

            {pickedIdImage ? (
              <AnimatedAppear style={styles.idPreview}>
                <ThemedText type="smallBold">Uploaded ID preview</ThemedText>
                <Image source={{ uri: pickedIdImage.uri }} style={styles.idPreviewImage} contentFit="contain" />
                <View style={styles.idPreviewFooter}>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.fileName}>
                    {displayName(pickedIdImage)}
                  </ThemedText>
                </View>
                <PrimaryButton label="Upload Again" variant="secondary" onPress={handlePickFile} />
              </AnimatedAppear>
            ) : (
              <AnimatedAppear>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Upload a valid ID image"
                  onPress={handlePickFile}
                  style={({ pressed }) => [pressed && styles.dropZonePressed]}>
                  <View style={[styles.dropZone, { borderColor: theme.backgroundSelected }]}>
                    <Ionicons name="cloud-upload-outline" size={32} color={theme.textSecondary} />
                    <ThemedText type="smallBold">Tap to upload your ID image</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      JPG or PNG up to 5MB
                    </ThemedText>
                  </View>
                </Pressable>
              </AnimatedAppear>
            )}
            {idUploadError ? (
              <AnimatedAppear>
                <ThemedText type="small" themeColor="accentRed">
                  {idUploadError}
                </ThemedText>
              </AnimatedAppear>
            ) : null}
          </ThemedView>

          {error ? (
            <ThemedText type="small" themeColor="accentRed">
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.feeRow}>
            <ThemedText type="small">Processing Fee</ThemedText>
            <ThemedText type="smallBold">
              {doc.fee_centavos === 0 ? 'Free' : formatCentavosAsPHP(doc.fee_centavos)}
            </ThemedText>
          </View>
          <PrimaryButton label="Proceed to Payment →" loading={submitting} onPress={handleSubmit} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  root: { flex: 1 },
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
  },

  /* Design-system recipes (shared literally across the Services screens) */
  shadowSm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  hairline: {
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.25)',
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },

  section: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  noticeText: {
    flex: 1,
  },
  dropZone: {
    marginTop: Spacing.two,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.five,
    alignItems: 'center',
    gap: Spacing.one,
  },
  dropZonePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  idPreview: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  idPreviewImage: {
    width: '100%',
    height: 220,
    borderRadius: Spacing.three,
  },
  idPreviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  fileName: {
    flex: 1,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  footer: {
    padding: Spacing.four,
  },

  /* Loading skeleton */
  skeletonContainer: {
    flex: 1,
    padding: Spacing.four,
  },
  skeletonBlockGap: {
    marginTop: Spacing.three,
  },
});
