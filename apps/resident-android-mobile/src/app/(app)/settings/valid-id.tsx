import { idConfirmedDetailsSchema, idVerificationState, ID_TYPES, OTHER_ID_TYPE_PREFIX, publishIdEvidence, type IdConfirmedDetails } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthHeader } from '@/components/auth-header';
import { BirthdayWheelModal } from '@/components/birthday-wheel-modal';
import { GuestPrompt } from '@/components/guest-prompt';
import { RecoveryError, recoveryStyles, StepFlowScreen } from '@/components/password-recovery-screen';
import { PrimaryButton } from '@/components/primary-button';
import { SettingsSheet } from '@/components/settings-sheet';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { ACCEPTED_IMAGE_MIME_TYPES, imageExtension, pickImageAsset, readImageBytes, type PickedImage } from '@/lib/image-upload';
import { extractIdDetails } from '@/lib/valid-id';
import { idPhotoBytes } from '@/lib/id-photo-bytes';
import { birthdayLabel } from '@/lib/birthday-wheel';
import { supabase } from '@/lib/supabase';

const EMPTY_DETAILS: IdConfirmedDetails = { fullName: '', idNumber: '', birthDate: '', address: '' };
const STEPS = [
  { title: 'Select ID type', description: 'Choose the valid ID you want to submit for verification.' },
  { title: 'Provide an ID photo', description: 'Upload or take a clear photo of the front of your ID. A back photo is not required.' },
  { title: 'Review and confirm details', description: 'Check the details read from your ID. Correct any mistakes and fill in missing information before continuing.' },
  { title: 'Review and submit', description: 'Review your front ID photo and confirmed details. Submit them for barangay verification.' },
];
const FIELDS = [
  { key: 'fullName', label: 'Full name', maxLength: 200 },
  { key: 'idNumber', label: 'ID number (if shown)', maxLength: 200 },
  { key: 'birthDate', label: 'Date of birth (if shown)', maxLength: 10 },
  { key: 'address', label: 'Address (if shown)', maxLength: 1000 },
] as const;

export default function ValidIdScreen() {
  const { session } = useAuth();
  return <ValidIdScreenContent key={session?.user.id ?? 'guest'} />;
}

function ValidIdScreenContent() {
  const router = useRouter();
  const theme = useTheme();
  const reduced = useResidentReducedMotion(true);
  const { session } = useAuth();
  const { profile, isLoading, error: profileError, refetch } = useProfile();
  const [step, setStep] = useState(1);
  const [idType, setIdType] = useState<string>('');
  const [otherIdType, setOtherIdType] = useState('');
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [birthdayOpen, setBirthdayOpen] = useState(false);
  const [photo, setPhoto] = useState<{ uri: string; path: string } | null>(null);
  const [details, setDetails] = useState<IdConfirmedDetails>(EMPTY_DETAILS);
  const [detailsReady, setDetailsReady] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const publication = useRef<{ signature: string; id: string } | null>(null);
  const owner = useRef(session?.user.id);
  owner.current = session?.user.id;
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const current = (userId: string) => active.current && owner.current === userId;
  const selectedType = idType === 'Other' ? `${OTHER_ID_TYPE_PREFIX}${otherIdType.trim()}` : idType;
  const verification = idVerificationState(profile);
  const verified = !isLoading && !profileError && verification === 'verified';
  const pending = !isLoading && !profileError && verification === 'pending';
  const showConfirmation = !replacing && (submitted || verified || pending);

  function goBack() {
    if (busyRef.current || capturing) return;
    if (birthdayOpen) { setBirthdayOpen(false); return; }
    if (typePickerOpen) { setTypePickerOpen(false); return; }
    if (cameraOpen) { setCameraOpen(false); return; }
    Keyboard.dismiss();
    setError(null);
    if (showConfirmation || step === 1) router.back();
    else setStep(previous => previous - 1);
  }
  useFocusEffect(useCallback(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => { back.remove(); };
    // Back handling follows the current step and camera state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, cameraOpen, typePickerOpen, birthdayOpen, capturing, showConfirmation]));

  async function readDetails(path: string, userId: string) {
    setReadingError(null);
    try {
      const extracted = await extractIdDetails(path, selectedType);
      if (current(userId)) { setDetails(extracted); setDetailsReady(true); }
    } catch (cause) {
      if (current(userId)) setReadingError(cause instanceof Error ? cause.message : 'We could not read this photo. Retry or enter its details manually.');
    }
  }

  async function providePhoto(picked: PickedImage, capturedBytes?: Uint8Array) {
    const userId = session?.user.id;
    if (!userId || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      if (!ACCEPTED_IMAGE_MIME_TYPES.includes(picked.mimeType as typeof ACCEPTED_IMAGE_MIME_TYPES[number])) throw new Error('Choose a JPG, PNG, or WebP photo.');
      if (picked.size !== null && picked.size > 5 * 1024 * 1024) throw new Error('Choose a photo no larger than 5 MB.');
      const bytes = capturedBytes ?? await readImageBytes(picked);
      if (!current(userId)) return;
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('Choose a photo no larger than 5 MB.');
      const path = `${userId}/versions/${randomUUID()}/id-front.${imageExtension(picked.mimeType)}`;
      const { error: uploadError } = await supabase.storage.from('id-documents').upload(path, bytes, { contentType: picked.mimeType, upsert: false });
      if (uploadError) throw new Error('Could not upload your ID photo. Check your connection and try again.');
      if (!current(userId)) return;
      setPhoto({ uri: picked.uri, path }); setDetails(EMPTY_DETAILS); setDetailsReady(false); setFieldErrors({}); publication.current = null;
      await readDetails(path, userId);
    } catch (cause) {
      if (current(userId)) setError(cause instanceof Error ? cause.message : 'Could not upload your photo. Please try again.');
    } finally {
      busyRef.current = false;
      if (current(userId)) setBusy(false);
    }
  }

  async function choosePhoto() {
    if (busyRef.current) return;
    const userId = session?.user.id;
    setError(null);
    try { const picked = await pickImageAsset(); if (picked && userId && current(userId)) await providePhoto(picked); }
    catch { if (active.current) setError('Could not open your photos. Please try again.'); }
  }

  async function openCamera() {
    setError(null);
    try {
      const result = permission?.granted ? permission : await requestPermission();
      if (!result.granted) { setError('Allow camera access to take an ID photo, or upload an existing photo.'); return; }
      setCameraReady(false); setCameraOpen(true);
    } catch { setError('Could not open the camera. You can upload an existing photo.'); }
  }

  async function takePhoto() {
    if (!cameraReady || capturing || !camera.current) return;
    setCapturing(true);
    try {
      const captured = await camera.current.takePictureAsync({ quality: 0.8, base64: true });
      if (!captured?.base64) throw new Error('Could not take your photo. Please try again.');
      const bytes = idPhotoBytes(captured.base64);
      setCameraOpen(false);
      await providePhoto({ uri: captured.uri, mimeType: 'image/jpeg', size: bytes.length, name: 'id-front.jpg' }, bytes);
    } catch (cause) {
      setCameraOpen(false); setError(cause instanceof Error ? cause.message : 'Could not take your photo. Please try again.');
    } finally { setCapturing(false); }
  }

  async function retryReading() {
    if (!photo || !session || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try { await readDetails(photo.path, session.user.id); }
    finally { busyRef.current = false; if (active.current) setBusy(false); }
  }

  function continueFlow() {
    setError(null); Keyboard.dismiss();
    if (step === 1 && (!idType || (idType === 'Other' && !otherIdType.trim()))) { setError('Select your ID type and specify its name if you choose Other.'); return; }
    if (step === 2 && (!photo || !detailsReady)) return;
    if (step === 3) {
      const result = idConfirmedDetailsSchema.safeParse(details);
      if (!result.success) {
        setFieldErrors(Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message])));
        return;
      }
      setDetails(result.data); setFieldErrors({});
    }
    setStep(previous => previous + 1);
  }

  async function submit() {
    const userId = session?.user.id;
    if (!userId || !photo || busyRef.current || submitted || step !== 4) return;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      const confirmedDetails = idConfirmedDetailsSchema.parse(details);
      const signature = JSON.stringify([selectedType, photo.path, confirmedDetails]);
      if (publication.current?.signature !== signature) publication.current = { signature, id: randomUUID() };
      await publishIdEvidence(supabase, { submissionId: publication.current.id, idType: selectedType, frontPath: photo.path, confirmedDetails });
      if (current(userId)) { setSubmitted(true); setReplacing(false); refetch(); }
    } catch (cause) {
      if (current(userId)) setError(cause instanceof Error ? cause.message : 'Could not submit your ID. Please try again.');
    } finally { busyRef.current = false; if (current(userId)) setBusy(false); }
  }

  if (!session) return <GuestPrompt label="Log in to submit your valid ID." />;
  if (showConfirmation || (!replacing && (isLoading || profileError))) {
    const statusColor = verified ? theme.resident.success : theme.resident.warning;
    return <View style={[styles.root, { backgroundColor: theme.resident.card }]}>
      <AuthHeader presentation="resident" title="Valid ID" onBack={goBack} />
      <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.statusContent}>
          <View style={styles.statusBody}>
            {showConfirmation ? <View style={[styles.confirmation, { borderColor: theme.resident.border, backgroundColor: verified ? theme.resident.successSoft : theme.resident.warningSoft }]} accessibilityLiveRegion="polite">
              <Ionicons name={verified ? "checkmark-circle-outline" : "time-outline"} size={20} color={statusColor} />
              <View style={styles.statusText}>
                <ThemedText style={styles.confirmationTitle}>{verified ? 'Your valid ID has been verified' : 'Valid ID is pending verification'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{verified ? 'You can use this ID for service requests.' : 'Your ID has been submitted for staff review. You can use it for service requests once it has been verified.'}</ThemedText>
              </View>
            </View> : null}
            {isLoading ? <View style={styles.status} accessibilityLiveRegion="polite"><ActivityIndicator color={theme.resident.accentText} /><ThemedText themeColor="textSecondary">Checking verification status…</ThemedText></View> : profileError ? <>
              <RecoveryError presentation="resident" message={submitted ? 'Your ID was submitted. Verification status is temporarily unavailable.' : profileError} />
              <PrimaryButton presentation="resident" label="Try again" onPress={refetch} />
            </> : showConfirmation ? <>
              <ThemedText type="small" themeColor="textSecondary">{verified ? 'If you need to replace this ID, your new submission will require staff verification before it can be used for service requests.' : 'If you need to correct this submission, you can submit a replacement ID for staff review.'}</ThemedText>
              <PhotoAction label="Submit a replacement ID" icon="card-outline" onPress={() => {
                setStep(1); setIdType(''); setOtherIdType(''); setPhoto(null); setDetails(EMPTY_DETAILS);
                setDetailsReady(false); setFieldErrors({}); setError(null); setReadingError(null);
                publication.current = null; setSubmitted(false); setReplacing(true);
              }} />
            </> : null}
            <PrimaryButton presentation="resident" label="Back to Settings" onPress={() => router.dismissTo('/settings')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>;
  }
  const intro = STEPS[step - 1] ?? STEPS[0];
  return (
    <View style={[styles.root, { backgroundColor: theme.resident.card }]}>
      <AuthHeader presentation="resident" title="Valid ID" onBack={goBack} />
      <StepFlowScreen presentation="resident" compact step={step} totalSteps={4} flowLabel="Valid ID submission" title={intro.title} description={intro.description}>
        <View style={styles.form}>
            {step === 1 ? <>
              {profile?.id_verification_status ? <View style={styles.status}>
                <Ionicons name={verified ? 'checkmark-circle' : 'warning'} size={20} color={verified ? theme.resident.success : theme.resident.danger} />
                <ThemedText type="small" style={styles.statusText}>{verified ? 'Your current ID is verified. A new submission will need verification again.' : profile.id_verification_status === 'pending' ? 'Your current ID is pending verification. You may submit a replacement.' : 'Your ID has not been verified. Submit a clear photo for review.'}</ThemedText>
              </View> : null}
              <View style={styles.options}>
                <ThemedText type="small">ID type</ThemedText>
                <Pressable accessibilityRole="button" accessibilityLabel="Select ID type" onPress={() => setTypePickerOpen(true)} style={[styles.option, { borderColor: theme.resident.border, backgroundColor: theme.resident.card }]}>
                  <ThemedText style={styles.statusText} themeColor={idType ? 'text' : 'textSecondary'}>{idType || 'Select ID type'}</ThemedText>
                  <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>
              {idType === 'Other' ? <TextField presentation="resident" label="Specify ID type" required accessibilityLabel="Specify ID type" value={otherIdType} maxLength={193} onChangeText={setOtherIdType} style={recoveryStyles.field} /> : null}
            </> : null}
            {step === 2 ? <>
              <View style={[styles.photoFrame, { borderColor: theme.resident.border, backgroundColor: theme.resident.surface }]}>
                {photo ? <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="contain" accessibilityLabel="Selected front ID photo" /> : <><Ionicons name="card-outline" size={48} color={theme.textSecondary} /><ThemedText themeColor="textSecondary">Front of ID only</ThemedText></>}
              </View>
              <PhotoAction label={photo ? 'Upload a different photo' : 'Upload a photo'} icon="cloud-upload-outline" disabled={busy} onPress={() => { void choosePhoto(); }} />
              <PhotoAction label={photo ? 'Take a new photo' : 'Take a photo'} icon="camera-outline" disabled={busy} onPress={() => { void openCamera(); }} />
              {permission && !permission.granted && !permission.canAskAgain ? <PhotoAction label="Open camera permissions" icon="settings-outline" disabled={busy} onPress={() => { void Linking.openSettings(); }} /> : null}
              <ThemedText type="small" themeColor="textSecondary">Keep all corners visible and avoid blur or glare. JPG, PNG, or WebP, up to 5 MB.</ThemedText>
              {busy ? <ThemedText type="small" accessibilityLiveRegion="polite">Uploading and reading your ID photo…</ThemedText> : null}
              <RecoveryError presentation="resident" message={readingError} />
              {photo && !detailsReady && !busy ? <>
                <PhotoAction label="Try reading the photo again" icon="refresh-outline" onPress={() => { void retryReading(); }} />
                <PhotoAction label="Enter details manually" icon="create-outline" onPress={() => { setDetailsReady(true); setStep(3); }} />
              </> : null}
            </> : null}
            {step === 3 ? <>
              <ThemedText type="small" themeColor="textSecondary">Use the details printed on your ID. Leave optional fields blank if they are not shown on the front.</ThemedText>
              {FIELDS.map(field => field.key === 'birthDate' ? <View key={field.key} style={styles.options}>
                <ThemedText type="small">{field.label}</ThemedText>
                <Pressable accessibilityRole="button" accessibilityLabel={field.label} accessibilityHint="Opens month, day and year wheels" accessibilityValue={{ text: details.birthDate ? birthdayLabel(details.birthDate) : 'Not selected' }} onPress={() => { Keyboard.dismiss(); setBirthdayOpen(true); }} style={[styles.option, { borderColor: fieldErrors.birthDate ? theme.resident.danger : theme.resident.border }]}>
                  <ThemedText style={styles.statusText} themeColor={details.birthDate ? 'text' : 'textSecondary'}>{birthdayLabel(details.birthDate)}</ThemedText>
                  <Ionicons name="calendar-outline" size={20} color={theme.resident.accentText} />
                </Pressable>
                {fieldErrors.birthDate ? <RecoveryError presentation="resident" message={fieldErrors.birthDate} /> : null}
              </View> : <TextField presentation="resident" key={field.key} label={field.label} required={field.key === 'fullName'} accessibilityLabel={field.label} value={details[field.key]} maxLength={field.maxLength} autoCorrect={false} autoCapitalize={field.key === 'idNumber' ? 'characters' : 'words'} multiline={field.key === 'address'} onChangeText={value => { setDetails(previous => ({ ...previous, [field.key]: value })); setFieldErrors(previous => ({ ...previous, [field.key]: '' })); }} error={fieldErrors[field.key]} style={[recoveryStyles.field, { backgroundColor: theme.resident.card }]} />)}
            </> : null}
            {step === 4 && photo ? <>
              <Image source={{ uri: photo.uri }} style={[styles.summaryPhoto, { backgroundColor: theme.resident.surface }]} contentFit="contain" accessibilityLabel="Front ID photo to submit" />
              <View style={[styles.summary, { borderColor: theme.resident.border }]}>
                <SummaryField label="ID type" value={selectedType} />
                {FIELDS.map(field => <SummaryField key={field.key} label={field.label} value={details[field.key] || 'Not shown on ID'} />)}
              </View>
              <ThemedText type="small" themeColor="textSecondary">Submitting sends this photo and your confirmed details to the barangay for review.</ThemedText>
            </> : null}
            <RecoveryError presentation="resident" message={error} />
            <PrimaryButton presentation="resident" label={step === 4 ? 'Submit' : 'Continue'} loading={busy} disabled={step === 1 ? !idType || (idType === 'Other' && !otherIdType.trim()) : step === 2 ? !photo || !detailsReady : false} onPress={step === 4 ? () => { void submit(); } : continueFlow} />
            <Pressable accessibilityRole="button" accessibilityLabel={step === 1 ? 'Back to Settings' : 'Previous step'} disabled={busy} onPress={goBack} style={recoveryStyles.textLink}><ThemedText style={recoveryStyles.textLinkLabel}>{step === 1 ? 'Back to Settings' : 'Previous step'}</ThemedText></Pressable>
        </View>
      </StepFlowScreen>
      <BirthdayWheelModal presentation="resident" visible={birthdayOpen} value={details.birthDate} onClose={() => setBirthdayOpen(false)} onConfirm={value => {
        setDetails(previous => ({ ...previous, birthDate: value }));
        setFieldErrors(previous => ({ ...previous, birthDate: '' }));
        setBirthdayOpen(false);
      }} />
      <SettingsSheet visible={typePickerOpen} title="Select ID type" onClose={() => setTypePickerOpen(false)}>
        {ID_TYPES.map(type => <Pressable key={type} accessibilityRole="radio" accessibilityLabel={type} accessibilityState={{ checked: idType === type }} onPress={() => { setIdType(type); setTypePickerOpen(false); setError(null); }} style={[styles.option, { borderColor: idType === type ? theme.resident.accentText : theme.resident.border, backgroundColor: idType === type ? theme.resident.accentSoft : theme.resident.surface }]}>
          <ThemedText style={styles.statusText}>{type}</ThemedText><Ionicons name={idType === type ? 'radio-button-on' : 'radio-button-off'} size={22} color={idType === type ? theme.resident.accentText : theme.resident.muted} />
        </Pressable>)}
      </SettingsSheet>
      <Modal visible={cameraOpen} animationType={reduced ? "none" : "slide"} onRequestClose={goBack}>
        <View style={[styles.root, { backgroundColor: theme.resident.card }]}>
          <AuthHeader presentation="resident" title="Front ID photo" onBack={goBack} />
          {cameraOpen ? <CameraView ref={camera} style={styles.camera} facing="back" onCameraReady={() => setCameraReady(true)} onMountError={() => { setCameraOpen(false); setError('Camera unavailable. Please upload an existing photo.'); }} /> : null}
          <View style={styles.cameraControls}><ThemedText>Fit the front of your ID inside the photo.</ThemedText><PrimaryButton presentation="resident" label="Take photo" loading={capturing} disabled={!cameraReady} onPress={() => { void takePhoto(); }} /><PhotoAction label="Cancel" icon="close-outline" disabled={capturing} onPress={() => setCameraOpen(false)} /></View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return <View style={styles.summaryField}><ThemedText type="small" themeColor="textSecondary">{label}</ThemedText><ThemedText>{value}</ThemedText></View>;
}
function PhotoAction({ label, icon, onPress, disabled = false }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return <PrimaryButton presentation="resident" variant="secondary" label={label} onPress={onPress} disabled={disabled} leadingIcon={<Ionicons name={icon} size={20} color={disabled ? theme.resident.muted : theme.resident.text} />} />;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  statusContent: { flexGrow: 1, padding: 16 },
  form: { gap: 12 },
  statusBody: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 16 },
  confirmation: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderWidth: 1, borderRadius: 16 },
  confirmationTitle: { fontSize: 16, lineHeight: 20, fontWeight: '700', marginBottom: 4 },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  statusText: { flex: 1 },
  options: { gap: Spacing.two },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, minHeight: 48, borderRadius: 12, borderWidth: 1 },
  photoFrame: { width: '100%', aspectRatio: 1.6, borderWidth: 1, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  photo: { width: '100%', height: '100%' },
  summaryPhoto: { width: '100%', aspectRatio: 1.6, borderRadius: 12 },
  summary: { borderRadius: 12, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  summaryField: { gap: Spacing.one },
  camera: { flex: 1 },
  cameraControls: { padding: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.three },
});
