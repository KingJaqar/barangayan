import {
  residentServiceError,
  catalogContract,
  createRequestKey,
  idVerificationMessages,
  idVerificationState,
  ResidentSubmissionAttempt,
  servicePriceLabel,
  submissionSchemaForCatalog,
  uploadSupportingEvidence,
  type ServiceSubmissionInput,
  type Tables,
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/primary-button';
import { PurposeSheet } from '@/components/services/purpose-sheet';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  numeric?: boolean;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextField
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        maxLength={maxLength}
        keyboardType={numeric ? 'number-pad' : 'default'}
        multiline={!numeric}
      />
    </View>
  );
}
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.toggle, { borderColor: theme.backgroundSelected }]}>
      <ThemedText style={{ flex: 1 }}>{label}</ThemedText>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.primary }}
      />
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
  const [appearance, setAppearance] = useState(false);
  const [files, setFiles] = useState<Partial<Record<Requirement, SupportingFile & { id: string }>>>({});
  const [images, setImages] = useState<string[]>([]);
  const [approved, setApproved] = useState<Tables<'id_submissions'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attempt] = useState(() => new ResidentSubmissionAttempt());
  const busy = useRef(false);
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
      if (!approvedId) return;
      const { data, error: queryError } = await supabase
        .from('id_submissions')
        .select('*')
        .eq('id', approvedId)
        .single();
      if (queryError || data?.decision !== 'verified') {
        if (active) setError('Could not load approved ID. Refresh verification and try again.');
        return;
      }
      const signed = await Promise.all(
        [data.front_path, data.back_path].map((path) =>
          supabase.storage.from('id-documents').createSignedUrl(path, 600),
        ),
      );
      if (!active) return;
      if (signed.some((result) => result.error)) {
        setError('Could not load approved ID previews. Refresh verification.');
        return;
      }
      setApproved(data);
      setImages(signed.map((result) => result.data!.signedUrl));
    });
    return () => {
      active = false;
    };
  }, [approvedId]);
  const option = catalog.purposes.find((item) => item.code === purpose);
  async function pick(code: Requirement) {
    try {
      const file = await pickSupportingFile();
      if (file) {
        setFiles((previous) => ({ ...previous, [code]: { ...file, id: createRequestKey() } }));
        setError(null);
      }
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  async function submit() {
    if (busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      if (!approved || approved.id !== approvedId)
        throw new Error('Your profile ID must be verified before submitting.');
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
      const value: Omit<ServiceSubmissionInput, 'idempotencyKey'> = {
        documentTypeId: doc.id,
        purposeCode: purpose,
        requesterNotes: notes.trim() || undefined,
        details: {},
        attachments,
      };
      if (option?.requiresExplanation) value.purposeExplanation = explanation.trim();
      if (catalog.serviceKind === 'business')
        value.details = { businessName: businessName.trim(), establishmentAddress: address.trim() };
      if (['indigency', 'first_time_job_seeker'].includes(catalog.serviceKind))
        value.details.isRenter = renter;
      if (catalog.serviceKind === 'certified_true_copy')
        value.details = { recordReference: reference.trim(), copies: Number(copies) };
      if (catalog.requirementRules.personalAppearance)
        value.details.personalAppearanceAcknowledged = appearance;
      submissionSchemaForCatalog(catalog).parse({ ...value, idempotencyKey: attempt.key });
      const result = await attempt.submit(supabase, value);
      router.replace(`/services/payment/${result.id}`);
    } catch (failure) {
      setError(residentServiceError(failure));
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }
  const upload = (code: Requirement, label: string, required: boolean) => (
    <View style={[styles.card, { borderColor: theme.backgroundSelected }]} key={code}>
      <View style={styles.cardTitleRow}>
        <Ionicons name="cloud-upload-outline" size={22} color={theme.primary} />
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">{label}</ThemedText>
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
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.primary }}>
      <ServiceScreenHeader title="Request Document" backLabel="Back to document" />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
              {isLoading ? 'Checking verification…' : idVerificationMessages[idVerificationState(profile)]}
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
          <ThemedText type="heading" style={styles.cardTitle}>
            Purpose of request
          </ThemedText>
          <PrimaryButton
            label={option?.label ?? 'Choose a purpose'}
            variant="secondary"
            onPress={() => setPurposeOpen(true)}
          />
          {option?.requiresExplanation ? (
            <>
              <Field label="Explain your purpose" value={explanation} onChange={setExplanation} />
              <ThemedText type="small" themeColor="textSecondary">
                {explanation.trim().length}/1000 characters
              </ThemedText>
            </>
          ) : null}
          {catalog.serviceKind === 'business' ? (
            <>
              <Field label="Business name" value={businessName} onChange={setBusinessName} maxLength={200} />
              <Field label="Establishment address" value={address} onChange={setAddress} />
              {upload('dti', 'DTI registration', catalog.requirementRules.dtiRequired)}
            </>
          ) : null}
          {['indigency', 'first_time_job_seeker'].includes(catalog.serviceKind) ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                HOA certification may support or establish residency. Staff reviews eligibility and fee
                exemptions.
              </ThemedText>
              {upload('hoa', 'HOA certification', catalog.requirementRules.hoaRequired)}
              <Toggle
                label="I am a renter"
                value={renter}
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
              <Field label="Record/document reference" value={reference} onChange={setReference} />
              <Field label="Number of copies" value={copies} onChange={setCopies} numeric />
              <ThemedText type="small" themeColor="textSecondary">
                Staff confirms total billable pages across all copies. Fee: ₱10 × total confirmed pages.
              </ThemedText>
            </>
          ) : null}
          {catalog.requirementRules.personalAppearance ? (
            <Toggle
              label="I understand personal appearance at the Barangay Hall is required"
              value={appearance}
              onChange={setAppearance}
            />
          ) : null}
          <Field label="Additional notes (optional)" value={notes} onChange={setNotes} />
          {error ? (
            <ThemedText accessibilityRole="alert" themeColor="accentRed">
              {error}
            </ThemedText>
          ) : null}
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
