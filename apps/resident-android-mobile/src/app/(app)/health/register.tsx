import {
  driveRegistrationSchema,
  residentDriveRegistrationResultSchema,
  type ResidentDriveRegistrationResult,
} from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/avatar';
import {
  HealthDriveSummary,
  HealthFact,
  HealthPanel,
  HealthSheet,
  HealthStatus,
  healthDate,
  healthTime,
} from '@/components/health/health-presentation';
import { PrimaryButton } from '@/components/primary-button';
import { ResidentActionGate } from '@/components/resident-action-gate';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import type { MedicalDrive } from '@/hooks/use-medical-drives';
import { useProfile } from '@/hooks/use-profile';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const COMORBIDITIES = [
  'Hypertension',
  'Diabetes',
  'Immunocompromised',
  'Pregnant',
  'Allergy',
  'None',
] as const;
const DOSES = ['1st Dose', '2nd Dose', 'Booster'] as const;
type Dose = (typeof DOSES)[number];
type Member = { id: string; name: string; relation: string; role?: string | null };

function computeAge(value: string | null | undefined) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  const birth = new Date(y, m - 1, d),
    today = new Date();
  if (!Number.isFinite(birth.getTime())) return null;
  let age = today.getFullYear() - y;
  if (today.getMonth() < m - 1 || (today.getMonth() === m - 1 && today.getDate() < d)) age--;
  return age;
}

function DoseHistoryTabs({ active, onSelect }: { active: Dose; onSelect: (value: Dose) => void }) {
  const { resident } = useTheme();
  const reduced = useResidentReducedMotion(true);
  const index = DOSES.indexOf(active);
  const position = useRef(new Animated.Value(index)).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (reduced) {
      position.setValue(index);
      return;
    }
    const animation = Animated.timing(position, {
      toValue: index,
      duration: 200,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, position, reduced]);
  const cell = Math.max(0, (width - 8) / 3);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Dose History"
      onLayout={(e) => {
        const next = e.nativeEvent.layout.width;
        setWidth((old) => (old === next ? old : next));
      }}
      style={[styles.doseTabs, { backgroundColor: resident.surface }]}
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.doseIndicator,
            {
              backgroundColor: resident.card,
              width: cell,
              transform: [
                {
                  translateX: position.interpolate({
                    inputRange: [0, 1, 2],
                    outputRange: [0, cell, cell * 2],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      {DOSES.map((dose) => (
        <Pressable
          key={dose}
          accessibilityRole="radio"
          accessibilityState={{ checked: active === dose }}
          accessibilityLabel={dose}
          onPress={() => onSelect(dose)}
          style={styles.doseTab}
        >
          <ThemedText
            style={[
              styles.small,
              { fontWeight: '700', color: active === dose ? resident.text : resident.muted },
            ]}
          >
            {dose}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function ApplicantPicker({
  visible,
  onClose,
  members,
  selected,
  onSelect,
  residentName,
  avatar,
}: {
  visible: boolean;
  onClose: () => void;
  members: Member[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  residentName: string;
  avatar: string | null;
}) {
  const { resident } = useTheme();
  return (
    <HealthSheet title="Registering for" visible={visible} onClose={onClose}>
      {[{ id: null, name: residentName, relation: 'Myself (Resident)', role: null }, ...members].map(
        (member) => (
          <Pressable
            key={member.id ?? 'self'}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected === member.id }}
            accessibilityLabel={member.name}
            onPress={() => {
              onSelect(member.id);
              onClose();
            }}
            style={[
              styles.pickerRow,
              {
                backgroundColor: selected === member.id ? resident.accentSoft : resident.card,
                borderColor: resident.border,
              },
            ]}
          >
            <Avatar
              fullName={member.name}
              imageUrl={member.id === null ? avatar : null}
              size={44}
              color={resident.accentSoft}
              foregroundColor={resident.accentText}
            />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.subheading}>{member.name}</ThemedText>
              <ThemedText style={[styles.small, { color: resident.muted }]}>
                {member.relation}
                {member.role ? ` · ${member.role}` : ''}
              </ThemedText>
            </View>
            {selected === member.id ? (
              <Ionicons name="checkmark-circle" size={22} color={resident.accentText} />
            ) : null}
          </Pressable>
        ),
      )}
      {members.length === 0 ? (
        <>
          <ThemedText style={[styles.small, { color: resident.muted }]}>
            No household members added yet. Go to Profile → Household Information to add them.
          </ThemedText>
          <PrimaryButton
            presentation="resident"
            variant="secondary"
            label="Go to Profile"
            onPress={() => {
              onClose();
              router.push('/(app)/settings/profile');
            }}
          />
        </>
      ) : null}
    </HealthSheet>
  );
}

export default function ApplicantRegistrationScreen() {
  const { driveId } = useLocalSearchParams<{ driveId?: string }>();
  const { session } = useAuth();
  return (
    <ResidentActionGate>
      <ApplicantRegistrationScreenContent key={`${session?.user.id ?? 'guest'}:${driveId ?? 'missing'}`} />
    </ResidentActionGate>
  );
}

function ApplicantRegistrationScreenContent() {
  const { resident } = useTheme();
  const insets = useSafeAreaInsets();
  const { driveId } = useLocalSearchParams<{ driveId?: string }>();
  const { session } = useAuth();
  const { profile, isLoading: profileLoading, refetch: refetchProfile } = useProfile();
  const reduced = useResidentReducedMotion(true);
  const [drive, setDrive] = useState<MedicalDrive | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const raw = profile?.household_members;
  const members: Member[] = Array.isArray(raw)
    ? raw.filter(
        (m): m is Member =>
          typeof m === 'object' &&
          m !== null &&
          !Array.isArray(m) &&
          typeof m.id === 'string' &&
          typeof m.name === 'string' &&
          typeof m.relation === 'string' &&
          (m.role == null || typeof m.role === 'string'),
      )
    : [];
  const selectedMember = members.find((m) => m.id === selectedId);
  const selectedName = selectedMember?.name ?? profile?.full_name ?? 'My Profile';
  const [age, setAge] = useState('');
  const [pwd, setPwd] = useState(false);
  const [comorbidities, setComorbidities] = useState<string[]>([]);
  const [dose, setDose] = useState<Dose>('1st Dose');
  const [priorDate, setPriorDate] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ResidentDriveRegistrationResult | null>(null);
  const submitLock = useRef(false);
  const generation = useRef(0);
  const success = useRef(new Animated.Value(0)).current;
  const successPlayed = useRef(false);
  const userId = session?.user.id;
  useEffect(() => {
    const ticket = ++generation.current;
    return () => {
      generation.current = ticket + 1;
    };
  }, [driveId, userId]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    if (!driveId) {
      setLoadError('This medical drive link is missing its identifier.');
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const { data, error } = await supabase.from('medical_drives').select('*').eq('id', driveId).single();
        if (cancelled) return;
        if (error || !data) throw new Error('Could not load drive details. Please try again.');
        setDrive(data as MedicalDrive);
      } catch {
        if (!cancelled) setLoadError('Could not load drive details. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [driveId, reload]);
  useEffect(() => {
    if (!result) return;
    if (successPlayed.current || reduced) {
      success.setValue(1);
      successPlayed.current = true;
      return;
    }
    successPlayed.current = true;
    const animation = Animated.timing(success, {
      toValue: 1,
      duration: 240,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [result, reduced, success]);
  const profileAge = selectedId === null ? computeAge(profile?.birth_date) : null;
  const vaccination = drive?.type === 'vaccination';
  const needsPriorDate = vaccination && dose !== '1st Dose';
  function toggleComorbidity(value: string) {
    setComorbidities((previous) =>
      value === 'None'
        ? previous.includes(value)
          ? []
          : ['None']
        : previous.includes(value)
          ? previous.filter((v) => v !== value)
          : [...previous.filter((v) => v !== 'None'), value],
    );
  }
  async function submit() {
    if (submitLock.current || result) return;
    if (!session || !drive || !profile) {
      setSubmitError('Your resident profile is unavailable. Please return to Health and try again.');
      return;
    }
    if (!consent) {
      setSubmitError('Please check the consent box before registering.');
      return;
    }
    if (selectedId !== null && !selectedMember) {
      setSubmitError('This household member is no longer available. Choose a registrant again.');
      return;
    }
    const input = driveRegistrationSchema.safeParse({
      driveId: drive.id,
      age: profileAge ?? (/^\d{1,3}$/.test(age.trim()) ? Number(age) : NaN),
      isPwd: pwd,
      comorbidities: comorbidities.filter((c) => c !== 'None'),
      priorDoseDate: needsPriorDate ? priorDate : undefined,
    });
    if (!input.success) {
      setSubmitError(
        needsPriorDate && !/^\d{4}-\d{2}-\d{2}$/.test(priorDate)
          ? 'Enter the previous dose date as YYYY-MM-DD.'
          : 'Enter a valid age (0–130) and a valid previous dose date, if needed.',
      );
      return;
    }
    const dateParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const today = ['year', 'month', 'day']
      .map((type) => dateParts.find((part) => part.type === type)?.value)
      .join('-');
    if (input.data.priorDoseDate && input.data.priorDoseDate > today) {
      setSubmitError('The previous dose date cannot be in the future.');
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);
    const ticket = generation.current;
    try {
      const { data, error } = await supabase.rpc('register_for_drive', {
        p_drive_id: input.data.driveId,
        p_age: input.data.age,
        p_is_pwd: input.data.isPwd,
        p_comorbidities: input.data.comorbidities,
        p_prior_dose_date: input.data.priorDoseDate,
      });
      if (error) throw new Error(error.message);
      const confirmed = residentDriveRegistrationResultSchema.safeParse(data);
      if (!confirmed.success) {
        throw new Error(
          'The registration response could not be confirmed. Check My Registrations before trying again.',
        );
      }
      if (ticket === generation.current) setResult(confirmed.data);
    } catch (error: unknown) {
      if (ticket === generation.current)
        setSubmitError(error instanceof Error ? error.message : 'Registration failed. Please try again.');
      submitLock.current = false;
    } finally {
      if (ticket === generation.current) setSubmitting(false);
    }
  }
  const back = () => router.back();
  const header = <ServiceScreenHeader title="Applicant Registration" onBack={back} />;
  if (loading || profileLoading)
    return (
      <View style={[styles.root, { backgroundColor: resident.card }]}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={resident.accentText} />
        </View>
      </View>
    );
  if (loadError || !drive)
    return (
      <View style={[styles.root, { backgroundColor: resident.card }]}>
        {header}
        <View style={styles.center}>
          <ThemedText accessibilityRole="alert">{loadError ?? 'Drive details are unavailable.'}</ThemedText>
          <PrimaryButton
            presentation="resident"
            label="Retry drive details"
            onPress={() => setReload((n) => n + 1)}
          />
          <PrimaryButton presentation="resident" variant="secondary" label="Back to Health" onPress={back} />
        </View>
      </View>
    );
  if (!profile)
    return (
      <View style={[styles.root, { backgroundColor: resident.card }]}>
        {header}
        <View style={styles.center}>
          <ThemedText accessibilityRole="alert">
            Your resident profile is unavailable. Reconnect and try again.
          </ThemedText>
          <PrimaryButton presentation="resident" label="Retry profile" onPress={refetchProfile} />
          <PrimaryButton presentation="resident" variant="secondary" label="Back to Health" onPress={back} />
        </View>
      </View>
    );
  if (result)
    return (
      <View style={[styles.root, { backgroundColor: resident.card }]}>
        {header}
        <ScrollView contentContainerStyle={[styles.success, { paddingBottom: insets.bottom + 40 }]}>
          <Animated.View
            style={[
              styles.successIcon,
              {
                backgroundColor: resident.accent,
                opacity: success,
                transform: reduced
                  ? []
                  : [{ scale: success.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
              },
            ]}
          >
            <Ionicons name="checkmark" size={36} color={resident.onAccent} />
          </Animated.View>
          <ThemedText
            accessibilityRole="header"
            style={[styles.successTitle, { color: resident.accentText }]}
          >
            Registration submitted!
          </ThemedText>
          <HealthStatus status={result.status} />
          <ThemedText style={[styles.successNote, { color: resident.muted }]}>
            {result.status === 'pending'
              ? 'Your application has been received and is awaiting barangay review.'
              : `Your registration for ${drive.title} is ${result.status}.`}
          </ThemedText>
          <View
            style={[
              styles.numberCard,
              { backgroundColor: resident.accentSoft, borderColor: resident.border },
            ]}
          >
            <ThemedText style={[styles.small, { color: resident.accentText }]}>
              Your Applicant Number
            </ThemedText>
            <ThemedText selectable style={[styles.number, { color: resident.accentText }]}>
              {result.applicant_number}
            </ThemedText>
          </View>
          <ThemedText style={[styles.successNote, { color: resident.muted }]}>
            Drive schedule: {healthDate(drive.drive_date)} · {healthTime(drive.time_start)}–
            {healthTime(drive.time_end)} at {drive.location}. Check My Registrations for updates.
          </ThemedText>
          <View style={{ alignSelf: 'stretch' }}>
            <PrimaryButton presentation="resident" label="Done" onPress={back} />
          </View>
        </ScrollView>
      </View>
    );
  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: resident.card }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {header}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <HealthPanel>
          <HealthDriveSummary drive={drive} />
        </HealthPanel>
        <View
          style={[styles.numberCard, { backgroundColor: resident.accentSoft, borderColor: resident.border }]}
        >
          <ThemedText style={[styles.small, { color: resident.accentText, fontWeight: '600' }]}>
            Your Applicant Number
          </ThemedText>
          <ThemedText style={[styles.small, { color: resident.accentText }]}>
            Assigned after submission
          </ThemedText>
        </View>
        <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
          Registering for
        </ThemedText>
        <HealthPanel>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change registrant"
            onPress={() => setPickerVisible(true)}
            style={styles.pickerRow}
          >
            <Avatar
              fullName={selectedName}
              imageUrl={selectedId === null ? profile?.avatar_url : null}
              size={44}
              color={resident.accentSoft}
              foregroundColor={resident.accentText}
            />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.subheading}>{selectedName}</ThemedText>
              <ThemedText style={[styles.small, { color: resident.muted }]}>
                {selectedMember?.relation ?? 'You'}
              </ThemedText>
            </View>
            <ThemedText style={[styles.small, { color: resident.accentText, fontWeight: '700' }]}>
              Change
            </ThemedText>
            <Ionicons name="chevron-down" size={16} color={resident.accentText} />
          </Pressable>
          <HealthFact label="Name" value={selectedName} />
          {selectedMember ? (
            <>
              <HealthFact label="Relation" value={selectedMember.relation} />
              <HealthFact label="Role" value={selectedMember.role ?? '—'} />
            </>
          ) : null}
          {profileAge !== null ? (
            <HealthFact label="Age" value={String(profileAge)} />
          ) : (
            <View style={styles.field}>
              <TextField
                presentation="resident"
                label="Age"
                accessibilityLabel="Age"
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="Enter age"
              />
            </View>
          )}
          {selectedId === null ? <HealthFact label="Address" value={profile?.home_address ?? '—'} /> : null}
          <View style={styles.field}>
            <ThemedText style={[styles.small, { color: resident.muted }]}>
              Registrations are saved to your signed-in account. Household member identity is not recorded by
              this service.
            </ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(app)/settings/profile')}
            style={styles.editLink}
          >
            <ThemedText style={[styles.small, { color: resident.accentText, fontWeight: '700' }]}>
              Edit in Profile
            </ThemedText>
          </Pressable>
        </HealthPanel>
        <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
          Eligibility Information
        </ThemedText>
        <HealthPanel>
          <View style={styles.pwdRow}>
            <ThemedText style={[styles.subheading, { flex: 1 }]}>Person with Disability (PWD)?</ThemedText>
            <Switch
              accessibilityLabel="Person with Disability (PWD)?"
              value={pwd}
              onValueChange={setPwd}
              trackColor={{ false: resident.border, true: resident.accentSoft }}
              thumbColor={pwd ? resident.accentText : resident.muted}
            />
          </View>
          <View style={[styles.eligibility, { borderColor: resident.border }]}>
            <ThemedText style={styles.subheading}>Comorbidities (select all that apply)</ThemedText>
            <View style={styles.chips}>
              {COMORBIDITIES.map((value) => {
                const checked = comorbidities.includes(value);
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="checkbox"
                    accessibilityLabel={value}
                    accessibilityState={{ checked }}
                    onPress={() => toggleComorbidity(value)}
                    style={[
                      styles.chip,
                      {
                        borderColor: checked ? resident.accentText : resident.border,
                        backgroundColor: checked ? resident.accentSoft : resident.card,
                      },
                    ]}
                  >
                    {checked ? <Ionicons name="checkmark" size={14} color={resident.accentText} /> : null}
                    <ThemedText
                      style={[styles.small, { color: checked ? resident.accentText : resident.text }]}
                    >
                      {value}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {vaccination ? (
            <View style={[styles.eligibility, { borderColor: resident.border }]}>
              <ThemedText style={styles.subheading}>Dose History</ThemedText>
              <DoseHistoryTabs active={dose} onSelect={setDose} />
              {needsPriorDate ? (
                <TextField
                  presentation="resident"
                  label="Previous dose date"
                  value={priorDate}
                  onChangeText={setPriorDate}
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                  autoCapitalize="none"
                />
              ) : null}
            </View>
          ) : null}
        </HealthPanel>
        <View style={[styles.privacy, { backgroundColor: resident.surface }]}>
          <View style={styles.notice}>
            <Ionicons name="shield-checkmark-outline" size={18} color={resident.accentText} />
            <ThemedText style={[styles.small, { flex: 1, color: resident.muted }]}>
              This information is used only to determine allocation priority for this drive and is handled
              under the Barangay's Data Privacy Policy.
            </ThemedText>
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="I understand and consent"
            accessibilityState={{ checked: consent }}
            onPress={() => setConsent((v) => !v)}
            style={styles.consent}
          >
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: consent ? resident.accent : resident.card,
                  borderColor: consent ? resident.accentText : resident.controlBorder,
                },
              ]}
            >
              {consent ? <Ionicons name="checkmark" size={16} color={resident.onAccent} /> : null}
            </View>
            <ThemedText style={[styles.subheading, { flex: 1 }]}>I understand and consent</ThemedText>
          </Pressable>
        </View>
        {submitError ? (
          <ThemedText accessibilityRole="alert" style={{ color: resident.danger }}>
            {submitError}
          </ThemedText>
        ) : null}
      </ScrollView>
      <View
        style={[
          styles.footer,
          {
            backgroundColor: resident.card,
            borderColor: resident.border,
            paddingBottom: Math.max(16, insets.bottom),
          },
        ]}
      >
        <PrimaryButton
          presentation="resident"
          appearance="healthForm"
          label={drive.stock_remaining <= 0 ? 'No Slots Available' : 'Submit Registration'}
          loading={submitting}
          disabled={!consent || drive.stock_remaining <= 0 || !profile || profileLoading}
          onPress={() => {
            void submit();
          }}
        />
      </View>
      <ApplicantPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        members={members}
        selected={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setAge('');
        }}
        residentName={profile?.full_name ?? 'My Profile'}
        avatar={profile?.avatar_url ?? null}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: 20, gap: 16 },
  content: { padding: 20, gap: 16, paddingBottom: 24 },
  sectionTitle: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  subheading: { fontSize: 14.5, lineHeight: 22, fontWeight: '700' },
  small: { fontSize: 13.5, lineHeight: 20 },
  numberCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 4, alignSelf: 'stretch' },
  number: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1 },
  field: { padding: 16 },
  editLink: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  pwdRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  eligibility: { padding: 16, gap: 12, borderTopWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  privacy: { borderRadius: 16, padding: 16, gap: 12 },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  consent: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  doseTabs: { position: 'relative', flexDirection: 'row', padding: 4, borderRadius: 12 },
  doseIndicator: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 8 },
  doseTab: { flex: 1, minHeight: 44, padding: 8, alignItems: 'center', justifyContent: 'center' },
  success: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 20, paddingTop: 40, gap: 16 },
  successIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 24, lineHeight: 30, fontWeight: '800', textAlign: 'center' },
  successNote: { fontSize: 14.5, lineHeight: 22, textAlign: 'center' },
});
