import { Tabs, usePathname, useSegments } from 'expo-router';
import { Fragment, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTimerStore, type TimerPhase } from '@/shared/stores/timerStore';

const ACTIVE_COLOR = '#4B5CFF';
const INACTIVE_COLOR = '#9CA3AF';
const TIMER_ICON_BLUE = require('../../assets/images/icons/icon_timer_blue.png');
const TIMER_ICON_GRAY = require('../../assets/images/icons/icon_timer_gray.png');
const REPORT_ICON_BLUE = require('../../assets/images/icons/icon_report_blue.png');
const REPORT_ICON_GRAY = require('../../assets/images/icons/icon_report_gray.png');
const TABS_SEGMENT = '(tabs)';
const TIMER_TAB_ACTIVE_SESSION_PHASES = new Set(['input', 'output', 'break']);
const REPORT_BLOCKED_MESSAGE_LINES = [
  'タイマー起動中はレポート機能を見ることができ',
  'ません。休憩終了後に見ることができます。',
] as const;

export function isReportTabNavigationBlocked(phase: TimerPhase) {
  return phase === 'input' || phase === 'output' || phase === 'break';
}

export function isTimerTabIconHighlighted(
  segments: readonly string[],
  focused: boolean,
  phase: TimerPhase,
  pathname: string,
) {
  const routeSegments = segments[0] === TABS_SEGMENT ? segments.slice(1) : segments;
  const currentRouteSegment = routeSegments[0];
  const pathnameSegments = pathname.split('/').filter(Boolean);
  const currentPathSegment = pathnameSegments[0];
  const currentSessionPhase = pathnameSegments[pathnameSegments.length - 1];

  if (currentRouteSegment === 'stats' || currentPathSegment === 'stats') {
    return false;
  }

  if (focused) {
    return true;
  }

  if (TIMER_TAB_ACTIVE_SESSION_PHASES.has(phase)) {
    return true;
  }

  return (
    (currentRouteSegment === 'session' &&
      TIMER_TAB_ACTIVE_SESSION_PHASES.has(routeSegments[2] ?? '')) ||
    (currentPathSegment === 'session' &&
      TIMER_TAB_ACTIVE_SESSION_PHASES.has(currentSessionPhase ?? ''))
  );
}

function TimerTabIcon({ active, size = 24 }: { active: boolean; size?: number }) {
  return (
    <Image
      source={active ? TIMER_ICON_BLUE : TIMER_ICON_GRAY}
      style={{ width: size, height: size }}
    />
  );
}

function ReportTabIcon({ active, size = 24 }: { active: boolean; size?: number }) {
  return (
    <Image
      source={active ? REPORT_ICON_BLUE : REPORT_ICON_GRAY}
      style={{ width: size, height: size }}
    />
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
  const pathname = usePathname();
  const shouldBlockReportTab = isReportTabNavigationBlocked(timerPhase);
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
            tabBarLabel: ({ color, focused }) => {
              const shouldHighlightTimerTabIcon = isTimerTabIconHighlighted(
                segments,
                focused,
                timerPhase,
                pathname,
              );

              return (
                <Text
                  style={{
                    color: shouldHighlightTimerTabIcon ? ACTIVE_COLOR : color,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  タイマー
                </Text>
              );
            },
            tabBarIcon: ({ focused }) => (
              <TimerTabIcon
                active={isTimerTabIconHighlighted(segments, focused, timerPhase, pathname)}
                size={39}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: 'レポート',
            tabBarLabel: ({ color }) => (
              <Text allowFontScaling={false} style={[styles.tabBarLabel, { color, marginTop: 4 }]}>
                レポート
              </Text>
            ),
            tabBarIcon: ({ focused }) => <ReportTabIcon active={focused} size={39} />,
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
