import { Tabs, useSegments } from 'expo-router';
import { Fragment, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import { useTimerStore, type TimerPhase } from '@/shared/stores/timerStore';

const ACTIVE_COLOR = '#4B5CFF';
const INACTIVE_COLOR = '#9CA3AF';
const TABS_SEGMENT = '(tabs)';
const TIMER_TAB_ACTIVE_SESSION_PHASES = new Set(['input', 'output', 'break']);
const REPORT_BLOCKED_MESSAGE_LINES = [
  'タイマー起動中はレポート機能を見ることができ',
  'ません。休憩終了後に見ることができます。',
] as const;

export function isReportTabNavigationBlocked(phase: TimerPhase) {
  return phase === 'input' || phase === 'output' || phase === 'break';
}

export function isTimerTabIconHighlighted(segments: readonly string[]) {
  const routeSegments = segments[0] === TABS_SEGMENT ? segments.slice(1) : segments;
  const currentRouteSegment = routeSegments[0];

  if (currentRouteSegment === undefined || currentRouteSegment === 'index') {
    return true;
  }

  return (
    currentRouteSegment === 'session' && TIMER_TAB_ACTIVE_SESSION_PHASES.has(routeSegments[2] ?? '')
  );
}

function TimerTabIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 39 39" fill="none">
      <Path
        d="M29.753 9.24695C32.1251 11.619 33.6014 14.7402 33.9302 18.0787C34.259 21.4172 33.4201 24.7665 31.5563 27.5558C29.6926 30.3451 26.9193 32.4018 23.7091 33.3756C20.4989 34.3494 17.0504 34.18 13.9511 32.8963C10.8518 31.6125 8.29351 29.2938 6.71214 26.3353C5.13077 23.3767 4.62415 19.9614 5.27861 16.6712C5.93307 13.381 7.70812 10.4195 10.3013 8.29135C12.8945 6.16318 16.1453 5 19.5 5"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path d="M19.5 19.5L29.25 9.75" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <Path d="M19.5 4.875V8.125" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <Path d="M4.875 19.5L8.125 19.5" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <Path d="M19.5 30.875V34.125" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <Path d="M30.875 19.5L34.125 19.5" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

function ReportTabIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 39 39" fill="none">
      <Path d="M34.125 32.5H4.875" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <Path
        d="M16.25 26V15C16.25 13.8954 15.3546 13 14.25 13H11.75C10.6454 13 9.75 13.8954 9.75 15V26"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M29.25 26V8.5C29.25 7.39543 28.3546 6.5 27.25 6.5H24.75C23.6454 6.5 22.75 7.39543 22.75 8.5V26"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ReportBlockedDialog({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      transparent
      visible={visible}
      testID="report-blocked-dialog"
    >
      <View style={styles.dialogBackdrop}>
        <View style={styles.dialogCard}>
          <View style={styles.dialogMessageWrap}>
            {REPORT_BLOCKED_MESSAGE_LINES.map((line) => (
              <Text
                adjustsFontSizeToFit
                allowFontScaling={false}
                key={line}
                minimumFontScale={0.82}
                numberOfLines={1}
                style={styles.dialogMessage}
              >
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.dialogDivider} />
          <Pressable
            accessibilityRole="button"
            onPress={onDismiss}
            style={styles.dialogButton}
            testID="report-blocked-dialog-ok"
          >
            <Text allowFontScaling={false} style={styles.dialogButtonText}>
              OK
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function TabsLayout() {
  const timerPhase = useTimerStore((s) => s.phase);
  const segments = useSegments() as string[];
  const shouldBlockReportTab = isReportTabNavigationBlocked(timerPhase);
  const shouldHighlightTimerTabIcon = isTimerTabIconHighlighted(segments);
  const [isReportBlockedDialogVisible, setReportBlockedDialogVisible] = useState(false);

  return (
    <Fragment>
      <Tabs
        screenOptions={{
          headerShown: false,
          animation: 'none',
          tabBarActiveTintColor: ACTIVE_COLOR,
          tabBarInactiveTintColor: INACTIVE_COLOR,
          tabBarStyle: { paddingTop: 10 },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
          tabBarIconStyle: { marginBottom: 4 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'タイマー',
            tabBarLabel: ({ color }) => (
              <Text
                style={{
                  color: shouldHighlightTimerTabIcon ? ACTIVE_COLOR : color,
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                タイマー
              </Text>
            ),
            tabBarIcon: ({ color }) => (
              <TimerTabIcon color={shouldHighlightTimerTabIcon ? ACTIVE_COLOR : color} size={39} />
            ),
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: 'レポート',
            tabBarLabel: ({ color }) => (
              <Text style={[styles.tabBarLabel, { color }]}>レポート</Text>
            ),
            tabBarIcon: ({ color }) => <ReportTabIcon color={color} size={39} />,
          }}
          listeners={{
            tabPress: (event) => {
              if (shouldBlockReportTab) {
                event.preventDefault();
                setReportBlockedDialogVisible(true);
              }
            },
          }}
        />
        <Tabs.Screen name="history" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="session/[id]/input" options={{ href: null }} />
        <Tabs.Screen name="session/[id]/output" options={{ href: null }} />
        <Tabs.Screen name="session/[id]/break" options={{ href: null }} />
        <Tabs.Screen name="session/[id]/result" options={{ href: null }} />
      </Tabs>
      <ReportBlockedDialog
        visible={isReportBlockedDialogVisible}
        onDismiss={() => setReportBlockedDialogVisible(false)}
      />
    </Fragment>
  );
}

const styles = StyleSheet.create({
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  dialogBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
    paddingHorizontal: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 292,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  dialogMessageWrap: {
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  dialogMessage: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  dialogDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D4D4D8',
  },
  dialogButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dialogButtonText: {
    color: ACTIVE_COLOR,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
  },
});
