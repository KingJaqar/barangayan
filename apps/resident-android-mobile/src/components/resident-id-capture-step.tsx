import { idConfirmedDetailsSchema, idTypeRequiresBack, ID_TYPES, OTHER_ID_TYPE_PREFIX, publishIdEvidence, type IdConfirmedDetails } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AuthHeader } from '@/components/auth-header';
import { BirthdayWheelModal } from '@/components/birthday-wheel-modal';
import { RecoveryError, recoveryStyles, StepFlowScreen } from '@/components/password-recovery-screen';
import { PrimaryButton } from '@/components/primary-button';
import { SettingsSheet } from '@/components/settings-sheet';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { ID_RESUBMIT_BLOCKED_MESSAGE } from '@/lib/id-resubmit-limit';
import { ACCEPTED_IMAGE_MIME_TYPES, imageExtension, pickImageAsset, readImageBytes, type PickedImage } from '@/lib/image-upload';
import { extractIdDetails } from '@/lib/valid-id';
import { idPhotoBytes } from '@/lib/id-photo-bytes';
import { birthdayLabel } from '@/lib/birthday-wheel';
import { supabase } from '@/lib/supabase';

const EMPTY_DETAILS: IdConfirmedDetails = { fullName: '', idNumber: '', birthDate: '', address: '' };
type PhotoSide = 'front' | 'back';
type IdPhoto = { uri: string; path: string };
function steps(requiresBack: boolean, idType: string) {
  return [
    { title: 'Select ID type', description: 'Choose the valid ID you want to submit for verification.' },
    requiresBack
      ? { title: 'Provide ID photos', description: 'Upload or take a clear photo of the front and the back of your ID. Both are required.' }
      : { title: 'Provide an ID photo', description: `Upload or take a clear photo of ${idType === 'Passport' ? 'the photo page of your passport' : 'the front of your ID'}. A back photo is not required.` },
    { title: 'Review and confirm details', description: 'Correct any mistakes in the details read from your ID. Leave optional fields blank if your ID does not show them.' },
    { title: 'Review and submit', description: `Review your ${requiresBack ? 'ID photos' : 'ID photo'} and confirmed details. Submit them for barangay verification.` },
  ];
}
const FIELDS = [
  { key: 'fullName', label: 'Full name', maxLength: 200 },
  { key: 'idNumber', label: 'ID number (if shown)', maxLength: 200 },
  { key: 'birthDate', label: 'Date of birth (if shown)', maxLength: 10 },
  { key: 'address', label: 'Address (if shown)', maxLength: 1000 },
] as const;

export type ResidentIdCaptureStepProps = {
  /** Label of the first step's back link, e.g. "Back to Settings". */
  exitLabel: string;
  /** Called when the resident leaves from the first step (back link, header, hardware back). */
  onExit: () => void;
  /** Called once the ID evidence has been published. */
  onSubmitted: () => void;
  /** The resident's existing ID verification, shown on the first step when one is on file. */
  currentStatus?: { status: string; verified: boolean };
};

/** The four-step valid-ID wizard (type, photo(s), confirm details, submit) shared by Settings and account setup. */
export function ResidentIdCaptureStep({ exitLabel, onExit, onSubmitted, currentStatus }: ResidentIdCaptureStepProps) {
  const theme = useTheme();
  const reduced = useResidentReducedMotion(true);
  const { session } = useAuth();
  const [step, setStep] = useState(1);
  const [idType, setIdType] = useState<string>('');
  const [otherIdType, setOtherIdType] = useState('');
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [birthdayOpen, setBirthdayOpen] = useState(false);
  const [photo, setPhoto] = useState<IdPhoto | null>(null);
  const [backPhoto, setBackPhoto] = useState<IdPhoto | null>(null);
  const [cameraSide, setCameraSide] = useState<PhotoSide>('front');
  const [details, setDetails] = useState<IdConfirmedDetails>(EMPTY_DETAILS);
  const [detailsReady, setDetailsReady] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
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
  const requiresBack = idTypeRequiresBack(selectedType);
  const photosReady = !!photo && (!requiresBack || !!backPhoto);

  function goBack() {
    if (busyRef.current || capturing) return;
    if (birthdayOpen) { setBirthdayOpen(false); return; }
    if (typePickerOpen) { setTypePickerOpen(false); return; }
    if (cameraOpen) { setCameraOpen(false); return; }
    Keyboard.dismiss();
    setError(null);
    if (step === 1) onExit();
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
  }, [step, cameraOpen, typePickerOpen, birthdayOpen, capturing]));

  async function readDetails(path: string, userId: string) {
    setReadingError(null);
    try {
      const extracted = await extractIdDetails(path, selectedType);
      if (current(userId)) { setDetails(extracted); setDetailsReady(true); }
    } catch (cause) {
      if (current(userId)) setReadingError(cause instanceof Error ? cause.message : 'We could not read this photo. Retry or enter its details manually.');
    }
  }

  async function providePhoto(picked: PickedImage, side: PhotoSide, capturedBytes?: Uint8Array) {
    const userId = session?.user.id;
    if (!userId || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      if (!ACCEPTED_IMAGE_MIME_TYPES.includes(picked.mimeType as typeof ACCEPTED_IMAGE_MIME_TYPES[number])) throw new Error('Choose a JPG, PNG, or WebP photo.');
      if (picked.size !== null && picked.size > 5 * 1024 * 1024) throw new Error('Choose a photo no larger than 5 MB.');
      const bytes = capturedBytes ?? await readImageBytes(picked);
      if (!current(userId)) return;
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('Choose a photo no larger than 5 MB.');
      const path = `${userId}/versions/${randomUUID()}/id-${side}.${imageExtension(picked.mimeType)}`;
      const { error: uploadError } = await supabase.storage.from('id-documents').upload(path, bytes, { contentType: picked.mimeType, upsert: false });
      if (uploadError) throw new Error('Could not upload your ID photo. Check your connection and try again.');
      if (!current(userId)) return;
      publication.current = null;
      if (side === 'back') { setBackPhoto({ uri: picked.uri, path }); return; }
      setPhoto({ uri: picked.uri, path }); setDetails(EMPTY_DETAILS); setDetailsReady(false); setFieldErrors({});
      await readDetails(path, userId);
    } catch (cause) {
      if (current(userId)) setError(cause instanceof Error ? cause.message : 'Could not upload your photo. Please try again.');
    } finally {
      busyRef.current = false;
      if (current(userId)) setBusy(false);
    }
  }

  async function choosePhoto(side: PhotoSide) {
    if (busyRef.current) return;
    const userId = session?.user.id;
    setError(null);
    try { const picked = await pickImageAsset(); if (picked && userId && current(userId)) await providePhoto(picked, side); }
    catch { if (active.current) setError('Could not open your photos. Please try again.'); }
  }

  async function openCamera(side: PhotoSide) {
    setError(null);
    try {
      const result = permission?.granted ? permission : await requestPermission();
      if (!result.granted) { setError('Allow camera access to take an ID photo, or upload an existing photo.'); return; }
      setCameraSide(side); setCameraReady(false); setCameraOpen(true);
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
      await providePhoto({ uri: captured.uri, mimeType: 'image/jpeg', size: bytes.length, name: `id-${cameraSide}.jpg` }, cameraSide, bytes);
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
    if (step === 2 && (!photosReady || !detailsReady)) return;
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
    if (!userId || !photo || !photosReady || busyRef.current || submitted || step !== 4) return;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      const confirmedDetails = idConfirmedDetailsSchema.parse(details);
      const backPath = requiresBack ? backPhoto?.path : undefined;
      const signature = JSON.stringify([selectedType, photo.path, backPath ?? null, confirmedDetails]);
      if (publication.current?.signature !== signature) publication.current = { signature, id: randomUUID() };
      await publishIdEvidence(supabase, { submissionId: publication.current.id, idType: selectedType, frontPath: photo.path, ...(backPath ? { backPath } : {}), confirmedDetails });
      if (current(userId)) { setSubmitted(true); onSubmitted(); }
    } catch (cause) {
      if (current(userId)) {
        const message = cause instanceof Error ? cause.message : '';
        setError(message.includes('id_resubmission_rate_limited') ? ID_RESUBMIT_BLOCKED_MESSAGE : message || 'Could not submit your ID. Please try again.');
      }
    } finally { busyRef.current = false; if (current(userId)) setBusy(false); }
  }

  const stepList = steps(requiresBack, selectedType);
  const intro = stepList[step - 1] ?? stepList[0];
  const FormContainer = Platform.OS === 'android' ? KeyboardAvoidingView : View;
  const keyboardProps = Platform.OS === 'android' ? { behavior: 'height' as const } : {};
  return (
    <FormContainer {...keyboardProps} style={[styles.root, { backgroundColor: theme.resident.card }]}>
      <AuthHeader presentation="resident" title="Valid ID" onBack={goBack} />
      <StepFlowScreen presentation="resident" compact step={step} totalSteps={4} flowLabel="Valid ID submission" title={intro.title} description={intro.description}>
        <View style={styles.form}>
            {step === 1 ? <>
              {currentStatus ? <View style={styles.status}>
                <Ionicons name={currentStatus.verified ? 'checkmark-circle' : 'warning'} size={20} color={currentStatus.verified ? theme.resident.success : theme.resident.danger} />
                <ThemedText type="small" style={styles.statusText}>{currentStatus.verified ? 'Your current ID is verified. A new submission will need verification again.' : currentStatus.status === 'pending' ? 'Your current ID is pending verification. You may submit a replacement.' : 'Your ID has not been verified. Submit a clear photo for review.'}</ThemedText>
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
              {(requiresBack ? ['front', 'back'] as const : ['front'] as const).map(side => {
                const shown = side === 'front' ? photo : backPhoto;
                const word = requiresBack ? `${side} ` : '';
                const frameText = !requiresBack ? (selectedType === 'Passport' ? 'Photo page only' : 'Front of ID only') : side === 'front' ? 'Front of ID' : 'Back of ID';
                return <View key={side} style={styles.photoSide}>
                  {requiresBack ? <ThemedText type="small">{side === 'front' ? 'Front of ID' : 'Back of ID'}</ThemedText> : null}
                  <View style={[styles.photoFrame, styles.photoFrameCompact, { borderColor: shown ? theme.resident.accentText : theme.resident.border, backgroundColor: shown ? theme.resident.accentSoft : theme.resident.surface }]}>
                    {shown ? <Image source={{ uri: shown.uri }} style={styles.photo} contentFit="contain" accessibilityLabel={`Selected ${side} ID photo`} /> : <><Ionicons name="card-outline" size={32} color={theme.resident.accentText} /><ThemedText themeColor="textSecondary">{frameText}</ThemedText></>}
                  </View>
                  <View style={styles.photoActions}>
                    <View style={styles.photoAction}><PhotoAction accent compact label={shown ? 'Replace' : 'Upload'} accessibilityLabel={shown ? `Upload a different ${word}photo` : `Upload a ${word}photo`} icon="cloud-upload-outline" disabled={busy} onPress={() => { void choosePhoto(side); }} /></View>
                    <View style={styles.photoAction}><PhotoAction accent compact label={shown ? 'Retake' : 'Camera'} accessibilityLabel={shown ? `Take a new ${word}photo` : `Take a ${word}photo`} icon="camera-outline" disabled={busy} onPress={() => { void openCamera(side); }} /></View>
                  </View>
                </View>;
              })}
              {permission && !permission.granted && !permission.canAskAgain ? <PhotoAction label="Open camera permissions" icon="settings-outline" disabled={busy} onPress={() => { void Linking.openSettings(); }} /> : null}
              {requiresBack && photo && !backPhoto && !busy ? <ThemedText type="small" themeColor="textSecondary">Add the back of your ID to continue.</ThemedText> : null}
              <ThemedText type="small" themeColor="textSecondary">Keep all corners visible and avoid blur or glare. JPG, PNG, or WebP, up to 5 MB.</ThemedText>
              {busy ? <ThemedText type="small" accessibilityLiveRegion="polite">Uploading and reading your ID photo…</ThemedText> : null}
              <RecoveryError presentation="resident" message={readingError} />
              {photo && !detailsReady && !busy ? <View style={styles.photoActions}>
                <View style={styles.photoAction}><PhotoAction accent compact label="Retry" accessibilityLabel="Try reading the photo again" icon="refresh-outline" onPress={() => { void retryReading(); }} /></View>
                <View style={styles.photoAction}><PhotoAction accent compact label="Manual entry" accessibilityLabel="Enter details manually" icon="create-outline" disabled={!photosReady} onPress={() => { setDetailsReady(true); setStep(3); }} /></View>
              </View> : null}
            </> : null}
            {step === 3 ? <>
              {FIELDS.map(field => field.key === 'birthDate' ? <View key={field.key} style={styles.options}>
                <ThemedText type="small">{field.label}</ThemedText>
                <Pressable accessibilityRole="button" accessibilityLabel={field.label} accessibilityHint="Opens month, day and year wheels" accessibilityValue={{ text: details.birthDate ? birthdayLabel(details.birthDate) : 'Not selected' }} onPress={() => { Keyboard.dismiss(); setBirthdayOpen(true); }} style={[styles.option, styles.compactOption, { borderColor: fieldErrors.birthDate ? theme.resident.danger : theme.resident.border }]}>
                  <ThemedText style={styles.statusText} themeColor={details.birthDate ? 'text' : 'textSecondary'}>{birthdayLabel(details.birthDate)}</ThemedText>
                  <Ionicons name="calendar-outline" size={20} color={theme.resident.accentText} />
                </Pressable>
                {fieldErrors.birthDate ? <RecoveryError presentation="resident" message={fieldErrors.birthDate} /> : null}
              </View> : <TextField presentation="resident" key={field.key} label={field.label} required={field.key === 'fullName'} accessibilityLabel={field.label} value={details[field.key]} maxLength={field.maxLength} autoCorrect={false} autoCapitalize={field.key === 'idNumber' ? 'characters' : 'words'} multiline={field.key === 'address'} onChangeText={value => { setDetails(previous => ({ ...previous, [field.key]: value })); setFieldErrors(previous => ({ ...previous, [field.key]: '' })); }} error={fieldErrors[field.key]} style={[styles.compactField, { backgroundColor: theme.resident.card }]} />)}
            </> : null}
            {step === 4 && photo ? <>
              <Image source={{ uri: photo.uri }} style={[styles.summaryPhoto, { backgroundColor: theme.resident.surface }]} contentFit="contain" accessibilityLabel="Front ID photo to submit" />
              {requiresBack && backPhoto ? <Image source={{ uri: backPhoto.uri }} style={[styles.summaryPhoto, { backgroundColor: theme.resident.surface }]} contentFit="contain" accessibilityLabel="Back ID photo to submit" /> : null}
              <View style={[styles.summary, { borderColor: theme.resident.border }]}>
                <SummaryField label="ID type" value={selectedType} />
                {FIELDS.map(field => <SummaryField key={field.key} label={field.label} value={details[field.key] || 'Not shown on ID'} />)}
              </View>
              <ThemedText type="small" themeColor="textSecondary">Submitting sends this photo and your confirmed details to the barangay for review.</ThemedText>
            </> : null}
            <RecoveryError presentation="resident" message={error} />
            <PrimaryButton presentation="resident" compact label={step === 4 ? 'Submit' : 'Continue'} loading={busy} disabled={step === 1 ? !idType || (idType === 'Other' && !otherIdType.trim()) : step === 2 ? !photosReady || !detailsReady : false} onPress={step === 4 ? () => { void submit(); } : continueFlow} />
            <Pressable accessibilityRole="button" accessibilityLabel={step === 1 ? exitLabel : 'Previous step'} disabled={busy} onPress={goBack} style={recoveryStyles.textLink}><ThemedText style={recoveryStyles.textLinkLabel}>{step === 1 ? exitLabel : 'Previous step'}</ThemedText></Pressable>
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
          <AuthHeader presentation="resident" title={cameraSide === 'back' ? 'Back ID photo' : 'Front ID photo'} onBack={goBack} />
          {cameraOpen ? <CameraView ref={camera} style={styles.camera} facing="back" onCameraReady={() => setCameraReady(true)} onMountError={() => { setCameraOpen(false); setError('Camera unavailable. Please upload an existing photo.'); }} /> : null}
          <View style={styles.cameraControls}><ThemedText>{cameraSide === 'back' ? 'Fit the back of your ID inside the photo.' : requiresBack || selectedType !== 'Passport' ? 'Fit the front of your ID inside the photo.' : 'Fit the photo page of your passport inside the photo.'}</ThemedText><PrimaryButton presentation="resident" label="Take photo" loading={capturing} disabled={!cameraReady} onPress={() => { void takePhoto(); }} /><PhotoAction label="Cancel" icon="close-outline" disabled={capturing} onPress={() => setCameraOpen(false)} /></View>
        </View>
      </Modal>
    </FormContainer>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return <View style={styles.summaryField}><ThemedText type="small" themeColor="textSecondary">{label}</ThemedText><ThemedText>{value}</ThemedText></View>;
}
function PhotoAction({ label, icon, onPress, disabled = false, accent = false, compact = false, accessibilityLabel }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; accent?: boolean; compact?: boolean; accessibilityLabel?: string }) {
  const theme = useTheme();
  const iconColor = disabled ? theme.resident.muted : accent ? theme.resident.accentText : theme.resident.text;
  return <PrimaryButton presentation="resident" variant={accent ? 'secondaryAccent' : 'secondary'} compact={compact} label={label} accessibilityLabel={accessibilityLabel} onPress={onPress} disabled={disabled} leadingIcon={<Ionicons name={icon} size={compact ? 18 : 20} color={iconColor} />} />;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  form: { gap: 12 },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  statusText: { flex: 1 },
  options: { gap: Spacing.two },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, minHeight: 48, borderRadius: 12, borderWidth: 1 },
  photoFrame: { width: '100%', aspectRatio: 1.6, borderWidth: 1, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  compactField: { minHeight: 44, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, fontSize: 15 },
  compactOption: { minHeight: 44, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  photoSide: { gap: Spacing.one },
  photoFrameCompact: { aspectRatio: 2.4, gap: Spacing.one },
  photoActions: { flexDirection: 'row', gap: Spacing.two },
  photoAction: { flex: 1 },
  photo: { width: '100%', height: '100%' },
  summaryPhoto: { width: '100%', aspectRatio: 1.6, borderRadius: 12 },
  summary: { borderRadius: 12, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  summaryField: { gap: Spacing.one },
  camera: { flex: 1 },
  cameraControls: { padding: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.three },
});
