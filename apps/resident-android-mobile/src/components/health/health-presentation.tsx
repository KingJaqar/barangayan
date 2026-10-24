import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DRIVE_TYPE_CONFIG } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/primary-button';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import type { MedicalDrive } from '@/hooks/use-medical-drives';
import { useReportModalMotion } from '@/hooks/use-report-modal-motion';
import { useTheme } from '@/hooks/use-theme';

/** Presentation tones follow the current palette, including custom accents and dark mode. */
export function healthTypeColor(type: string, resident: ReturnType<typeof useTheme>['resident']) {
  switch (type) {
    case 'vaccination':
    case 'emergency_kit': return resident.info;
    case 'maternal_care':
    case 'optical': return resident.rose;
    case 'blood_drive':
    case 'minor_surgical': return resident.danger;
    case 'dental':
    case 'screening': return resident.warning;
    case 'medicine':
    case 'consultation': return resident.accentText;
    default: return resident.muted;
  }
}

export function healthDate(iso: string, full = false) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString(
    'en-US',
    full ? { weekday: 'long', month: 'long', day: 'numeric' } : { month: 'short', day: 'numeric' },
  );
}

export function healthTime(time: string) {
  const [hour, minute = '00'] = time.split(':');
  const h = Number(hour);
  return `${h % 12 || 12}:${minute} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function HealthPanel({ children }: { children: ReactNode }) {
  const { resident } = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: resident.card, borderColor: resident.border }]}>
      {children}
    </View>
  );
}

export function HealthFact({ label, value }: { label: string; value: string }) {
  const { resident } = useTheme();
  return (
    <View style={[styles.fact, { borderColor: resident.border }]}>
      <ThemedText style={[styles.factLabel, { color: resident.muted }]}>{label}</ThemedText>
      <ThemedText style={styles.factValue}>{value}</ThemedText>
    </View>
  );
}

export function HealthStatus({ status }: { status: string }) {
  const { resident } = useTheme();
  const colors: Record<string, string> = {
    pending: resident.warning,
    confirmed: resident.accentText,
    attended: resident.info,
    cancelled: resident.danger,
  };
  const label = status ? status[0].toUpperCase() + status.slice(1) : 'Status unavailable';
  return (
    <View style={[styles.status, { backgroundColor: resident.surface }]}>
      <View style={[styles.dot, { backgroundColor: colors[status] ?? resident.muted }]} />
      <ThemedText style={[styles.statusText, { color: colors[status] ?? resident.muted }]}>
        {label}
      </ThemedText>
    </View>
  );
}

/** Used by the drive list and registration form; all actions stay with the caller. */
export function HealthDriveSummary({
  drive,
  registered,
  onRegister,
}: {
  drive: MedicalDrive;
  registered?: boolean;
  onRegister?: () => void;
}) {
  const { resident } = useTheme();
  const category = DRIVE_TYPE_CONFIG[drive.type] ?? DRIVE_TYPE_CONFIG.others;
  const full = drive.stock_remaining <= 0;
  return (
    <View style={styles.drive}>
      <View style={styles.titleRow}>
        <ThemedText accessibilityRole="header" style={styles.driveTitle}>
          {drive.title}
        </ThemedText>
        <View style={[styles.category, { backgroundColor: resident.surface }]}>
          <View style={[styles.dot, { backgroundColor: healthTypeColor(drive.type, resident) }]} />
          <ThemedText style={styles.categoryText}>{category.label}</ThemedText>
        </View>
      </View>
      {(
        [
          [
            'calendar-outline',
            `${healthDate(drive.drive_date)} · ${healthTime(drive.time_start)}–${healthTime(drive.time_end)}`,
          ],
          ['location-outline', drive.location],
          ['people-outline', drive.eligible_criteria],
        ] as const
      ).map(([icon, text]) => (
        <View key={icon} style={styles.meta}>
          <Ionicons name={icon} size={14} color={resident.muted} />
          <ThemedText style={[styles.metaText, { color: resident.muted }]}>{text}</ThemedText>
        </View>
      ))}
      <View style={styles.stockRow}>
        <View style={styles.stock}>
          <View style={styles.stockLabels}>
            <ThemedText style={[styles.categoryText, { color: resident.muted }]}>
              {drive.stock_label}
            </ThemedText>
            <ThemedText style={styles.categoryText}>
              {drive.stock_remaining}/{drive.stock_total} {drive.stock_unit}
            </ThemedText>
          </View>
          <View style={{ height: 6 }}>
            <ProgressBar
              presentation="resident"
              fraction={drive.stock_total > 0 ? drive.stock_remaining / drive.stock_total : 0}
              color={resident.accent}
            />
          </View>
        </View>
        {registered ? (
          <View style={[styles.registered, { backgroundColor: resident.accentSoft }]}>
            <Ionicons name="checkmark" size={16} color={resident.accentText} />
            <ThemedText style={[styles.categoryText, { color: resident.accentText }]}>Registered</ThemedText>
          </View>
        ) : onRegister ? (
          <PrimaryButton
            presentation="resident"
            compact
            appearance="healthDrive"
            label={full ? 'Full' : 'Register'}
            disabled={full}
            onPress={onRegister}
          />
        ) : null}
      </View>
    </View>
  );
}

/** M04: retained exit, concurrent 280/200ms motion and no business action in completion. */
export function HealthSheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { resident } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [panelHeight, setPanelHeight] = useState(height);
  const { mounted, panel, scrim, reduced } = useReportModalMotion(visible);
  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.overlay, { paddingTop: insets.top + 12 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: resident.scrim, opacity: scrim }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Dismiss ${title}`}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <Animated.View
          accessibilityViewIsModal
          onLayout={(event) => {
            const next = Math.ceil(event.nativeEvent.layout.height);
            setPanelHeight((previous) => (previous === next ? previous : next));
          }}
          style={[
            styles.sheet,
            {
              backgroundColor: resident.card,
              maxHeight: Math.min(height * 0.9, height - insets.top - 12),
              opacity: reduced ? panel : 1,
              transform: reduced
                ? []
                : [{ translateY: panel.interpolate({ inputRange: [0, 1], outputRange: [panelHeight, 0] }) }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: resident.border }]} />
          <View style={styles.sheetHeader}>
            <ThemedText accessibilityRole="header" style={styles.sheetTitle}>
              {title}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
              onPress={onClose}
              style={styles.close}
            >
              <Ionicons name="close" size={22} color={resident.text} />
            </Pressable>
          </View>
          <ScrollView
            style={{ flexShrink: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.sheetBody,
              { paddingBottom: footer ? 20 : Math.max(20, insets.bottom) },
            ]}
          >
            {children}
          </ScrollView>
          {footer ? (
            <View
              style={[
                styles.footer,
                { borderColor: resident.border, paddingBottom: Math.max(16, insets.bottom) },
              ]}
            >
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  drive: { padding: 12, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 },
  driveTitle: { flexGrow: 1, flexBasis: 160, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 1,
  },
  categoryText: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  metaText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  stockRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 6 },
  stock: { flexGrow: 1, flexBasis: 170, gap: 6 },
  stockLabels: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 },
  registered: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 10,
    gap: 4,
    minHeight: 44,
  },
  fact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  factLabel: { flexBasis: 124, fontSize: 13.5, lineHeight: 20 },
  factValue: { flexGrow: 1, flexBasis: 130, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    flexShrink: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingTop: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 8 },
  sheetTitle: { flex: 1, fontSize: 19, lineHeight: 24, fontWeight: '800' },
  close: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  sheetBody: { paddingHorizontal: 20, gap: 16, paddingTop: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
});
