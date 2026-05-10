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
const REPORT_BLOCKED_MESSAGE =
  'タイマー起動中はレポート機能を見ることができません。休憩終了後に見ることができます。';

export function isReportTabNavigationBlocked(phase: TimerPhase) {
  return phase === 'input' || phase === 'output' || phase === 'break';
}

// session phase 中にタイマータブを押すと、HomeScreen への遷移で input/output/break
// 各画面が unmount され、cleanup の `reset()` でタイマーストアが idle に戻ってしまう。
// 体感的にはタイマーが強制終了するため、phase が走っている間は遷移を抑止する。
export function isTimerTabNavigationBlocked(phase: TimerPhase) {
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
      style={{ width: size, height: size, tintColor: active ? ACTIVE_COLOR : INACTIVE_COLOR }}
    />
  );
}

function TimerTabIconContainer({ focused, size = 24 }: { focused: boolean; size?: number }) {
  const timerPhase = useTimerStore((s) => s.phase);
  const segments = useSegments() as string[];
  const pathname = usePathname();
  return (
    <TimerTabIcon
      active={isTimerTabIconHighlighted(segments, focused, timerPhase, pathname)}
      size={size}
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
            <Text allowFontScaling={false} style={styles.dialogMessage}>
              {REPORT_BLOCKED_MESSAGE}
            </Text>
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
  const shouldBlockTimerTab = isTimerTabNavigationBlocked(timerPhase);
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
            tabBarLabel: ({ focused }) => {
              const active = isTimerTabIconHighlighted(segments, focused, timerPhase, pathname);
              return (
                <Text
                  style={{
                    color: active ? '#475FFF' : INACTIVE_COLOR,
                    fontSize: 11,
                    fontFamily: 'HiraginoSans-W6',
                    marginTop: 1,
                  }}
                >
                  タイマー
                </Text>
              );
            },
            tabBarIcon: ({ focused }) => <TimerTabIconContainer focused={focused} size={39} />,
          }}
          listeners={{
            tabPress: (event) => {
              if (shouldBlockTimerTab) {
                // タップ自体を no-op 化する。ユーザーは既に session 画面を見ているので、
                // ダイアログを出すと「画面はそのままなのに通知だけ出る」違和感が生じるため。
                event.preventDefault();
              }
            },
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: 'レポート',
            tabBarLabel: () => (
              <Text allowFontScaling={false} style={styles.tabBarLabel}>
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
    color: '#676767',
    fontSize: 11,
    fontFamily: 'HiraginoSans-W6',
    marginTop: 1,
  },
  dialogBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
    paddingHorizontal: 36,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 310,
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CDCDCD',
    backgroundColor: '#FFFFFF',
  },
  dialogMessageWrap: {
    minHeight: 81,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 14,
  },
  dialogMessage: {
    color: '#333333',
    fontFamily: 'HiraginoSans-W3',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  dialogDivider: {
    height: 1,
    backgroundColor: '#CDCDCD',
  },
  dialogButton: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dialogButtonText: {
    color: ACTIVE_COLOR,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
  },
});
