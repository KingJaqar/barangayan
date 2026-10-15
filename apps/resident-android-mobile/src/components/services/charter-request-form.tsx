import {
  residentServiceError,
  catalogContract,
  createRequestKey,
  idVerificationMessages,
  idVerificationState,
  ResidentSubmissionAttempt,
  servicePriceLabel,
  serviceRequestFieldErrors,
  submissionSchemaForCatalog,
  supportingAttachmentMetadata,
  uploadSupportingEvidence,
  type ServiceSubmissionInput,
  type Tables,
  type ServiceRequestField,
} from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/primary-button';
import { PurposeSheet } from '@/components/services/purpose-sheet';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { ServiceErrorToast } from '@/components/services/service-error-toast';
import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/text-field';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { pickSupportingFile, type SupportingFile } from '@/lib/supporting-upload';

type Requirement = ServiceSubmissionInput['attachments'][number]['requirementCode'];
function Field({
  label,
  value,
  onChange,
  maxLength = 1000,
  numeric = false,
  required = false,
  error,
  disabled,
  onLayout,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  numeric?: boolean;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field} onLayout={onLayout}>
      <ThemedText type="smallBold">{label}{required ? <ThemedText themeColor="accentRed"> *</ThemedText> : null}</ThemedText>
      <TextField
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        maxLength={maxLength}
        keyboardType={numeric ? 'number-pad' : 'default'}
        multiline={!numeric}
        editable={!disabled}
        error={error}
        style={error ? { borderColor: theme.accentRed, borderWidth: 1.5 } : undefined}
      />
    </View>
  );
}
function Toggle({
  label,
  value,
  onChange,
  required = false,
  error,
  disabled,
  onLayout,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const theme = useTheme();
  return (
    <View onLayout={onLayout}>
    <View style={[styles.toggle, { borderColor: error ? theme.accentRed : theme.backgroundSelected }, error ? styles.invalid : undefined]}>
      <ThemedText style={{ flex: 1 }}>{label}{required ? <ThemedText themeColor="accentRed"> *</ThemedText> : null}</ThemedText>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.primary }}
        disabled={disabled}
      />
    </View>
    {error ? <ThemedText type="small" themeColor="accentRed">{error}</ThemedText> : null}
    </View>
  );
}
export function CharterRequestForm({ doc }: { doc: Tables<'document_types'> }) {
  const catalog = catalogContract(doc)!;
  const router = useRouter();
  const theme = useTheme();
  const { profile, refetch, isLoading } = useProfile();
  const [purpose, setPurpose] = useState('');
  const [purposeOpen, setPurposeOpen] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [notes, setNotes] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [renter, setRenter] = useState(false);
  const [reference, setReference] = useState('');
  const [copies, setCopies] = useState('1');
  const [totalPages, setTotalPages] = useState('1');
  const [appearance, setAppearance] = useState(false);
  const [files, setFiles] = useState<Partial<Record<Requirement, SupportingFile & { id: string }>>>({});
  const [images, setImages] = useState<string[]>([]);
  const [approved, setApproved] = useState<Tables<'id_submissions'> | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attempt] = useState(() => new ResidentSubmissionAttempt());
  const busy = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Partial<Record<ServiceRequestField, number>>>({});
  const reportError = useCallback((message: string) => setNotice({ message }), []);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const locate = (field: ServiceRequestField, event: LayoutChangeEvent) => {
    positions.current[field] = event.nativeEvent.layout.y;
  };
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );
  const approvedId =
    idVerificationState(profile) === 'verified' && !isLoading ? profile?.approved_id_submission_id : null;
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (!active) return;
      setApproved(null);
      setImages([]);
      setVerificationError(null);
      if (!approvedId) return;
      const { data, error: queryError } = await supabase
        .from('id_submissions')
        .select('*')
        .eq('id', approvedId)
        .single();
      if (queryError || data?.decision !== 'verified') {
        if (active) {
          const message = 'Could not load your approved ID. Tap Refresh verification and try again.';
          setVerificationError(message);
          reportError(message);
        }
        return;
      }
      const signed = await Promise.all(
        [data.front_path, data.back_path].filter((path): path is string => !!path).map((path) =>
          supabase.storage.from('id-documents').createSignedUrl(path, 600),
        ),
      );
      if (!active) return;
      if (signed.some((result) => result.error)) {
        const message = 'Could not load your approved ID previews. Tap Refresh verification and try again.';
        setVerificationError(message);
        reportError(message);
        return;
      }
      setApproved(data);
      setImages(signed.map((result) => result.data!.signedUrl));
    }).catch(() => {
      if (!active) return;
      const message = 'Could not check your approved ID. Check your connection and tap Refresh verification.';
      setVerificationError(message);
      reportError(message);
    });
    return () => {
      active = false;
    };
  }, [approvedId, reportError]);
  const option = catalog.purposes.find((item) => item.code === purpose);
  const draft: Omit<ServiceSubmissionInput, 'idempotencyKey'> = {
    documentTypeId: doc.id,
    purposeCode: purpose,
    purposeExplanation: option?.requiresExplanation ? explanation.trim() : undefined,
    requesterNotes: notes.trim() || undefined,
    details: {
      ...(catalog.serviceKind === 'business' ? { businessName: businessName.trim(), establishmentAddress: address.trim() } : {}),
      ...(['indigency', 'first_time_job_seeker'].includes(catalog.serviceKind) ? { isRenter: renter } : {}),
      ...(catalog.serviceKind === 'certified_true_copy' ? { recordReference: reference.trim(), copies: Number(copies), totalPages: Number(totalPages) } : {}),
      ...(catalog.requirementRules.personalAppearance ? { personalAppearanceAcknowledged: appearance } : {}),
    },
    attachments: Object.entries(files).map(([code, file]) => supportingAttachmentMetadata(profile?.id ?? '', {
      uploadId: file!.id, requirementCode: code as Requirement, mimeType: file!.mimeType, sizeBytes: file!.bytes.length,
    })),
  };
  const validation = submissionSchemaForCatalog(catalog).safeParse({ ...draft, idempotencyKey: attempt.key });
  const fieldErrors = showErrors && !validation.success ? serviceRequestFieldErrors(validation.error) : {};
  async function pick(code: Requirement) {
    try {
      const file = await pickSupportingFile();
      if (file) {
        setFiles((previous) => ({ ...previous, [code]: { ...file, id: createRequestKey() } }));
        dismissNotice();
      }
    } catch (failure) {
      reportError(residentServiceError(failure, 'pick'));
    }
  }
  async function submit() {
    if (busy.current) return;
    busy.current = true;
    setSubmitting(true);
    dismissNotice();
    let phase: 'validate' | 'upload' | 'submit' = 'validate';
    try {
      if (!profile) throw new Error('authentication_required');
      if (!approved || approved.id !== approvedId)
        throw new Error('Your profile ID must be verified before submitting.');
      setShowErrors(true);
      if (!validation.success) {
        const errors = serviceRequestFieldErrors(validation.error);
        const first = Object.keys(errors)[0] as ServiceRequestField | undefined;
        if (first) scroll.current?.scrollTo({ y: Math.max(0, (positions.current[first] ?? 0) - 24), animated: true });
        reportError(residentServiceError(validation.error, phase));
        return;
      }
      phase = 'upload';
      const attachments: ServiceSubmissionInput['attachments'] = [];
      for (const [code, file] of Object.entries(files))
        if (file)
          attachments.push(
            await uploadSupportingEvidence(supabase, {
              uploadId: file.id,
              requirementCode: code as Requirement,
              mimeType: file.mimeType,
              bytes: file.bytes,
            }),
          );
      phase = 'submit';
      const result = await attempt.submit(supabase, { ...draft, attachments });
      router.replace(`/services/payment/${result.id}`);
    } catch (failure) {
      reportError(residentServiceError(failure, phase));
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }
  const upload = (code: Requirement, label: string, required: boolean) => (
    <View onLayout={(event) => locate(code as ServiceRequestField, event)} style={[styles.card, { borderColor: fieldErrors[code as ServiceRequestField] ? theme.accentRed : theme.backgroundSelected }]} key={code}>
      <View style={styles.cardTitleRow}>
        <Ionicons name="cloud-upload-outline" size={22} color={theme.primary} />
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">{label}{required ? <ThemedText themeColor="accentRed"> *</ThemedText> : null}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {required ? 'Required' : 'Optional'} · JPG, PNG, WEBP or PDF · up to 5 MB
          </ThemedText>
        </View>
      </View>
      {files[code] ? (
        <>
          <ThemedText type="small" numberOfLines={1}>
            {files[code]!.name}
          </ThemedText>
          <PrimaryButton
            label={`Remove ${label}`}
            variant="secondary"
            disabled={submitting}
            onPress={() =>
              setFiles((previous) => {
                const next = { ...previous };
                delete next[code];
                return next;
              })
            }
          />
        </>
      ) : null}
      <PrimaryButton
        label={`Choose ${label}`}
        variant="secondary"
        disabled={submitting}
        onPress={() => void pick(code)}
      />
      {fieldErrors[code as ServiceRequestField] ? <ThemedText type="small" themeColor="accentRed">{fieldErrors[code as ServiceRequestField]}</ThemedText> : null}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.primary }}>
      <ServiceScreenHeader title="Request Document" backLabel="Back to document" />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <ThemedText type="subtitle" style={styles.heroTitle}>
              {doc.name}
            </ThemedText>
            <View style={[styles.priceChip, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="cash-outline" size={15} color={theme.primary} />
              <ThemedText type="smallBold" style={{ flexShrink: 1 }}>
                {servicePriceLabel(doc)}
              </ThemedText>
            </View>
          </View>
          <ThemedText type="small" themeColor="textSecondary">Fields marked * are required.</ThemedText>
          <View style={[styles.card, { borderColor: theme.backgroundSelected }]}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="person-circle-outline" size={24} color={theme.primary} />
              <ThemedText type="heading" style={styles.cardTitle}>
                Resident Details
              </ThemedText>
            </View>
            <ThemedText>
              {profile?.full_name ?? 'Loading resident details…'} ·{' '}
              {profile?.mobile_number ?? 'No mobile number on file'}
            </ThemedText>
            <PrimaryButton
              label="Edit in Profile"
              variant="secondary"
              onPress={() => router.push('/settings/profile')}
            />
          </View>
          <View style={[styles.card, { borderColor: theme.backgroundSelected }]}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="shield-checkmark-outline" size={24} color={theme.primary} />
              <ThemedText type="heading" style={styles.cardTitle}>
                Approved profile ID
              </ThemedText>
            </View>
            <ThemedText themeColor="textSecondary">
              {verificationError ?? (isLoading ? 'Checking verification…' : idVerificationMessages[idVerificationState(profile)])}
            </ThemedText>
            {approved && approved.id === approvedId ? (
              <>
                <ThemedText>
                  {profile?.full_name} · {profile?.mobile_number}
                </ThemedText>
                <ThemedText>
                  {approved.id_type} · version {approved.version}
                </ThemedText>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {images.map((uri, index) => (
                    <Image
                      key={uri}
                      source={{ uri }}
                      accessibilityLabel={`Approved ID ${index === 0 ? 'front' : 'back'}`}
                      contentFit="contain"
                      style={{ flex: 1, height: 120, borderRadius: 12 }}
                    />
                  ))}
                </View>
              </>
            ) : (
              <PrimaryButton label="Verify Now" onPress={() => router.push('/settings/profile?focus=id')} />
            )}
            <PrimaryButton label="Refresh verification" variant="secondary" onPress={refetch} />
          </View>
          <View onLayout={(event) => locate('purposeCode', event)} style={styles.field}>
          <ThemedText type="heading" style={styles.cardTitle}>
            Purpose of request<ThemedText themeColor="accentRed"> *</ThemedText>
          </ThemedText>
          <View style={fieldErrors.purposeCode ? [styles.invalid, { borderColor: theme.accentRed }] : undefined}>
          <PrimaryButton
            label={option?.label ?? 'Choose a purpose'}
            variant="secondary"
            onPress={() => setPurposeOpen(true)}
            disabled={submitting}
          />
          </View>
          {fieldErrors.purposeCode ? <ThemedText type="small" themeColor="accentRed">{fieldErrors.purposeCode}</ThemedText> : null}
          </View>
          {option?.requiresExplanation ? (
            <>
              <Field label="Explain your purpose" value={explanation} onChange={setExplanation} required error={fieldErrors.purposeExplanation} onLayout={(event) => locate('purposeExplanation', event)} disabled={submitting} />
              <ThemedText type="small" themeColor="textSecondary">
                {explanation.trim().length}/1000 characters
              </ThemedText>
            </>
          ) : null}
          {catalog.serviceKind === 'business' ? (
            <>
              <Field label="Business name" value={businessName} onChange={setBusinessName} maxLength={200} required error={fieldErrors.businessName} onLayout={(event) => locate('businessName', event)} disabled={submitting} />
              <Field label="Establishment address" value={address} onChange={setAddress} required error={fieldErrors.establishmentAddress} onLayout={(event) => locate('establishmentAddress', event)} disabled={submitting} />
              {upload('dti', 'DTI registration', catalog.requirementRules.dtiRequired)}
            </>
          ) : null}
          {['indigency', 'first_time_job_seeker'].includes(catalog.serviceKind) ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                HOA certification may support or establish residency. The document fee is ₱100.00.
              </ThemedText>
              {upload('hoa', 'HOA certification', catalog.requirementRules.hoaRequired)}
              <Toggle
                label="I am a renter"
                value={renter}
                disabled={submitting}
                onChange={(value) => {
                  setRenter(value);
                  if (!value)
                    setFiles((previous) => {
                      const next = { ...previous };
                      delete next.lessor;
                      return next;
                    });
                }}
              />
              {renter
                ? upload('lessor', 'Lessor endorsement', catalog.requirementRules.lessorForRenter)
                : null}
            </>
          ) : null}
          {catalog.serviceKind === 'certified_true_copy' ? (
            <>
              <Field label="Record/document reference" value={reference} onChange={setReference} required error={fieldErrors.recordReference} onLayout={(event) => locate('recordReference', event)} disabled={submitting} />
              <Field label="Number of copies" value={copies} onChange={setCopies} numeric required error={fieldErrors.copies} onLayout={(event) => locate('copies', event)} disabled={submitting} />
              <Field label="Total pages across all copies" value={totalPages} onChange={setTotalPages} numeric required error={fieldErrors.totalPages} onLayout={(event) => locate('totalPages', event)} disabled={submitting} />
              <ThemedText type="small" themeColor="textSecondary">
                Fee: ₱10.00 × total pages across all copies.
              </ThemedText>
            </>
          ) : null}
          {catalog.requirementRules.personalAppearance ? (
            <Toggle
              label="I understand personal appearance at the Barangay Hall is required"
              value={appearance}
              onChange={setAppearance}
              required
              error={fieldErrors.personalAppearanceAcknowledged}
              onLayout={(event) => locate('personalAppearanceAcknowledged', event)}
              disabled={submitting}
            />
          ) : null}
          <Field label="Additional notes (optional)" value={notes} onChange={setNotes} disabled={submitting} />
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.backgroundSelected }]}>
          <View style={styles.footerPrice}>
            <ThemedText type="small" themeColor="textSecondary">
              Fee
            </ThemedText>
            <ThemedText type="smallBold" numberOfLines={2}>
              {servicePriceLabel(doc)}
            </ThemedText>
          </View>
          <View style={styles.footerAction}>
            <PrimaryButton
              label="Submit request"
              loading={submitting}
              disabled={!approvedId || approved?.id !== approvedId || submitting}
              onPress={() => void submit()}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
      <PurposeSheet
        visible={purposeOpen}
        title="Purpose of request"
        options={catalog.purposes}
        selected={purpose}
        onSelect={(code) => {
          setPurpose(code);
          setExplanation('');
        }}
        onClose={() => setPurposeOpen(false)}
      />
      <ServiceErrorToast notice={notice} onDismiss={dismissNotice} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 24, gap: 16, paddingBottom: 32 },
  hero: { gap: 12, marginBottom: 4 },
  heroTitle: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4 },
  priceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  field: { gap: 8 },
  invalid: { borderWidth: 1.5, borderRadius: 12, padding: 4 },
  card: { padding: 16, borderWidth: 1, borderRadius: 16, gap: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 18, lineHeight: 24 },
  toggle: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerPrice: { flex: 1 },
  footerAction: { flex: 1.1 },
});
