import { useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Circle, ClipPath, Defs, Path, Rect, Svg, SvgXml } from 'react-native-svg';
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
const DOT_INACTIVE = '#D9D9D9';
const BORDER_COLOR = '#E5E7EB';
const SETTINGS_ICON_HEX_PATH = 'M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z';
const HOURGLASS_BADGE_ASSET = require('../../../../assets/images/hourglass_gray.svg');
const HOURGLASS_BADGE_BASE_WIDTH = 18;
const HOURGLASS_BADGE_BASE_HEIGHT = 31;
const HOURGLASS_BADGE_ACTIVE_SCALE = 1.45;
const HOURGLASS_BADGE_FALLBACK_PATH =
  'M0 1.38V3.08C0 3.85 0.63 4.46 1.41 4.46C1.65 4.46 1.79 4.64 1.8 4.87L1.73 5.11C1.28 5.83 1.02 6.66 1.02 7.53C1.02 8.74 1.52 9.85 2.35 10.76L4.51 13.46C4.99 14.06 5.22 14.78 5.22 15.5C5.22 16.22 4.99 16.94 4.51 17.54L2.33 20.27C1.52 21.15 1.02 22.26 1.02 23.47C1.02 24.34 1.28 25.17 1.73 25.89L1.8 26.13C1.79 26.36 1.65 26.53 1.41 26.54C0.63 26.54 0 27.16 0 27.92V29.62C0 30.38 0.63 31 1.41 31H16.26C17.04 31 17.66 30.38 17.66 29.62V27.92C17.66 27.15 17.03 26.54 16.26 26.54C16.01 26.54 15.87 26.36 15.86 26.13L15.93 25.89C16.38 25.17 16.65 24.34 16.64 23.47C16.64 22.26 16.14 21.15 15.31 20.24L13.16 17.54C12.68 16.94 12.44 16.22 12.44 15.5C12.44 14.78 12.68 14.06 13.16 13.46L15.33 10.73C16.14 9.85 16.64 8.74 16.64 7.53C16.64 6.66 16.38 5.83 15.93 5.11L15.86 4.87C15.87 4.64 16.01 4.47 16.26 4.46C17.04 4.46 17.66 3.84 17.66 3.08V1.38C17.66 0.62 17.03 0 16.26 0H1.41C0.63 0 0 0.62 0 1.38Z';
const HOURGLASS_BADGE_FALLBACK_INNER_PATH =
  'M8.83 3.61C5.92 3.61 3.55 5.37 3.55 7.53C3.55 8.24 3.82 8.94 4.33 9.57L6.78 12.92C7.9 14.46 7.9 16.53 6.78 18.07L4.39 21.36C3.82 22.04 3.55 22.75 3.55 23.47C3.55 25.63 5.92 27.38 8.83 27.38C11.74 27.38 14.11 25.63 14.11 23.47C14.11 22.75 13.84 22.05 13.33 21.43L10.88 18.07C9.76 16.53 9.76 14.46 10.88 12.92L13.27 9.63C13.84 8.95 14.11 8.24 14.11 7.53C14.11 5.37 11.75 3.61 8.83 3.61Z';
const HOURGLASS_SAND_UPPER_CLIP_ID = 'hourglassBadgeUpperSandClip';
const HOURGLASS_SAND_LOWER_CLIP_ID = 'hourglassBadgeLowerSandClip';
const HOURGLASS_SAND_UPPER_CLIP_PATH =
  'M3.55 7.53 C3.55 5.37 5.92 3.61 8.83 3.61 C11.75 3.61 14.11 5.37 14.11 7.53 C14.11 8.24 13.84 8.95 13.27 9.63 L10.88 12.92 C9.76 14.46 7.9 14.46 6.78 12.92 L4.33 9.57 C3.82 8.94 3.55 8.24 3.55 7.53 Z';
const HOURGLASS_SAND_LOWER_CLIP_PATH =
  'M6.78 18.07 C7.9 16.53 9.76 16.53 10.88 18.07 L13.33 21.43 C13.84 22.05 14.11 22.75 14.11 23.47 C14.11 25.63 11.74 27.38 8.83 27.38 C5.92 27.38 3.55 25.63 3.55 23.47 C3.55 22.75 3.82 22.04 4.39 21.36 Z';
const HOURGLASS_SAND_TOP = 3.61;
const HOURGLASS_SAND_NECK_Y = 14.25;
const HOURGLASS_SAND_BOTTOM_TOP = 16.75;
const HOURGLASS_SAND_BOTTOM = 27.38;
const HOURGLASS_SAND_X = 3.3;
const HOURGLASS_SAND_WIDTH = 11.1;
const HOURGLASS_SAND_STREAM_Y = 13.35;
const HOURGLASS_SAND_STREAM_HEIGHT = 6.1;

const SVG_CSS_ATTRIBUTE_NAMES: Record<string, string> = {
  'mask-type': 'maskType',
};

const SVG_UNSUPPORTED_CSS_PROPERTIES = new Set(['mix-blend-mode']);

function cssPropertyToSvgAttribute(property: string) {
  return (
    SVG_CSS_ATTRIBUTE_NAMES[property] ??
    property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
  );
}

function inlineSvgStyleAttributes(xml: string) {
  return xml.replace(/\sstyle="([^"]*)"/g, (_styleAttribute: string, declarations: string) => {
    const attributes = declarations
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separatorIndex = declaration.indexOf(':');
        if (separatorIndex === -1) return null;

        const property = declaration.slice(0, separatorIndex).trim();
        const value = declaration.slice(separatorIndex + 1).trim();
        if (!property || !value || SVG_UNSUPPORTED_CSS_PROPERTIES.has(property)) return null;

        return `${cssPropertyToSvgAttribute(property)}="${value}"`;
      })
      .filter((attribute): attribute is string => attribute !== null);

    return attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
  });
}

function clampSandProgress(progress: number) {
  return Math.min(1, Math.max(0, progress));
}

function getHourglassSandMetrics(progress: number) {
  const remainingRatio = clampSandProgress(progress);
  const elapsedRatio = 1 - remainingRatio;
  const upperHeight = (HOURGLASS_SAND_NECK_Y - HOURGLASS_SAND_TOP) * remainingRatio;
  const lowerHeight = (HOURGLASS_SAND_BOTTOM - HOURGLASS_SAND_BOTTOM_TOP) * elapsedRatio;

  return {
    upperY: HOURGLASS_SAND_NECK_Y - upperHeight,
    upperHeight,
    lowerY: HOURGLASS_SAND_BOTTOM - lowerHeight,
    lowerHeight,
    isDraining: remainingRatio > 0,
  };
}

function buildHourglassSandOverlayXml(progress: number, color: string, showStream: boolean) {
  const { upperY, upperHeight, lowerY, lowerHeight, isDraining } = getHourglassSandMetrics(progress);
  const stream =
    showStream && isDraining
      ? `<rect x="8.38" y="${HOURGLASS_SAND_STREAM_Y}" width="0.9" height="${HOURGLASS_SAND_STREAM_HEIGHT}" rx="0.45" fill="${color}" opacity="0.95"/>`
      : '';

  return `
<defs>
  <clipPath id="${HOURGLASS_SAND_UPPER_CLIP_ID}">
    <path d="${HOURGLASS_SAND_UPPER_CLIP_PATH}"/>
  </clipPath>
  <clipPath id="${HOURGLASS_SAND_LOWER_CLIP_ID}">
    <path d="${HOURGLASS_SAND_LOWER_CLIP_PATH}"/>
  </clipPath>
</defs>
<g opacity="0.92">
  <rect x="${HOURGLASS_SAND_X}" y="${upperY}" width="${HOURGLASS_SAND_WIDTH}" height="${upperHeight}" fill="${color}" clip-path="url(#${HOURGLASS_SAND_UPPER_CLIP_ID})"/>
  <rect x="${HOURGLASS_SAND_X}" y="${lowerY}" width="${HOURGLASS_SAND_WIDTH}" height="${lowerHeight}" fill="${color}" clip-path="url(#${HOURGLASS_SAND_LOWER_CLIP_ID})"/>
  ${stream}
</g>`;
}

function injectHourglassSandOverlay(
  xml: string,
  progress: number | undefined,
  color: string,
  showStream: boolean,
) {
  if (progress === undefined) return xml;
  return xml.replace('</svg>', `${buildHourglassSandOverlayXml(progress, color, showStream)}</svg>`);
}

function useHourglassBadgeXml() {
  const [xml, setXml] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const source = Image.resolveAssetSource(HOURGLASS_BADGE_ASSET);
    const uri = source?.uri;
    if (!uri || typeof fetch !== 'function') return;

    fetch(uri)
      .then((response) => {
        if (!response.ok && !(response.status === 0 && uri.startsWith('file://'))) {
          throw new Error(`Failed to load hourglass badge SVG: ${response.status}`);
        }
        return response.text();
      })
      .then((loadedXml) => {
        if (isMounted) {
          setXml(inlineSvgStyleAttributes(loadedXml));
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  return xml;
}

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
  sandColor: string;
  sandProgress?: number;
  showSandStream: boolean;
  xml: string | null;
  testID: string;
};

type HourglassBadgeFallbackIconProps = {
  width: number;
  height: number;
  testID: string;
  sandColor: string;
  sandProgress?: number;
  showSandStream: boolean;
};

function HourglassBadgeSandOverlay({
  progress,
  color,
  showStream,
}: {
  progress: number;
  color: string;
  showStream: boolean;
}) {
  const { upperY, upperHeight, lowerY, lowerHeight, isDraining } =
    getHourglassSandMetrics(progress);

  return (
    <>
      <Defs>
        <ClipPath id={HOURGLASS_SAND_UPPER_CLIP_ID}>
          <Path d={HOURGLASS_SAND_UPPER_CLIP_PATH} />
        </ClipPath>
        <ClipPath id={HOURGLASS_SAND_LOWER_CLIP_ID}>
          <Path d={HOURGLASS_SAND_LOWER_CLIP_PATH} />
        </ClipPath>
      </Defs>
      <Rect
        x={HOURGLASS_SAND_X}
        y={upperY}
        width={HOURGLASS_SAND_WIDTH}
        height={upperHeight}
        fill={color}
        clipPath={`url(#${HOURGLASS_SAND_UPPER_CLIP_ID})`}
        opacity={0.92}
      />
      <Rect
        x={HOURGLASS_SAND_X}
        y={lowerY}
        width={HOURGLASS_SAND_WIDTH}
        height={lowerHeight}
        fill={color}
        clipPath={`url(#${HOURGLASS_SAND_LOWER_CLIP_ID})`}
        opacity={0.92}
      />
      {showStream && isDraining ? (
        <Rect
          x={8.38}
          y={HOURGLASS_SAND_STREAM_Y}
          width={0.9}
          height={HOURGLASS_SAND_STREAM_HEIGHT}
          rx={0.45}
          fill={color}
          opacity={0.95}
        />
      ) : null}
    </>
  );
}

function HourglassBadgeFallbackIcon({
  width,
  height,
  testID,
  sandColor,
  sandProgress,
  showSandStream,
}: HourglassBadgeFallbackIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 18 31" fill="none" testID={testID}>
      <Path d={HOURGLASS_BADGE_FALLBACK_PATH} fill="#CDCDCD" />
      <Path d={HOURGLASS_BADGE_FALLBACK_INNER_PATH} fill="#EFEFEF" />
      {sandProgress === undefined ? null : (
        <HourglassBadgeSandOverlay
          progress={sandProgress}
          color={sandColor}
          showStream={showSandStream}
        />
      )}
    </Svg>
  );
}

function HourglassBadgeIcon({
  active,
  sandColor,
  sandProgress,
  showSandStream,
  xml,
  testID,
}: HourglassBadgeIconProps) {
  const width = active
    ? HOURGLASS_BADGE_BASE_WIDTH * HOURGLASS_BADGE_ACTIVE_SCALE
    : HOURGLASS_BADGE_BASE_WIDTH;
  const height = active
    ? HOURGLASS_BADGE_BASE_HEIGHT * HOURGLASS_BADGE_ACTIVE_SCALE
    : HOURGLASS_BADGE_BASE_HEIGHT;
  const activeSandProgress = active ? sandProgress : undefined;
  const fallback = (
    <HourglassBadgeFallbackIcon
      width={width}
      height={height}
      testID={testID}
      sandColor={sandColor}
      sandProgress={activeSandProgress}
      showSandStream={showSandStream}
    />
  );

  if (!xml) return fallback;
  const renderedXml = injectHourglassSandOverlay(
    xml,
    activeSandProgress,
    sandColor,
    showSandStream,
  );

  return (
    <SvgXml
      xml={renderedXml}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      fallback={fallback}
      onError={() => undefined}
      testID={testID}
    />
  );
}

type HourglassBadgeProps = {
  currentLoop: number;
  testIDPrefix: string;
  borderColor?: string;
  marginBottom?: number;
  rowStyle?: StyleProp<ViewStyle>;
  badgeStyle?: StyleProp<ViewStyle>;
  sandColor?: string;
  sandProgress?: number;
  showSandStream?: boolean;
};

export function HourglassBadge({
  currentLoop,
  testIDPrefix,
  borderColor = BORDER_COLOR,
  marginBottom = 20,
  rowStyle,
  badgeStyle,
  sandColor = '#4B5CFF',
  sandProgress,
  showSandStream = false,
}: HourglassBadgeProps) {
  const hourglassXml = useHourglassBadgeXml();

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
              sandColor={sandColor}
              sandProgress={sandProgress}
              showSandStream={showSandStream}
              xml={hourglassXml}
              testID={`${testIDPrefix}-hourglass-badge-icon-${index + 1}`}
            />
          );
        })}
      </View>
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
            <View
              style={[
                styles.phaseTabDot,
                {
                  borderColor: phaseInactiveDotColor,
                  backgroundColor: phaseInactiveDotFilled ? phaseInactiveDotColor : 'transparent',
                },
                isActive
                  ? {
                      borderColor: activeDotColor,
                      backgroundColor: activeDotFilled ? activeDotColor : 'transparent',
                    }
                  : null,
              ]}
              testID={`${testIDPrefix}-phase-tab-${phase}-dot`}
            />
            <SizableText
              size="$3"
              style={[
                styles.phaseTabLabel,
                { color: phaseInactiveTextColor },
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
