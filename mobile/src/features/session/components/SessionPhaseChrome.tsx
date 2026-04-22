import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';
import { SizableText } from 'tamagui';

import { formatMmSs, useSmoothRemainingSeconds } from '@/features/session/hooks/useTimer';
import { LOOP_COUNT_MAX } from '@/shared/stores/loopStore';
import { useTimerStore } from '@/shared/stores/timerStore';

export const SESSION_PHASES = ['input', 'output', 'break'] as const;
export type SessionPhase = (typeof SESSION_PHASES)[number];

export const SESSION_PHASE_LABELS: Record<SessionPhase, string> = {
  input: 'インプット',
  output: 'アウトプット',
  break: '休憩',
};

const TEXT_ACTIVE = '#2F2F2F';
const TEXT_INACTIVE = '#9CA3AF';
const DOT_INACTIVE = '#D9D9D9';
const BORDER_COLOR = '#E5E7EB';
const SETTINGS_ICON_HEX_PATH = 'M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z';
const HOURGLASS_ICON_PATH =
  'M2 2 H14 V4 C14 6.5 11 7.5 11 10 C11 12.5 14 13.5 14 16 V18 H2 V16 C2 13.5 5 12.5 5 10 C5 7.5 2 6.5 2 4 Z';
const HOURGLASS_BADGE_BASE_WIDTH = 18;
const HOURGLASS_BADGE_BASE_HEIGHT = 24;
const HOURGLASS_BADGE_ACTIVE_SCALE = 1.45;

type SettingsIconProps = {
  size?: number;
  color?: string;
};

function SettingsIcon({ size = 26, color = TEXT_ACTIVE }: SettingsIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={SETTINGS_ICON_HEX_PATH}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={12} cy={12} r={2.4} stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

type SessionSettingsButtonProps = {
  onPress: () => void;
  testID: string;
  color?: string;
  rowStyle?: StyleProp<ViewStyle>;
};

export function SessionSettingsButton({
  onPress,
  testID,
  color = TEXT_ACTIVE,
  rowStyle,
}: SessionSettingsButtonProps) {
  return (
    <View style={[styles.settingsRow, rowStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="設定"
        onPress={onPress}
        style={({ pressed }) => [styles.settingsButton, pressed ? styles.pressed : null]}
        hitSlop={8}
        testID={testID}
      >
        <SettingsIcon color={color} />
      </Pressable>
    </View>
  );
}

type HourglassBadgeIconProps = {
  active: boolean;
  activeColor: string;
  inactiveColor: string;
  testID: string;
};

function HourglassBadgeIcon({
  active,
  activeColor,
  inactiveColor,
  testID,
}: HourglassBadgeIconProps) {
  const width = active
    ? HOURGLASS_BADGE_BASE_WIDTH * HOURGLASS_BADGE_ACTIVE_SCALE
    : HOURGLASS_BADGE_BASE_WIDTH;
  const height = active
    ? HOURGLASS_BADGE_BASE_HEIGHT * HOURGLASS_BADGE_ACTIVE_SCALE
    : HOURGLASS_BADGE_BASE_HEIGHT;
  const color = active ? activeColor : inactiveColor;

  return (
    <Svg width={width} height={height} viewBox="0 0 16 20" testID={testID}>
      <Path
        d={HOURGLASS_ICON_PATH}
        stroke={color}
        strokeWidth={active ? 1.5 : 1.3}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

type HourglassBadgeProps = {
  currentLoop: number;
  testIDPrefix: string;
  activeColor: string;
  inactiveColor?: string;
  borderColor?: string;
  marginBottom?: number;
  rowStyle?: StyleProp<ViewStyle>;
  badgeStyle?: StyleProp<ViewStyle>;
};

export function HourglassBadge({
  currentLoop,
  testIDPrefix,
  activeColor,
  inactiveColor = TEXT_INACTIVE,
  borderColor = BORDER_COLOR,
  marginBottom = 20,
  rowStyle,
  badgeStyle,
}: HourglassBadgeProps) {
  return (
    <View style={[styles.badgeRow, { marginBottom }, rowStyle]}>
      <View
        style={[styles.badge, { borderColor }, badgeStyle]}
        testID={`${testIDPrefix}-hourglass-badge`}
      >
        {Array.from({ length: LOOP_COUNT_MAX }).map((_, index) => {
          const isActive = index + 1 === currentLoop;
          return (
            <HourglassBadgeIcon
              key={index}
              active={isActive}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
              testID={`${testIDPrefix}-hourglass-badge-icon-${index + 1}`}
            />
          );
        })}
      </View>
    </View>
  );
}

type PhaseTabsProps = {
  activePhase: SessionPhase;
  testIDPrefix: string;
  activeDotColor: string;
  activeDotFilled?: boolean;
  inactiveDotColor?: string;
  activeTextColor?: string;
  inactiveTextColor?: string;
  separatorColor?: string;
  marginBottom?: number;
  onChange?: (phase: SessionPhase) => void;
};

export function PhaseTabs({
  activePhase,
  testIDPrefix,
  activeDotColor,
  activeDotFilled = true,
  inactiveDotColor = DOT_INACTIVE,
  activeTextColor = TEXT_ACTIVE,
  inactiveTextColor = DOT_INACTIVE,
  separatorColor = DOT_INACTIVE,
  marginBottom = 24,
  onChange,
}: PhaseTabsProps) {
  return (
    <View style={[styles.phaseTabs, { marginBottom }]} testID={`${testIDPrefix}-phase-tabs`}>
      {SESSION_PHASES.map((phase, index) => {
        const isActive = phase === activePhase;
        const isLast = index === SESSION_PHASES.length - 1;
        const tabContent = (
          <>
            <View
              style={[
                styles.phaseTabDot,
                { borderColor: inactiveDotColor },
                isActive
                  ? {
                      borderColor: activeDotColor,
                      backgroundColor: activeDotFilled ? activeDotColor : 'transparent',
                    }
                  : null,
              ]}
            />
            <SizableText
              size="$3"
              style={[
                styles.phaseTabLabel,
                { color: inactiveTextColor },
                isActive ? { color: activeTextColor, fontWeight: '700' } : null,
              ]}
            >
              {SESSION_PHASE_LABELS[phase]}
            </SizableText>
          </>
        );

        return (
          <View key={phase} style={styles.phaseTabItemRow}>
            {onChange ? (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => onChange(phase)}
                style={styles.phaseTab}
                testID={`${testIDPrefix}-phase-tab-${phase}`}
              >
                {tabContent}
              </Pressable>
            ) : (
              <View style={styles.phaseTab} testID={`${testIDPrefix}-phase-tab-${phase}`}>
                {tabContent}
              </View>
            )}
            {isLast ? null : (
              <View style={[styles.phaseTabSeparator, { backgroundColor: separatorColor }]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

type CircularPhaseTimerProps = {
  phase: SessionPhase;
  primaryColor: string;
  trackColor: string;
  testID: string;
  compact?: boolean;
  textTestID?: string;
};

export function CircularPhaseTimer({
  phase,
  primaryColor,
  trackColor,
  testID,
  compact = false,
  textTestID = 'timer-display',
}: CircularPhaseTimerProps) {
  const smoothRemainingSeconds = useSmoothRemainingSeconds();
  const totalSeconds = useTimerStore((s) => s.totalSeconds);

  const size = compact ? 156 : 260;
  const strokeWidth = compact ? 10 : 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const displayRemainingSeconds = Math.max(0, Math.ceil(smoothRemainingSeconds));
  const remainingRatio =
    totalSeconds > 0 ? Math.min(1, Math.max(0, smoothRemainingSeconds / totalSeconds)) : 0;
  const dashOffset = -circumference * (1 - remainingRatio);

  return (
    <View style={[styles.timerWrap, { width: size, height: size }]} testID={testID}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={primaryColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View
        style={[styles.timerCenter, compact ? styles.timerCenterCompact : null]}
        pointerEvents="none"
      >
        <SizableText
          style={[
            styles.timerPhaseLabel,
            { color: primaryColor },
            compact ? styles.timerPhaseLabelCompact : null,
          ]}
        >
          {SESSION_PHASE_LABELS[phase]}
        </SizableText>
        <SizableText
          style={[
            styles.timerText,
            { color: primaryColor },
            compact ? styles.timerTextCompact : null,
          ]}
          testID={textTestID}
        >
          {formatMmSs(displayRemainingSeconds)}
        </SizableText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginBottom: 12,
  },
  settingsButton: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  badgeRow: {
    alignItems: 'center',
    marginTop: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  phaseTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseTabItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phaseTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  phaseTabDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  phaseTabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  phaseTabSeparator: {
    width: 16,
    height: 1.5,
    marginHorizontal: 6,
  },
  timerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  timerCenterCompact: {
    gap: 2,
  },
  timerPhaseLabel: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  timerPhaseLabelCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  timerText: {
    fontSize: 56,
    fontWeight: '700',
    lineHeight: 64,
  },
  timerTextCompact: {
    fontSize: 34,
    lineHeight: 40,
  },
});
