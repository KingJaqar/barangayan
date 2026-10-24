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
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/primary-button';
import { Card } from '@/components/card';
import { PurposeSheet } from '@/components/services/purpose-sheet';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { ServiceErrorToast } from '@/components/services/service-error-toast';
import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/text-field';
import { getMobileFontFamily } from '@/constants/fonts';
import { useFontPreference } from '@/hooks/use-font-preference';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
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
  large = false,
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
  large?: boolean;
}) {
  const theme = useTheme();
  const { fontId } = useFontPreference();
  return (
    <View style={styles.field} onLayout={onLayout}>
      <ThemedText type="smallBold" style={styles.cardTitle}>{label}{required ? <ThemedText style={{ color: theme.resident.danger }}> *</ThemedText> : null}</ThemedText>
      <TextField
        presentation="resident"
        appearance="requestForm"
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        maxLength={maxLength}
        keyboardType={numeric ? 'number-pad' : 'default'}
        multiline={!numeric}
        editable={!disabled}
        error={error}
        style={[styles.input, large && styles.notesInput, { fontFamily: getMobileFontFamily(fontId) }, error ? { borderColor: theme.resident.danger, borderWidth: 1.5 } : undefined]}
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
  joined = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  joined?: boolean;
}) {
  const theme = useTheme();
  return (
    <View onLayout={onLayout} style={[styles.toggleSection, joined && styles.joinedToggle, { borderColor: error ? theme.resident.danger : theme.resident.border }]}>
    <View style={styles.toggle}>
      <ThemedText style={[styles.toggleLabel, { flex: 1 }]}>{label}{required ? <ThemedText style={{ color: theme.resident.danger }}> *</ThemedText> : null}</ThemedText>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.resident.accentText }}
        disabled={disabled}
      />
    </View>
    {error ? <ThemedText type="small" style={[styles.body, { color: theme.resident.danger }]}>{error}</ThemedText> : null}
    </View>
  );
}
export function CharterRequestForm({ doc }: { doc: Tables<'document_types'> }) {
  const catalog = catalogContract(doc)!;
  const router = useRouter();
  const theme = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
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
  const [idPanelHeight, setIdPanelHeight] = useState(0);
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
        if (first) scroll.current?.scrollTo({ y: Math.max(0, (positions.current[first] ?? 0) - 24), animated: !reducedMotion });
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
    <View onLayout={(event) => locate(code as ServiceRequestField, event)} style={[styles.panel, { backgroundColor: theme.resident.card, borderColor: fieldErrors[code as ServiceRequestField] ? theme.resident.danger : theme.resident.border }]} key={code}>
      <View style={styles.cardTitleRow}>
        <View style={[styles.uploadIcon, { backgroundColor: theme.resident.accentSoft }]}>
          <Ionicons name="cloud-upload-outline" size={20} color={theme.resident.accentText} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold" style={styles.cardTitle}>{label}{required ? <ThemedText style={{ color: theme.resident.danger }}> *</ThemedText> : null}</ThemedText>
          <ThemedText type="small" style={styles.meta} themeColor="textSecondary">
            {required ? 'Required' : 'Optional'} · JPG, PNG, WEBP or PDF · up to 5 MB
          </ThemedText>
        </View>
      </View>
      {files[code] ? (
        <>
          <ThemedText type="small" style={styles.body}>
            {files[code]!.name}
          </ThemedText>
          <PrimaryButton presentation="resident" appearance="requestForm"
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
      <PrimaryButton presentation="resident" appearance="requestForm"
        label={`Choose ${label}`}
        variant="secondary"
        disabled={submitting}
        onPress={() => void pick(code)}
      />
      {fieldErrors[code as ServiceRequestField] ? <ThemedText type="small" style={[styles.body, { color: theme.resident.danger }]}>{fieldErrors[code as ServiceRequestField]}</ThemedText> : null}
    </View>
  );
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: theme.resident.card }}>
      <ServiceScreenHeader presentation="resident" title="Request Document" backLabel="Back to document" compact />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <ThemedText type="subtitle" style={styles.heroTitle}>
              {doc.name}
            </ThemedText>
            <View style={styles.heroMeta}>
            <View style={[styles.priceChip, { backgroundColor: theme.resident.surface }]}>
              <Ionicons name="cash-outline" size={15} color={theme.resident.accentText} />
              <ThemedText type="smallBold" style={styles.priceLabel}>
                {servicePriceLabel(doc)}
              </ThemedText>
            </View>
            <ThemedText type="small" style={styles.requiredHint} themeColor="textSecondary">Fields marked <ThemedText style={{ color: theme.resident.danger }}>*</ThemedText> are required.</ThemedText>
            </View>
          </View>
          <Card variant="resident" style={styles.panel}>
            <View style={[styles.cardTitleRow, styles.residentTitleRow]}>
              <Ionicons name="person-circle-outline" size={20} color={theme.resident.accentText} />
              <ThemedText type="heading" style={[styles.cardTitle, styles.residentTitle]}>
                Resident Details
              </ThemedText>
              <Pressable accessibilityRole="button" accessibilityLabel="Edit in Profile" onPress={() => router.push('/settings/profile')}
                style={({ pressed }) => [styles.inlineAction, { backgroundColor: pressed ? theme.resident.accentSoft : 'transparent' }]}>
                <ThemedText style={[styles.editLabel, { color: theme.resident.accentText }]}>Edit in Profile</ThemedText>
              </Pressable>
            </View>
            <ThemedText type="small" style={[styles.body, styles.residentLine]}>
              {profile?.full_name ?? 'Loading resident details…'} ·{' '}
              {profile?.mobile_number ?? 'No mobile number on file'}
            </ThemedText>
          </Card>
          <Card variant="resident" style={[styles.panel, { minHeight: idPanelHeight }]} onLayout={(event) => {
            const height = event.nativeEvent.layout.height;
            setIdPanelHeight(previous => height > previous ? height : previous);
          }}>
            <View style={styles.cardTitleRow}>
              <Image
                source={idVerificationState(profile) === 'verified'
                  ? require('../../../assets/images/valid-id-verified.png')
                  : require('../../../assets/images/valid-id-unverified.png')}
                contentFit="contain"
                accessibilityLabel={idVerificationState(profile) === 'verified' ? 'Valid ID verified' : 'Valid ID unverified'}
                style={styles.idStatusIcon}
              />
              <ThemedText type="heading" style={styles.cardTitle}>
                Approved profile ID
              </ThemedText>
            </View>
            <ThemedText type="small" style={styles.meta} themeColor="textSecondary">
              {verificationError ?? (isLoading ? 'Checking verification…' : idVerificationMessages[idVerificationState(profile)])}
            </ThemedText>
            <View style={styles.idDetails}>
            {approved && approved.id === approvedId ? (
              <View style={styles.idSummary}>
                <View style={styles.idPreviews}>
                  {images.map((uri, index) => (
                    <Image
                      key={uri}
                      source={{ uri }}
                      accessibilityLabel={`Approved ID ${index === 0 ? 'front' : 'back'}`}
                      contentFit="contain"
                      style={[styles.idImage, { backgroundColor: theme.resident.surface, borderColor: theme.resident.border }]}
                    />
                  ))}
                </View>
                <View style={styles.idText}>
                  <ThemedText type="smallBold" style={styles.idName}>{profile?.full_name} · {profile?.mobile_number}</ThemedText>
                  <ThemedText type="small" style={styles.idType} themeColor="textSecondary">{approved.id_type} · version {approved.version}</ThemedText>
                </View>
              </View>
            ) : (
              <PrimaryButton presentation="resident" appearance="requestForm" label="Verify Now" onPress={() => router.push('/settings/profile?focus=id')} />
            )}
            </View>
            <PrimaryButton presentation="resident" appearance="requestForm" leadingIcon={<Ionicons name="refresh-outline" size={18} color={theme.resident.text} />} label={isLoading ? 'Refreshing verification…' : 'Refresh verification'} disabled={isLoading || submitting} variant="secondary" onPress={refetch} />
          </Card>
          <View onLayout={(event) => locate('purposeCode', event)} style={styles.field}>
          <ThemedText type="heading" style={styles.cardTitle}>
            Purpose of request<ThemedText style={{ color: theme.resident.danger }}> *</ThemedText>
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel={option?.label ?? 'Choose a purpose'} accessibilityHint="Choose a purpose of request" accessibilityState={{ expanded: purposeOpen, disabled: submitting }}
            onPress={() => setPurposeOpen(true)}
            disabled={submitting}
            style={({ pressed }) => [styles.purposeControl, { backgroundColor: pressed ? theme.resident.pressed : theme.resident.surface, borderColor: fieldErrors.purposeCode ? theme.resident.danger : theme.resident.border }]}>
            <ThemedText style={[styles.purposeLabel, { color: option ? theme.resident.text : theme.resident.muted, fontWeight: option ? '600' : '400' }]}>{option?.label ?? 'Choose a purpose'}</ThemedText>
            <Ionicons name="chevron-down" size={20} color={theme.resident.muted} accessible={false} />
          </Pressable>
          {fieldErrors.purposeCode ? <ThemedText type="small" style={[styles.body, { color: theme.resident.danger }]}>{fieldErrors.purposeCode}</ThemedText> : null}
          </View>
          {option?.requiresExplanation ? (
            <>
              <Field label="Explain your purpose" value={explanation} onChange={setExplanation} required error={fieldErrors.purposeExplanation} onLayout={(event) => locate('purposeExplanation', event)} disabled={submitting} />
              <ThemedText type="small" style={styles.body} themeColor="textSecondary">
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
              <ThemedText type="small" style={styles.body} themeColor="textSecondary">
                HOA certification may support or establish residency. Document fee: {servicePriceLabel(doc)}.
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
              <ThemedText type="small" style={styles.body} themeColor="textSecondary">
                Fee: {servicePriceLabel(doc)} across all copies.
              </ThemedText>
            </>
          ) : null}
          {catalog.requirementRules.personalAppearance ? (
            <Toggle
              label="I understand personal appearance at the Barangay Hall is required"
              joined={!renter && ['indigency', 'first_time_job_seeker'].includes(catalog.serviceKind)}
              value={appearance}
              onChange={setAppearance}
              required
              error={fieldErrors.personalAppearanceAcknowledged}
              onLayout={(event) => locate('personalAppearanceAcknowledged', event)}
              disabled={submitting}
            />
          ) : null}
          <Field label="Additional notes (optional)" value={notes} onChange={setNotes} disabled={submitting} large />
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: theme.resident.card, borderTopColor: theme.resident.border }]}>
          <View style={styles.footerPrice}>
            <ThemedText type="small" style={styles.meta} themeColor="textSecondary">
              Fee
            </ThemedText>
            <ThemedText type="smallBold" style={servicePriceLabel(doc).length > 22 ? styles.longFee : styles.feeValue}>
              {servicePriceLabel(doc)}
            </ThemedText>
          </View>
          <View style={styles.footerAction}>
            <PrimaryButton presentation="resident" appearance="requestForm"
              label="Submit request"
              loading={submitting}
              disabled={!approvedId || approved?.id !== approvedId || submitting}
              onPress={() => void submit()}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
      <PurposeSheet
        presentation="resident"
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
  content: { padding: 20, gap: 20 },
  hero: { gap: 10 },
  heroTitle: { fontSize: 21, lineHeight: 26, fontWeight: '800', letterSpacing: -0.5 },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 8 },
  requiredHint: { flexShrink: 1, fontSize: 12.5, lineHeight: 18, fontWeight: '400' },
  priceLabel: { flexShrink: 1, fontSize: 13, lineHeight: 18 },
  priceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  field: { gap: 8 },
  input: { minHeight: 48, fontSize: 15, lineHeight: 22.5, paddingHorizontal: 16, paddingVertical: 12, textAlignVertical: 'top' },
  notesInput: { minHeight: 94 },
  panel: { padding: 16, borderWidth: 1, borderRadius: 16, gap: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  idDetails: { minHeight: 72 },
  idStatusIcon: { width: 36, height: 36, borderRadius: 6, flexShrink: 0 },
  idSummary: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  idPreviews: { width: 108, gap: 8 },
  idImage: { width: 108, height: 72, borderRadius: 8, borderWidth: 1 },
  idText: { flex: 1, minWidth: 0, gap: 2 },
  idName: { fontSize: 13.5, lineHeight: 20, fontWeight: '600' },
  idType: { fontSize: 13.5, lineHeight: 20, fontWeight: '400' },
  uploadIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  residentTitleRow: { flexWrap: 'nowrap' },
  residentTitle: { flex: 1 },
  cardTitle: { flexShrink: 1, fontSize: 15, lineHeight: 20 },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  meta: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  residentLine: { paddingLeft: 30 },
  inlineAction: { marginLeft: 'auto', minHeight: 44, marginVertical: -12, flexShrink: 1, justifyContent: 'center', borderRadius: 8 },
  editLabel: { fontSize: 13, lineHeight: 20, fontWeight: '700' },
  purposeControl: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  purposeLabel: { flex: 1, fontSize: 15, lineHeight: 22 },
  toggleSection: { borderTopWidth: 1, borderBottomWidth: 1 },
  joinedToggle: { marginTop: -20, borderTopWidth: 0 },
  toggleLabel: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  toggle: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerPrice: { flex: 1 },
  footerAction: { flexShrink: 1, minWidth: 132, maxWidth: '65%' },
  feeValue: { fontSize: 17, lineHeight: 24, fontWeight: '800' },
  longFee: { fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
});
