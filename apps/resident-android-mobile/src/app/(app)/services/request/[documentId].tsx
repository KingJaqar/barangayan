import { ResidentActionGate } from '@/components/resident-action-gate';
import { catalogContract, residentServiceError, ResidentSubmissionAttempt } from '@barangayan/shared';
import { CharterRequestForm } from '@/components/services/charter-request-form';
import { formatCentavosAsPHP, requestFormSchema, type Tables } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { Card } from '@/components/card';
import { SkeletonBlock } from '@/components/services/skeleton';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { ServiceErrorToast } from '@/components/services/service-error-toast';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getMobileFontFamily } from '@/constants/fonts';
import { useFontPreference } from '@/hooks/use-font-preference';
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
    <ThemedView type="backgroundElement" style={[styles.chip, styles.hairline, { borderColor: theme.backgroundSelected }]}>
      <Ionicons name={icon} size={14} color={theme.textSecondary} />
      <ThemedText type="small" style={{ flexShrink: 1 }}>{label}</ThemedText>
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
  return <ResidentActionGate><RequestFormScreenContent /></ResidentActionGate>;
}

function RequestFormScreenContent() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  return <RequestFormContent key={documentId} />;
}

function RequestFormContent() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { profile } = useProfile();
  const theme = useTheme();
  const { fontId } = useFontPreference();

  const [doc, setDoc] = useState<DocumentType | null | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const legacyPath = useRef<string|null>(null);
  const [attempt] = useState(() => new ResidentSubmissionAttempt());
  const [pickedIdImage, setPickedIdImage] = useState<PickedImage | null>(null);
  const [idUploadError, setIdUploadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string } | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    supabase.from('document_types').select('*').eq('id', documentId).eq('is_active', true).is('deleted_at', null).maybeSingle().then(({ data, error: queryError }) => {
      if (!active) return;
      setLoadError(queryError ? 'Could not load this service. Reconnect and retry.' : null);
      setDoc(data);
    });
    return () => { active = false; };
  }, [documentId, reload]);

  async function handlePickFile() {
    try {
      const picked = await pickImageAsset();
      if (!picked) return;

      if (!picked.mimeType.startsWith('image/')) {
        setIdUploadError('Please choose a JPG or PNG image of your valid ID.');
        setNotice({ message: 'Please choose a JPG or PNG image of your valid ID.' });
        return;
      }
      if (!isWithinSizeLimit(picked, MAX_ID_BYTES)) {
        setIdUploadError('Your ID image must be 5MB or smaller.');
        setNotice({ message: 'Your ID image must be 5 MB or smaller.' });
        return;
      }

      setIdUploadError(null);
      setPickedIdImage(picked); legacyPath.current = null;
    } catch (failure) {
      setNotice({ message: residentServiceError(failure, 'pick') });
    }
  }

  // S0-8: uploads the picked ID image to Storage *before* the service_requests insert
  // and returns its path. Must happen first — residents have no UPDATE/DELETE policy on
  // service_requests (see 0002's "no client update/delete policy" comment), so there's
  // no way to patch the path in after the fact or roll back a row left without one.
  async function uploadIdDocument(userId: string): Promise<{ path: string | null; error: string | null }> {
    if (!pickedIdImage) return { path: null, error: null };

    const ext = imageExtension(pickedIdImage.mimeType);
    const folderId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    legacyPath.current ??= `${userId}/${folderId}/id.${ext}`;
    const path = legacyPath.current;

    try {
      const bytes = await readImageBytes(pickedIdImage);
      const { error: uploadError } = await supabase.storage
        .from('id-documents')
        .upload(path, bytes, { contentType: pickedIdImage.mimeType, upsert: false });
      if (uploadError) {
        const {data:saved}=await supabase.storage.from('id-documents').download(path);
        const existing=saved?new Uint8Array(await saved.arrayBuffer()):null;
        if(!existing || existing.length!==bytes.length || existing.some((v,i)=>v!==bytes[i])) return { path: null, error: residentServiceError(uploadError, 'upload') };
      }
      return { path, error: null };
    } catch (readError) {
      return { path: null, error: residentServiceError(readError, 'upload') };
    }
  }

  async function handleSubmit() {
    if (busy.current || !doc || !session) return;
    dismissNotice();
    if (!profile) {
      setNotice({ message: residentServiceError(new Error('authentication_required')) });
      return;
    }

    const result = requestFormSchema.safeParse({
      documentTypeId: doc.id,
      requesterNotes: notes || undefined,
    });
    if (!result.success) {
      setNotice({ message: 'Keep the purpose of your request within 1,000 characters.' });
      return;
    }

    busy.current = true;
    setSubmitting(true);

    const { path: idDocumentPath, error: uploadError } = await uploadIdDocument(session.user.id);
    if (uploadError) {
      busy.current = false;
      setSubmitting(false);
      setNotice({ message: uploadError });
      return;
    }

    try {
      const data = await attempt.submit(supabase, { documentTypeId: doc.id, purposeCode: 'legacy', requesterNotes: result.data.requesterNotes, legacyIdPath: idDocumentPath ?? undefined, details: {}, attachments: [] });
      router.replace(`/services/payment/${data.id}`);
    } catch (failure) { setNotice({ message: residentServiceError(failure) }); }
    finally { busy.current = false; setSubmitting(false); }
  }

  if (loadError) return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}><View style={{ padding: 20, gap: 16 }}><ThemedText accessibilityRole="alert">{loadError}</ThemedText><PrimaryButton label="Retry loading service" onPress={() => { setLoadError(null); setDoc(undefined); setReload(value => value + 1); }}/><PrimaryButton label="Back to Services" variant="secondary" onPress={() => router.replace('/services')}/></View></SafeAreaView>;
  if (doc === undefined) {
    return <RequestFormSkeleton />;
  }
  if (doc === null) {
    return <PlaceholderPanel label="Document not found." />;
  }

  if (catalogContract(doc)) return <CharterRequestForm key={doc.id} doc={doc}/>;

  const FormContainer = Platform.OS === 'android' ? KeyboardAvoidingView : View;
  const keyboardProps = Platform.OS === 'android' ? { behavior: 'height' as const } : {};

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.resident.card }]}>
      <FormContainer {...keyboardProps} style={[styles.root, { backgroundColor: theme.background }]}>
        <ServiceScreenHeader presentation="resident" title="Request Document" backLabel="Back to document" compact />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText accessibilityRole="header" style={styles.title}>{doc.name}</ThemedText>
          <Card variant="resident" style={styles.section}>
            <ThemedText type="smallBold">
              Purpose of Request
            </ThemedText>
            <TextField
              presentation="resident"
              accessibilityLabel="Purpose of Request"
              editable={!submitting}
              placeholder="e.g. Employment requirement"
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={1000}
              style={{ minHeight: 64, fontFamily: getMobileFontFamily(fontId) }}
            />

          </Card>

          <Card variant="resident" style={styles.section}>
            <View style={styles.rowBetween}>
              <ThemedText type="smallBold">
                Resident Details
              </ThemedText>
              <PrimaryButton presentation="resident" label="Edit in Profile" variant="secondary" disabled={submitting} onPress={() => router.push('/settings/profile')} />
            </View>
            <View style={styles.chipRow}>
              <Chip icon="person-outline" label={profile?.full_name ?? '—'} />
              <Chip icon="call-outline" label={profile?.mobile_number ?? 'No mobile number on file'} />
            </View>
          </Card>

          <Card variant="resident" style={styles.noticeCard}>
            <Ionicons name="storefront-outline" size={18} color={theme.resident.accentText} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
              You&apos;ll pick up this document in person at the Barangay Hall once it&apos;s ready.
            </ThemedText>
          </Card>

          <Card variant="resident" style={styles.section}>
            <ThemedText type="smallBold">Valid ID Upload</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Please upload a clear copy of a government-issued ID.
            </ThemedText>

            {pickedIdImage ? (
              <View style={styles.idPreview}>
                <ThemedText type="smallBold">Uploaded ID preview</ThemedText>
                <Image source={{ uri: pickedIdImage.uri }} style={styles.idPreviewImage} contentFit="contain" />
                <View style={styles.idPreviewFooter}>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.fileName}>
                    {displayName(pickedIdImage)}
                  </ThemedText>
                </View>
                <PrimaryButton presentation="resident" label="Upload Again" variant="secondary" disabled={submitting} onPress={handlePickFile} />
              </View>
            ) : (
              <View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Upload a valid ID image"
                  disabled={submitting}
                  onPress={handlePickFile}
                  style={({ pressed }) => [pressed && styles.dropZonePressed]}>
                  <View style={[styles.dropZone, { borderColor: theme.resident.controlBorder, backgroundColor: theme.resident.surface }]}>
                    <Ionicons name="cloud-upload-outline" size={32} color={theme.textSecondary} />
                    <ThemedText type="smallBold">Tap to upload your ID image</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      JPG or PNG up to 5MB
                    </ThemedText>
                  </View>
                </Pressable>
              </View>
            )}
            {idUploadError ? (
              <View>
                <ThemedText type="small" style={{ color: theme.resident.danger }}>
                  {idUploadError}
                </ThemedText>
              </View>
            ) : null}
          </Card>

        </ScrollView>

        <View style={[styles.footer, { backgroundColor: theme.resident.card, borderTopColor: theme.resident.border }]}>
          <View style={styles.feeRow}>
            <ThemedText type="small">Processing Fee</ThemedText>
            <ThemedText type="smallBold">
              {doc.fee_centavos === 0 ? 'Free' : formatCentavosAsPHP(doc.fee_centavos)}
            </ThemedText>
          </View>
          <PrimaryButton presentation="resident" label="Proceed to Payment →" loading={submitting} onPress={handleSubmit} />
        </View>
      </FormContainer>
      <ServiceErrorToast notice={notice} onDismiss={dismissNotice} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  root: { flex: 1 },
  content: {
    padding: 20,
    gap: 20,
  },

  hairline: {
    borderWidth: 1,
  },
  title: { fontSize: 21, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4 },

  section: {
    padding: 16,
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
    maxWidth: '100%',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: 16,
  },
  noticeText: {
    flex: 1,
  },
  dropZone: {
    marginTop: Spacing.two,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  dropZonePressed: {
    opacity: 0.9,
  },
  idPreview: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  idPreviewImage: {
    width: '100%',
    height: 160,
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
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
