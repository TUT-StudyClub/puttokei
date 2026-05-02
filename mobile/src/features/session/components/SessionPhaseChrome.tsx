import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Circle, ClipPath, Defs, Path, Rect, Svg } from 'react-native-svg';
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
const SETTINGS_ICON_HEX_PATH =
  'M3.08168 13.9445C2.55298 12.9941 2.28862 12.5188 2.28862 12C2.28862 11.4812 2.55298 11.0059 3.08169 10.0555L4.43094 7.63L5.85685 5.24876C6.4156 4.31567 6.69498 3.84912 7.14431 3.5897C7.59364 3.33028 8.13737 3.3216 9.22483 3.30426L12 3.26L14.7752 3.30426C15.8626 3.3216 16.4064 3.33028 16.8557 3.5897C17.305 3.84912 17.5844 4.31567 18.1431 5.24876L19.5691 7.63L20.9183 10.0555C21.447 11.0059 21.7114 11.4812 21.7114 12C21.7114 12.5188 21.447 12.9941 20.9183 13.9445L19.5691 16.37L18.1431 18.7512C17.5844 19.6843 17.305 20.1509 16.8557 20.4103C16.4064 20.6697 15.8626 20.6784 14.7752 20.6957L12 20.74L9.22483 20.6957C8.13737 20.6784 7.59364 20.6697 7.14431 20.4103C6.69498 20.1509 6.4156 19.6843 5.85685 18.7512L4.43094 16.37L3.08168 13.9445Z';
const HOURGLASS_FILL_PATH =
  'M0.106445 1.68819V3.38847C0.106445 3.88003 0.512042 4.27891 1.01187 4.27891C1.73703 4.27891 2.14262 5.06055 1.76161 5.66895C1.35191 6.32972 1.12249 7.05899 1.12249 7.82855C1.12249 8.90029 1.56905 9.89951 2.32698 10.7335L4.50246 13.4612C5.60044 14.8352 5.60044 16.7691 4.50246 18.1431L2.32698 20.8708C1.56905 21.7048 1.12249 22.7 1.12249 23.7758C1.12249 24.5453 1.35191 25.2786 1.76161 25.9354C2.14262 26.5437 1.73703 27.3254 1.01187 27.3254C0.512042 27.3254 0.106445 27.7243 0.106445 28.2158V29.9161C0.106445 30.4077 0.512042 30.8065 1.01187 30.8065H15.8633C16.3631 30.8065 16.7687 30.4077 16.7687 29.9161V28.2158C16.7687 27.7243 16.3631 27.3254 15.8633 27.3254C15.1381 27.3254 14.7325 26.5437 15.1135 25.9354C15.5232 25.2746 15.7526 24.5453 15.7526 23.7758C15.7526 22.704 15.3061 21.7048 14.5481 20.8708L12.3727 18.1431C11.2747 16.7691 11.2747 14.8352 12.3727 13.4612L14.5481 10.7335C15.3061 9.89951 15.7526 8.90432 15.7526 7.82855C15.7526 7.05899 15.5232 6.32569 15.1135 5.66895C14.7325 5.06055 15.1381 4.27891 15.8633 4.27891C16.3631 4.27891 16.7687 3.88003 16.7687 3.38847V1.68819C16.7687 1.19664 16.3631 0.79776 15.8633 0.79776H1.01187C0.512042 0.793731 0.106445 1.19261 0.106445 1.68819Z';
const HOURGLASS_INNER_CLIP_PATH =
  'M8.8329 3.61005C5.91998 3.61005 3.55195 5.36674 3.55195 7.52634C3.55195 8.23949 3.82235 8.94458 4.33446 9.56507L6.78033 12.9173C7.90289 14.4604 7.90289 16.5314 6.78033 18.0745L4.38772 21.3583C3.82235 22.0432 3.54785 22.7483 3.54785 23.4655C3.54785 25.6251 5.91588 27.3818 8.8288 27.3818C11.7417 27.3818 14.1098 25.6251 14.1098 23.4655C14.1098 22.7523 13.8394 22.0472 13.3272 21.4268L10.8814 18.0745C9.75881 16.5314 9.75881 14.4604 10.8814 12.9173L13.274 9.63356C13.8394 8.94861 14.1138 8.24352 14.1138 7.52634C14.1138 5.36674 11.7458 3.61005 8.8329 3.61005Z';
const HOURGLASS_BORDER_PATH =
  'M0 1.38198V3.08227C0 3.8478 0.630928 4.46425 1.40525 4.46425C1.65107 4.46425 1.79446 4.64153 1.80265 4.86716L1.733 5.10891C1.27824 5.83415 1.01604 6.66011 1.02014 7.52637C1.02014 8.7351 1.52406 9.85116 2.35164 10.7577L2.72446 10.4314L2.33116 10.7335L4.50663 13.4612C4.98597 14.0616 5.22359 14.7788 5.22359 15.5C5.22359 16.2212 4.98597 16.9384 4.50663 17.5387L2.33116 20.2664L2.72446 20.5686L2.35164 20.2422C1.52406 21.1488 1.02014 22.2648 1.02014 23.4736C1.02014 24.3398 1.28234 25.1658 1.733 25.891L1.80265 26.1328C1.79446 26.3584 1.65107 26.5317 1.40525 26.5357C0.626831 26.5357 0 27.1562 0 27.9177V29.618C0 30.3835 0.630928 30.9999 1.40525 30.9999H16.2566C17.0351 30.9999 17.6619 30.3795 17.6619 29.618V27.9177C17.6619 27.1521 17.031 26.5357 16.2566 26.5357C16.0108 26.5357 15.8674 26.3584 15.8592 26.1328L15.9289 25.891C16.3836 25.1658 16.6459 24.3398 16.6418 23.4736C16.6418 22.2648 16.1378 21.1488 15.3103 20.2422L14.9374 20.5686L15.3307 20.2664L13.1553 17.5387C12.6759 16.9384 12.4383 16.2212 12.4383 15.5C12.4383 14.7788 12.6759 14.0616 13.1553 13.4612L15.3307 10.7335L14.9374 10.4314L15.3103 10.7577C16.1378 9.85116 16.6418 8.7351 16.6418 7.52637C16.6418 6.66011 16.3796 5.83415 15.9289 5.10891L15.8592 4.86716C15.8674 4.64153 16.0108 4.46828 16.2566 4.46425C17.0351 4.46425 17.6619 3.84377 17.6619 3.08227V1.38198C17.6619 0.616453 17.031 0 16.2566 0H1.40525C0.630928 0 0 0.620482 0 1.38198H0.999653C0.999653 1.16038 1.18401 0.983102 1.40935 0.979073H16.2607C16.4861 0.979073 16.6663 1.16038 16.6704 1.38198V3.08227C16.6704 3.30387 16.4861 3.48115 16.2607 3.48518C15.8551 3.48518 15.4905 3.6544 15.2488 3.91226C15.003 4.17012 14.8678 4.5126 14.8678 4.87119C14.8678 5.12502 14.9374 5.38691 15.0849 5.62463C15.4536 6.21691 15.6503 6.85351 15.6503 7.5304C15.6503 8.46918 15.2652 9.3435 14.5728 10.109L14.5605 10.1211L12.3727 12.8609C11.7541 13.6345 11.4427 14.5733 11.4427 15.504C11.4427 16.4388 11.7541 17.3735 12.3727 18.1471L14.5564 20.8869L14.5687 20.899C15.2611 21.6605 15.6462 22.5388 15.6462 23.4776C15.6462 24.1505 15.4455 24.7911 15.0808 25.3834C14.9333 25.6211 14.8637 25.883 14.8637 26.1368C14.8637 26.4954 14.9989 26.8379 15.2447 27.0957C15.4905 27.3536 15.8551 27.5228 16.2566 27.5228C16.482 27.5228 16.6622 27.7041 16.6663 27.9257V29.626C16.6663 29.8476 16.482 30.0249 16.2566 30.0289H1.40525C1.17992 30.0289 0.999653 29.8476 0.995556 29.626V27.9257C0.995556 27.7041 1.17992 27.5268 1.40525 27.5228C1.81085 27.5228 2.17547 27.3536 2.41719 27.0957C2.66301 26.8379 2.79821 26.4954 2.79821 26.1368C2.79821 25.883 2.72856 25.6211 2.58107 25.3834C2.21235 24.7911 2.01569 24.1545 2.01569 23.4776C2.01569 22.5388 2.4008 21.6645 3.09319 20.899L3.10548 20.8869L5.28914 18.1471C5.90778 17.3735 6.21915 16.4347 6.21915 15.504C6.21915 14.5692 5.90778 13.6345 5.28914 12.8609L3.10548 10.1211L3.09319 10.109C2.4008 9.34753 2.01569 8.46918 2.01569 7.5304C2.01569 6.85754 2.21644 6.21691 2.58107 5.62463C2.72856 5.38691 2.79821 5.12502 2.79821 4.87119C2.79821 4.5126 2.66301 4.17012 2.41719 3.91226C2.17138 3.6544 1.80675 3.48518 1.40525 3.48518C1.17992 3.48518 0.999653 3.30387 0.995556 3.08227V1.38198H0Z';
const HOURGLASS_BADGE_BASE_WIDTH = 18;
const HOURGLASS_BADGE_BASE_HEIGHT = 31;
const HOURGLASS_BADGE_ACTIVE_SCALE = 1.45;

type SettingsIconProps = {
  size?: number;
  color?: string;
};

function SettingsIcon({ size = 24, color = TEXT_ACTIVE }: SettingsIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={SETTINGS_ICON_HEX_PATH} stroke={color} strokeWidth={2} fill="none" />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} fill="none" />
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
  const clipId = `${testID.replace(/-/g, '_')}_clip`;

  return (
    <Svg width={width} height={height} viewBox="0 0 18 31" testID={testID}>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={HOURGLASS_INNER_CLIP_PATH} />
        </ClipPath>
      </Defs>
      <Path d={HOURGLASS_FILL_PATH} fill="#FFFFFF" />
      <Rect x={-4} y={-12} width={28} height={44} fill="#EFEFEF" clipPath={`url(#${clipId})`} />
      <Path d={HOURGLASS_BORDER_PATH} fill={active ? activeColor : inactiveColor} />
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

const PHASE_TAB_DOT_SIZE = 9.5;
const PHASE_TAB_DOT_STROKE = 1.5;

function PhaseTabDot({
  color,
  filled,
  testID,
}: {
  color: string;
  filled: boolean;
  testID: string;
}) {
  const r = PHASE_TAB_DOT_SIZE / 2 - PHASE_TAB_DOT_STROKE / 2;
  const c = PHASE_TAB_DOT_SIZE / 2;
  return (
    <View
      testID={testID}
      style={{
        width: PHASE_TAB_DOT_SIZE,
        height: PHASE_TAB_DOT_SIZE,
        borderRadius: PHASE_TAB_DOT_SIZE / 2,
        backgroundColor: filled ? color : 'transparent',
        borderColor: color,
        borderWidth: 0,
        ...(filled && {
          shadowColor: color,
          shadowOpacity: 0.5,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }),
      }}
    >
      {!filled && (
        <Svg width={PHASE_TAB_DOT_SIZE} height={PHASE_TAB_DOT_SIZE}>
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={color}
            strokeWidth={PHASE_TAB_DOT_STROKE}
            strokeDasharray="0 2.51"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      )}
    </View>
  );
}

type PhaseTabsProps = {
  activePhase: SessionPhase | null;
  testIDPrefix: string;
  activeDotColor: string;
  activeDotFilled?: boolean;
  inactiveDotFilled?: boolean;
  inactiveDotFilledPhases?: Partial<Record<SessionPhase, boolean>>;
  inactiveDotColor?: string;
  inactiveDotColors?: Partial<Record<SessionPhase, string>>;
  activeTextColor?: string;
  inactiveTextColor?: string;
  inactiveTextColors?: Partial<Record<SessionPhase, string>>;
  separatorColor?: string;
  marginBottom?: number;
  onChange?: (phase: SessionPhase) => void;
};

export function PhaseTabs({
  activePhase,
  testIDPrefix,
  activeDotColor,
  activeDotFilled = true,
  inactiveDotFilled = false,
  inactiveDotFilledPhases,
  inactiveDotColor = DOT_INACTIVE,
  inactiveDotColors,
  activeTextColor = TEXT_ACTIVE,
  inactiveTextColor = DOT_INACTIVE,
  inactiveTextColors,
  separatorColor = DOT_INACTIVE,
  marginBottom = 24,
  onChange,
}: PhaseTabsProps) {
  return (
    <View style={[styles.phaseTabs, { marginBottom }]} testID={`${testIDPrefix}-phase-tabs`}>
      {SESSION_PHASES.map((phase, index) => {
        const isActive = phase === activePhase;
        const isLast = index === SESSION_PHASES.length - 1;
        const phaseInactiveDotColor = inactiveDotColors?.[phase] ?? inactiveDotColor;
        const phaseInactiveDotFilled = inactiveDotFilledPhases?.[phase] ?? inactiveDotFilled;
        const phaseInactiveTextColor = inactiveTextColors?.[phase] ?? inactiveTextColor;
        const tabContent = (
          <>
            <PhaseTabDot
              color={isActive ? activeDotColor : phaseInactiveDotColor}
              filled={isActive ? activeDotFilled : phaseInactiveDotFilled}
              testID={`${testIDPrefix}-phase-tab-${phase}-dot`}
            />
            <SizableText
              size="$3"
              style={[
                styles.phaseTabLabel,
                { color: phaseInactiveTextColor },
                isActive
                  ? { color: activeTextColor, fontFamily: 'HiraginoSans-W6', fontWeight: '700' }
                  : null,
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
  leftPercent?: number;
  rightPercent?: number;
  strokeWidth?: number;
};

export function CircularPhaseTimer({
  phase,
  primaryColor,
  trackColor,
  testID,
  compact = false,
  textTestID = 'timer-display',
  leftPercent,
  rightPercent,
  strokeWidth: strokeWidthProp,
}: CircularPhaseTimerProps) {
  const { width: windowWidth } = useWindowDimensions();
  const smoothRemainingSeconds = useSmoothRemainingSeconds();
  const totalSeconds = useTimerStore((s) => s.totalSeconds);

  const size =
    leftPercent != null && rightPercent != null
      ? windowWidth * (1 - leftPercent - rightPercent)
      : compact
        ? 156
        : 260;
  const strokeWidth = strokeWidthProp ?? (compact ? 10 : 14);
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
    position: 'absolute',
    top: '1%',
    right: '10%',
  },
  settingsButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  badgeRow: {
    alignItems: 'center',
    marginTop: 48,
    marginBottom: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 11.4,
    paddingHorizontal: 18,
    borderRadius: 15,
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
    justifyContent: 'flex-start',
    marginBottom: 24,
    paddingLeft: 0,
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
    paddingHorizontal: 2,
  },
  phaseTabLabel: {
    fontFamily: 'HiraginoSans-W6',
    fontSize: 12,
    fontWeight: '600',
  },
  phaseTabSeparator: {
    width: 16,
    height: 1.5,
    borderRadius: 999,
    marginHorizontal: 2,
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
    fontFamily: 'HiraginoSans-W6',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  timerPhaseLabelCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  timerText: {
    fontFamily: 'HiraginoSans-W6',
    fontSize: 58,
    fontWeight: '600',
    lineHeight: 64,
  },
  timerTextCompact: {
    fontSize: 34,
    lineHeight: 40,
  },
});
