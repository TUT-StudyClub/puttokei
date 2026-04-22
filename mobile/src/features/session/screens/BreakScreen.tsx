/**
 * 休憩フェーズ画面 (S-07 / S-08-2)。
 *
 * 休憩中は既存のタイマーと AI 採点進捗を表示する。休憩タイマー完了後は、
 * 参考画面に合わせて「休憩完了」→「次サイクル準備」の 2 段階 UI に切り替える。
 */
import { useIsFocused } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type GestureResponderEvent,
  Image,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  SafeAreaView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
  Svg,
  SvgXml,
} from 'react-native-svg';
import { SizableText, Spinner } from 'tamagui';

import { createSession } from '@/features/session/api/sessionApi';
import {
  CircularPhaseTimer,
  HourglassBadge,
  PhaseTabs,
  type SessionPhase,
  SessionSettingsButton,
} from '@/features/session/components/SessionPhaseChrome';
import { DEFAULT_TIMER } from '@/features/session/config';
import { useJudgment } from '@/features/session/hooks/useJudgment';
import { useSmoothRemainingSeconds, useTimer } from '@/features/session/hooks/useTimer';
import type { CreateSessionInput, Session } from '@/features/session/types';
import { LOOP_COUNT_MAX, useLoopStore } from '@/shared/stores/loopStore';
import { useTimerStore } from '@/shared/stores/timerStore';

const SETTINGS_ROUTE = '/(tabs)/settings' as unknown as Href;
const NEXT_CYCLE_HOURGLASS_ASSET = require('../../../../assets/images/hourglass_gradation.svg');
const NEXT_CYCLE_HOURGLASS_ASPECT_RATIO = 76.91 / 43.11;
const NEXT_CYCLE_IDLE_ROTATION_DEGREES = 5;
const NEXT_CYCLE_ROTATE_THRESHOLD_DEGREES = 360;
const NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES = 1080;
const NEXT_CYCLE_ROTATION_SENSITIVITY = 1.25;
const NEXT_CYCLE_PATH_ROTATION_DEGREES_PER_PIXEL = 1.15;
const NEXT_CYCLE_MIN_ROTATION_RADIUS = 48;
const NEXT_CYCLE_ROTATION_AREA_FALLBACK = { width: 320, height: 430 };

const CURRENT_PHASE: SessionPhase = 'break';

// 休憩中はグレー、次サイクル準備ではインプットと同じブルーを使う。
const BREAK_COLOR = '#9CA3AF';
const INPUT_COLOR = '#4B5CFF';
const TEXT_ACTIVE = '#2F2F2F';
const TEXT_INACTIVE = '#9CA3AF';
const DOT_INACTIVE = '#D9D9D9';
const BORDER_COLOR = '#E5E7EB';
const CAPTION_COLOR = '#777777';
const ERROR_COLOR = '#D92D20';

// 下部の「採点進捗カード」用トークン。濃い背景に青いプログレスバーを乗せる。
const PROGRESS_CARD_BG = '#2A2A2E';
const PROGRESS_CARD_TEXT = '#FFFFFF';
const PROGRESS_CARD_SUBTEXT = '#B5B7BC';
const PROGRESS_TRACK_COLOR = '#4A4A50';
const PROGRESS_FILL_COLOR = '#4B5CFF';

// 採点進捗の下限 / 上限。ready になるまでは 90% で頭打ちにする。
const PROGRESS_PENDING_MIN = 12;
const PROGRESS_PENDING_MAX = 90;

type BreakScreenMode = 'resting' | 'completed' | 'nextCycle';

const COMPLETED_PHASE_COLORS: Record<SessionPhase, string> = {
  input: '#A7D4F7',
  output: '#F8D8E4',
  break: '#C9C9C9',
};

const SVG_CSS_ATTRIBUTE_NAMES: Record<string, string> = {
  'clip-path': 'clipPath',
  'color-interpolation-filters': 'colorInterpolationFilters',
  'fill-rule': 'fillRule',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-width': 'strokeWidth',
};

const SVG_UNSUPPORTED_CSS_PROPERTIES = new Set(['isolation', 'mix-blend-mode']);

function cssPropertyToSvgAttribute(property: string) {
  return (
    SVG_CSS_ATTRIBUTE_NAMES[property] ??
    property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
  );
}

function cssDeclarationsToSvgAttributes(declarations: string) {
  return declarations
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
}

function inlineSvgClassStyles(xml: string) {
  const xmlWithoutUnsupportedHighlight = xml.replace(
    /\s*<rect class="cls-10" x="-9\.33" y="-28\.16" width="67\.08" height="107\.05"\/>/g,
    '',
  );
  const styleMatch = xmlWithoutUnsupportedHighlight.match(/<style>\s*([\s\S]*?)\s*<\/style>/);
  const stylesheet = styleMatch?.[1];
  if (!stylesheet) return xmlWithoutUnsupportedHighlight;

  const classRules: Record<string, string[]> = {};
  const classRulePattern = /\.([A-Za-z0-9_-]+)\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = classRulePattern.exec(stylesheet)) !== null) {
    const className = match[1];
    const declarations = match[2];
    if (!className || !declarations) continue;

    classRules[className] = cssDeclarationsToSvgAttributes(declarations);
  }

  return xmlWithoutUnsupportedHighlight
    .replace(/<style>[\s\S]*?<\/style>/g, '')
    .replace(/class="([^"]+)"/g, (_classAttribute: string, classNames: string) => {
      const attributes = classNames
        .split(/\s+/)
        .flatMap((className) => classRules[className] ?? []);

      return attributes.join(' ');
    });
}

type JudgingProgressCardProps = {
  progressPercent: number;
  isReady: boolean;
};

function JudgingProgressCard({ progressPercent, isReady }: JudgingProgressCardProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(progressPercent)));
  return (
    <View style={styles.progressCard} testID="break-progress-card">
      <View style={styles.progressHeaderRow}>
        <SizableText style={styles.progressHeaderLabel}>
          {isReady ? ' ' : 'テキストの解析...'}
        </SizableText>
        <SizableText style={styles.progressHeaderPercent} testID="break-progress-percent">
          {clamped}%
        </SizableText>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${clamped}%` }]} />
      </View>
      {isReady ? (
        <View style={styles.progressReadyBlock} testID="break-progress-ready">
          <SizableText style={styles.progressReadyTitle}>✓ 採点完了</SizableText>
          <SizableText style={styles.progressReadySub}>
            次のサイクルのインプットで{'\n'}結果を確認できます。
          </SizableText>
        </View>
      ) : null}
    </View>
  );
}

type HourglassGraphicProps = {
  size: number;
  rotation?: string;
  strokeColor?: string;
};

function HourglassGraphic({
  size,
  rotation = '0deg',
  strokeColor = INPUT_COLOR,
}: HourglassGraphicProps) {
  return (
    <View
      style={[
        styles.hourglassGraphicWrap,
        {
          width: size,
          height: size * 1.18,
          transform: [{ rotate: rotation }],
        },
      ]}
    >
      <Svg width={size} height={size * 1.18} viewBox="0 0 200 236" fill="none">
        <Defs>
          <SvgLinearGradient id="sandGradient" x1="100" y1="129" x2="100" y2="191">
            <Stop offset="0" stopColor="#F4E9FF" />
            <Stop offset="1" stopColor="#B766EA" />
          </SvgLinearGradient>
          <SvgLinearGradient id="glassShade" x1="100" y1="48" x2="100" y2="123">
            <Stop offset="0" stopColor="#F0F0F0" />
            <Stop offset="1" stopColor="#FFFFFF" />
          </SvgLinearGradient>
        </Defs>
        <Path
          d="M43 18 H157 V43 C157 65 130 76 125 100 C120 124 157 139 157 164 V214 H43 V164 C43 139 80 124 75 100 C70 76 43 65 43 43 Z"
          fill="#FFFFFF"
          stroke="#FFFFFF"
          strokeWidth={18}
          strokeLinejoin="round"
        />
        <Path
          d="M43 18 H157 V43 C157 65 130 76 125 100 C120 124 157 139 157 164 V214 H43 V164 C43 139 80 124 75 100 C70 76 43 65 43 43 Z"
          fill="#FFFFFF"
          stroke={strokeColor}
          strokeWidth={8}
          strokeLinejoin="round"
        />
        <Path
          d="M64 62 C78 49 122 49 136 62 C132 82 114 96 103 109 C101 111 99 111 97 109 C86 96 68 82 64 62 Z"
          fill="url(#glassShade)"
        />
        <Path
          d="M96 109 C94 118 89 126 82 133 C93 129 107 129 118 133 C111 126 106 118 104 109 Z"
          fill="#F4F4F4"
        />
        <Path
          d="M64 173 C72 145 86 131 100 131 C114 131 128 145 136 173 C123 192 77 192 64 173 Z"
          fill="url(#sandGradient)"
        />
        <Ellipse cx={100} cy={72} rx={42} ry={21} fill="#EFEFEF" opacity={0.78} />
      </Svg>
    </View>
  );
}

function NextCycleHourglassAsset() {
  const [xml, setXml] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const source = Image.resolveAssetSource(NEXT_CYCLE_HOURGLASS_ASSET);
    const uri = source?.uri;
    if (!uri || typeof fetch !== 'function') return;

    fetch(uri)
      .then((response) => {
        if (!response.ok && !(response.status === 0 && uri.startsWith('file://'))) {
          throw new Error(`Failed to load next cycle hourglass SVG: ${response.status}`);
        }
        return response.text();
      })
      .then((loadedXml) => {
        if (isMounted) {
          setXml(inlineSvgClassStyles(loadedXml));
        }
      })
      .catch(() => {
        if (isMounted) {
          setXml(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const fallback = <HourglassGraphic size={220} strokeColor={INPUT_COLOR} />;

  if (!xml) return fallback;

  return (
    <SvgXml
      xml={xml}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      fallback={fallback}
      onError={() => undefined}
    />
  );
}

const CONFETTI_PIECES = [
  { left: '0%', top: 18, width: 5, height: 10, color: '#DCE6FF', rotate: '-18deg' },
  { left: '8%', top: 50, width: 6, height: 10, color: '#F9CFD9', rotate: '8deg' },
  { left: '2%', top: 88, width: 5, height: 11, color: '#F6D7D2', rotate: '-7deg' },
  { left: '12%', top: 126, width: 5, height: 10, color: '#DCEBEE', rotate: '-34deg' },
  { left: '6%', top: 158, width: 8, height: 5, color: '#DDE5FF', rotate: '-3deg' },
  { left: '16%', top: 178, width: 6, height: 10, color: '#F7CDD8', rotate: '14deg' },
  { left: '21%', top: 28, width: 5, height: 11, color: '#F6D7D2', rotate: '-14deg' },
  { left: '18%', top: 72, width: 11, height: 6, color: '#DDF0F3', rotate: '-9deg' },
  { left: '24%', top: 148, width: 9, height: 5, color: '#DDE5FF', rotate: '2deg' },
  { left: '36%', top: 0, width: 10, height: 5, color: '#DDF0F3', rotate: '-9deg' },
  { left: '50%', top: 4, width: 6, height: 11, color: '#F7CDD8', rotate: '9deg' },
  { left: '64%', top: 0, width: 9, height: 5, color: '#DDE5FF', rotate: '5deg' },
  { left: '34%', top: 186, width: 9, height: 5, color: '#DDE5FF', rotate: '-5deg' },
  { left: '52%', top: 188, width: 5, height: 9, color: '#DDEBEE', rotate: '76deg' },
  { left: '66%', top: 184, width: 10, height: 5, color: '#F7CDD8', rotate: '9deg' },
  { left: '95%', top: 28, width: 5, height: 9, color: '#D9E3FF', rotate: '-22deg' },
  { left: '86%', top: 62, width: 7, height: 11, color: '#F9CFD9', rotate: '12deg' },
  { left: '92%', top: 98, width: 6, height: 10, color: '#F7CDD8', rotate: '10deg' },
  { left: '98%', top: 132, width: 5, height: 9, color: '#DDEBEE', rotate: '76deg' },
  { left: '86%', top: 166, width: 10, height: 5, color: '#DDF0F3', rotate: '7deg' },
  { left: '94%', top: 184, width: 10, height: 5, color: '#F7CDD8', rotate: '9deg' },
  { left: '78%', top: 36, width: 8, height: 11, color: '#F7CDD8', rotate: '12deg' },
  { left: '81%', top: 84, width: 9, height: 5, color: '#DDE5FF', rotate: '0deg' },
  { left: '78%', top: 142, width: 5, height: 10, color: '#DCEBEE', rotate: '15deg' },
] as const;

function ConfettiBurst() {
  return (
    <View style={styles.confettiLayer} pointerEvents="none">
      {CONFETTI_PIECES.map((piece, index) => (
        <View
          key={index}
          style={[
            styles.confettiPiece,
            {
              left: piece.left,
              top: piece.top,
              width: piece.width,
              height: piece.height,
              backgroundColor: piece.color,
              transform: [{ rotate: piece.rotate }],
            },
          ]}
        />
      ))}
      <Svg width={26} height={26} viewBox="0 0 36 36" style={styles.confettiSmile}>
        <Circle cx={18} cy={18} r={12} stroke="#FFFFFF" strokeWidth={3} fill="none" />
        <Circle cx={14} cy={15} r={1.8} fill="#FFFFFF" />
        <Circle cx={22} cy={15} r={1.8} fill="#FFFFFF" />
        <Path
          d="M13 21 C15.6 25 20.4 25 23 21"
          stroke="#FFFFFF"
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <Svg width={28} height={34} viewBox="0 0 28 34" style={styles.confettiBulb}>
        <Path
          d="M14 2 C7.8 2 4 6.2 4 11.2 C4 14.5 5.7 16.7 8.1 19.2 C9.2 20.4 9.8 21.8 9.8 23.2 H18.2 C18.2 21.8 18.8 20.4 19.9 19.2 C22.3 16.7 24 14.5 24 11.2 C24 6.2 20.2 2 14 2 Z"
          stroke="#FFFFFF"
          strokeWidth={3}
          strokeLinejoin="round"
          fill="none"
        />
        <Path d="M10 27 H18" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
        <Path d="M11 32 H17" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
      </Svg>
      <Svg width={28} height={28} viewBox="0 0 38 38" style={styles.confettiStarLeft}>
        <Path
          d="M19 4 L23 15 L34 15 L25 22 L29 34 L19 27 L9 34 L13 22 L4 15 L15 15 Z"
          stroke="#FFFFFF"
          strokeWidth={3}
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
      <Svg width={30} height={30} viewBox="0 0 42 42" style={styles.confettiStarRight}>
        <Path
          d="M21 5 L25 16 L36 16 L27 23 L31 36 L21 29 L11 36 L15 23 L6 16 L17 16 Z"
          stroke="#FFFFFF"
          strokeWidth={3}
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

function CompletionSticker() {
  return (
    <View style={styles.stickerStage}>
      <ConfettiBurst />
      <HourglassGraphic size={118} rotation="17deg" />
    </View>
  );
}

type BreakCompletedViewProps = {
  currentLoop: number;
  onNextCycle: () => void;
};

function BreakCompletedView({ currentLoop, onNextCycle }: BreakCompletedViewProps) {
  return (
    <View style={styles.completedContent} testID="break-completed-view">
      <View style={styles.completedStack}>
        <ExpoLinearGradient
          colors={['#FF5DA2', '#5A6BFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.completedGradientBorder}
        >
          <View style={styles.completedWhiteBorder}>
            <View style={styles.completedCard} testID="break-complete-card">
              <SizableText style={styles.completedTitle}>お疲れ様でした！</SizableText>
              <SizableText style={styles.completedTitle}>
                記念すべき{currentLoop}サイクル目です！
              </SizableText>

              <CompletionSticker />

              <Pressable
                accessibilityRole="button"
                onPress={onNextCycle}
                style={({ pressed }) => [
                  styles.nextCycleButton,
                  pressed ? styles.buttonPressed : null,
                ]}
                testID="break-next-cycle-button"
              >
                <SizableText style={styles.nextCycleButtonText}>次のサイクルへ</SizableText>
              </Pressable>
            </View>
          </View>
        </ExpoLinearGradient>

        <View style={styles.resultNoticeCard}>
          <SizableText style={styles.resultNoticeText}>結果を確認できます。</SizableText>
        </View>
      </View>
    </View>
  );
}

type NextCycleReadyViewProps = {
  isStarting: boolean;
  hasStartError: boolean;
  onStart: () => void;
  onCancel: () => void;
};

function TurnArrow() {
  return (
    <Svg width={92} height={120} viewBox="0 0 92 120" fill="none">
      <Path
        d="M58 10 C70 43 62 76 31 95"
        stroke="#2F2F2F"
        strokeWidth={14}
        strokeLinecap="butt"
        fill="none"
      />
      <Path d="M27 71 L28 108 L60 89 Z" fill="#2F2F2F" />
    </Svg>
  );
}

function clampRotation(rotation: number) {
  return Math.max(
    -NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES,
    Math.min(NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES, rotation),
  );
}

function normalizeRotationDelta(delta: number) {
  if (delta > 180) return delta - 360;
  if (delta < -180) return delta + 360;
  return delta;
}

function getGestureAngle(
  event: GestureResponderEvent,
  areaSize: { width: number; height: number },
) {
  const { locationX, locationY } = event.nativeEvent;
  if (!Number.isFinite(locationX) || !Number.isFinite(locationY)) return null;

  const dx = locationX - areaSize.width / 2;
  const dy = locationY - areaSize.height / 2;
  if (Math.hypot(dx, dy) < NEXT_CYCLE_MIN_ROTATION_RADIUS) return null;

  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function getGesturePoint(event: GestureResponderEvent) {
  const { locationX, locationY, pageX, pageY } = event.nativeEvent;
  if (Number.isFinite(pageX) && Number.isFinite(pageY)) {
    return { x: pageX, y: pageY };
  }
  if (Number.isFinite(locationX) && Number.isFinite(locationY)) {
    return { x: locationX, y: locationY };
  }

  return null;
}

function NextCycleReadyView({
  isStarting,
  hasStartError,
  onStart,
  onCancel,
}: NextCycleReadyViewProps) {
  const hourglassRotation = useRef(new Animated.Value(-NEXT_CYCLE_IDLE_ROTATION_DEGREES)).current;
  const idleAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  const isCompactHeight = windowHeight < 820;
  const hourglassHeight = isCompactHeight ? 258 : 286;
  const hourglassWidth = hourglassHeight / NEXT_CYCLE_HOURGLASS_ASPECT_RATIO;
  const rotationAreaSize = useRef(NEXT_CYCLE_ROTATION_AREA_FALLBACK);
  const lastTouchAngle = useRef<number | null>(null);
  const lastTouchPoint = useRef<{ x: number; y: number } | null>(null);
  const draggedRotation = useRef(0);
  const pathRotation = useRef(0);
  const hasCompletedRotationGesture = useRef(false);
  const hasTriggeredRotationStart = useRef(false);

  const startIdleAnimation = useCallback(() => {
    idleAnimation.current?.stop();
    hourglassRotation.setValue(-NEXT_CYCLE_IDLE_ROTATION_DEGREES);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(hourglassRotation, {
          toValue: NEXT_CYCLE_IDLE_ROTATION_DEGREES,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(hourglassRotation, {
          toValue: -NEXT_CYCLE_IDLE_ROTATION_DEGREES,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    idleAnimation.current = animation;
    animation.start();
  }, [hourglassRotation]);

  useEffect(() => {
    startIdleAnimation();
    return () => {
      idleAnimation.current?.stop();
    };
  }, [startIdleAnimation]);

  const hourglassRotationStyle = hourglassRotation.interpolate({
    inputRange: [-NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES, NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES],
    outputRange: [
      `${-NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES}deg`,
      `${NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES}deg`,
    ],
  });

  const triggerNextCycleByRotation = useCallback(() => {
    if (hasTriggeredRotationStart.current || isStarting) return;

    hasTriggeredRotationStart.current = true;
    onStart();
  }, [isStarting, onStart]);

  const handleRotationAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;

    rotationAreaSize.current = { width, height };
  }, []);

  const rotationResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => !isStarting,
        onStartShouldSetPanResponder: () => !isStarting,
        onMoveShouldSetPanResponderCapture: () => !isStarting,
        onMoveShouldSetPanResponder: () => !isStarting,
        onPanResponderGrant: (event) => {
          idleAnimation.current?.stop();
          lastTouchAngle.current = getGestureAngle(event, rotationAreaSize.current);
          lastTouchPoint.current = getGesturePoint(event);
          draggedRotation.current = 0;
          pathRotation.current = 0;
          hasCompletedRotationGesture.current = false;
          hourglassRotation.setValue(0);
          hasTriggeredRotationStart.current = false;
        },
        onPanResponderMove: (event) => {
          if (isStarting || hasTriggeredRotationStart.current) return;

          const currentPoint = getGesturePoint(event);
          if (currentPoint !== null) {
            if (lastTouchPoint.current !== null) {
              const dx = currentPoint.x - lastTouchPoint.current.x;
              const dy = currentPoint.y - lastTouchPoint.current.y;
              pathRotation.current +=
                Math.hypot(dx, dy) * NEXT_CYCLE_PATH_ROTATION_DEGREES_PER_PIXEL;
            }
            lastTouchPoint.current = currentPoint;
          }

          const currentAngle = getGestureAngle(event, rotationAreaSize.current);
          if (currentAngle !== null && lastTouchAngle.current === null) {
            lastTouchAngle.current = currentAngle;
            return;
          }

          if (currentAngle !== null && lastTouchAngle.current !== null) {
            const rotationDelta =
              normalizeRotationDelta(lastTouchAngle.current - currentAngle) *
              NEXT_CYCLE_ROTATION_SENSITIVITY;
            const nextRotation = clampRotation(draggedRotation.current + rotationDelta);
            draggedRotation.current = nextRotation;
            hourglassRotation.setValue(nextRotation);
            lastTouchAngle.current = currentAngle;
          }

          hasCompletedRotationGesture.current =
            Math.max(Math.abs(draggedRotation.current), pathRotation.current) >=
            NEXT_CYCLE_ROTATE_THRESHOLD_DEGREES;
        },
        onPanResponderRelease: () => {
          const shouldStart = hasCompletedRotationGesture.current;
          lastTouchAngle.current = null;
          lastTouchPoint.current = null;
          draggedRotation.current = 0;
          pathRotation.current = 0;
          hasCompletedRotationGesture.current = false;

          if (shouldStart) {
            triggerNextCycleByRotation();
          } else {
            hourglassRotation.setValue(0);
            startIdleAnimation();
          }
        },
        onPanResponderTerminate: () => {
          lastTouchAngle.current = null;
          lastTouchPoint.current = null;
          draggedRotation.current = 0;
          pathRotation.current = 0;
          hasCompletedRotationGesture.current = false;
          if (!hasTriggeredRotationStart.current) {
            hourglassRotation.setValue(0);
            startIdleAnimation();
          }
        },
      }),
    [hourglassRotation, isStarting, startIdleAnimation, triggerNextCycleByRotation],
  );

  return (
    <View style={styles.nextReadyContent} testID="break-next-cycle-view">
      <View
        accessibilityLabel="砂時計を回して次のインプットを開始"
        onLayout={handleRotationAreaLayout}
        style={styles.nextReadyRotationArea}
        testID="break-next-cycle-rotation-area"
        {...rotationResponder.panHandlers}
      >
        <SizableText style={styles.nextReadyTitle}>
          砂時計を回して次のサイクルを回そう！
        </SizableText>

        <View
          style={[
            styles.nextReadyGraphicArea,
            isCompactHeight ? styles.nextReadyGraphicAreaCompact : null,
          ]}
        >
          <View
            style={[styles.nextHourglassButton, isStarting ? styles.buttonDisabled : null]}
            testID="break-next-cycle-hourglass"
          >
            <Animated.View
              style={[
                styles.nextCycleHourglassAsset,
                {
                  width: hourglassWidth,
                  height: hourglassHeight,
                  transform: [{ rotate: hourglassRotationStyle }],
                },
              ]}
            >
              <NextCycleHourglassAsset />
            </Animated.View>
            {isStarting ? (
              <View style={styles.nextStartingOverlay}>
                <Spinner color={INPUT_COLOR} />
              </View>
            ) : null}
          </View>

          <View style={styles.turnArrow}>
            <TurnArrow />
          </View>
        </View>

        <SizableText style={styles.nextReadyDescription}>
          回すと次のインプットがスタートします。{'\n'}
          スタート後、アウトプットの評価を見ることができます。
        </SizableText>
      </View>

      <View style={styles.nextReadyBottom}>
        {hasStartError ? (
          <SizableText style={styles.errorText} testID="break-next-cycle-error">
            次のサイクルを開始できませんでした。通信環境を確認してもう一度お試しください。
          </SizableText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [styles.abortButton, pressed ? styles.buttonPressed : null]}
          testID="break-next-cycle-cancel"
        >
          <SizableText style={styles.abortButtonText}>中断する</SizableText>
        </Pressable>
      </View>
    </View>
  );
}

type SessionRouteParams = {
  id?: string;
  input?: string;
  output?: string;
  break?: string;
};

export function BreakScreen() {
  const params = useLocalSearchParams<SessionRouteParams>();
  const sessionId = params.id ?? '';
  const inputMinutes = Number(params.input) || DEFAULT_TIMER.input_minutes;
  const outputMinutes = Number(params.output) || DEFAULT_TIMER.output_minutes;
  const breakMinutes = Number(params.break) || DEFAULT_TIMER.break_minutes;

  const router = useRouter();
  const isFocused = useIsFocused();
  const currentLoop = useLoopStore((s) => s.currentLoop);
  const incrementLoop = useLoopStore((s) => s.incrementLoop);
  const [screenMode, setScreenMode] = useState<BreakScreenMode>('resting');

  const judgmentQuery = useJudgment(sessionId);
  const isJudgmentReady = judgmentQuery.data?.kind === 'ready';

  const smoothRemainingSeconds = useSmoothRemainingSeconds();
  const totalSeconds = useTimerStore((s) => s.totalSeconds);
  const elapsedRatio =
    totalSeconds > 0 ? Math.min(1, Math.max(0, 1 - smoothRemainingSeconds / totalSeconds)) : 0;
  const pendingProgress = Math.round(
    PROGRESS_PENDING_MIN + elapsedRatio * (PROGRESS_PENDING_MAX - PROGRESS_PENDING_MIN),
  );
  const progressPercent = isJudgmentReady ? 100 : pendingProgress;

  const { start, reset } = useTimer({
    enabled: isFocused && screenMode === 'resting',
    onComplete: () => {
      setScreenMode('completed');
    },
  });

  const createNextCycle = useMutation<Session, Error, CreateSessionInput>({
    mutationFn: createSession,
    onSuccess: (session) => {
      reset();
      incrementLoop();
      router.push({
        pathname: '/session/[id]/input',
        params: {
          id: session.id,
          input: String(session.input_minutes),
          output: String(session.output_minutes),
          break: String(session.break_minutes),
        },
      });
    },
  });

  useEffect(() => {
    setScreenMode('resting');
    start('break', breakMinutes * 60);
    return () => {
      reset();
    };
  }, [breakMinutes, reset, sessionId, start]);

  const handleStartNextCycle = () => {
    if (createNextCycle.isPending) return;
    createNextCycle.mutate({
      subject: '未設定',
      topic: '未設定',
      input_minutes: inputMinutes,
      output_minutes: outputMinutes,
      break_minutes: breakMinutes,
    });
  };

  const handleCancelNextCycle = () => {
    reset();
    router.replace('/(tabs)');
  };

  const captionText = isJudgmentReady
    ? '休憩後次のサイクルを回すか決めることができます。'
    : 'AI採点中です。ゆっくり休憩してください。';

  const isNextCycleMode = screenMode === 'nextCycle';
  const usesCompletedPhasePalette = screenMode === 'completed' || isNextCycleMode;
  const displayedPhase = usesCompletedPhasePalette ? null : CURRENT_PHASE;
  const phaseActiveColor = BREAK_COLOR;
  const badgeActiveColor = screenMode === 'resting' ? BREAK_COLOR : INPUT_COLOR;
  const displayedLoop = isNextCycleMode ? Math.min(currentLoop + 1, LOOP_COUNT_MAX) : currentLoop;
  const completedPhaseColors = usesCompletedPhasePalette ? COMPLETED_PHASE_COLORS : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container} testID="break-root">
        <SessionSettingsButton
          onPress={() => router.push(SETTINGS_ROUTE)}
          testID="break-settings-button"
        />

        <View style={styles.badgeStack}>
          <HourglassBadge
            currentLoop={displayedLoop}
            testIDPrefix="break"
            activeColor={badgeActiveColor}
            inactiveColor={TEXT_INACTIVE}
            borderColor={BORDER_COLOR}
            marginBottom={0}
          />
        </View>

        <PhaseTabs
          activePhase={displayedPhase}
          testIDPrefix="break"
          activeDotColor={phaseActiveColor}
          activeTextColor={TEXT_ACTIVE}
          inactiveDotFilled={usesCompletedPhasePalette}
          inactiveDotColor={DOT_INACTIVE}
          inactiveDotColors={completedPhaseColors}
          inactiveTextColors={completedPhaseColors}
          marginBottom={isNextCycleMode ? 18 : 20}
        />

        {screenMode === 'resting' ? (
          <>
            <View style={styles.timerStage}>
              <CircularPhaseTimer
                phase={CURRENT_PHASE}
                primaryColor={BREAK_COLOR}
                trackColor={BORDER_COLOR}
                testID="break-circular-timer"
              />
              <SizableText style={styles.timerCaption} testID="break-timer-caption">
                {captionText}
              </SizableText>
            </View>

            <JudgingProgressCard progressPercent={progressPercent} isReady={isJudgmentReady} />
          </>
        ) : screenMode === 'completed' ? (
          <BreakCompletedView
            currentLoop={currentLoop}
            onNextCycle={() => setScreenMode('nextCycle')}
          />
        ) : (
          <NextCycleReadyView
            isStarting={createNextCycle.isPending}
            hasStartError={createNextCycle.isError}
            onStart={handleStartNextCycle}
            onCancel={handleCancelNextCycle}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    paddingTop: 12,
    paddingRight: 24,
    paddingBottom: 32,
    paddingLeft: 24,
  },
  badgeStack: {
    alignSelf: 'center',
    alignItems: 'center',
    width: 300,
    marginBottom: 20,
  },
  timerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  timerCaption: {
    color: CAPTION_COLOR,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  progressCard: {
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: PROGRESS_CARD_BG,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressHeaderLabel: {
    color: PROGRESS_CARD_TEXT,
    fontSize: 13,
    fontWeight: '600',
  },
  progressHeaderPercent: {
    color: PROGRESS_CARD_TEXT,
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: PROGRESS_TRACK_COLOR,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: PROGRESS_FILL_COLOR,
  },
  progressReadyBlock: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  progressReadyTitle: {
    color: PROGRESS_CARD_TEXT,
    fontSize: 15,
    fontWeight: '700',
  },
  progressReadySub: {
    color: PROGRESS_CARD_SUBTEXT,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  completedContent: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 8,
  },
  completedStack: {
    alignItems: 'center',
    width: '100%',
  },
  completedGradientBorder: {
    zIndex: 1,
    width: '87%',
    borderRadius: 24,
    padding: 8,
  },
  completedWhiteBorder: {
    width: '100%',
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  completedCard: {
    alignItems: 'center',
    width: '100%',
    minHeight: 348,
    paddingTop: 30,
    paddingRight: 18,
    paddingBottom: 24,
    paddingLeft: 18,
    borderRadius: 16,
    backgroundColor: '#303133',
    overflow: 'hidden',
  },
  completedTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 26,
    textAlign: 'center',
  },
  stickerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 196,
    marginTop: 10,
    marginBottom: 14,
    overflow: 'hidden',
  },
  hourglassGraphicWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  confettiPiece: {
    position: 'absolute',
    borderRadius: 3,
  },
  confettiSmile: {
    position: 'absolute',
    top: 30,
    left: '10%',
  },
  confettiBulb: {
    position: 'absolute',
    top: 72,
    right: '7%',
  },
  confettiStarLeft: {
    position: 'absolute',
    top: 120,
    left: '5%',
  },
  confettiStarRight: {
    position: 'absolute',
    top: 132,
    right: '8%',
  },
  nextCycleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 190,
    height: 56,
    paddingHorizontal: 22,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 16,
  },
  nextCycleButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  resultNoticeCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '76%',
    minHeight: 56,
    marginTop: -14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderRadius: 14,
    backgroundColor: '#303133',
  },
  resultNoticeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  nextReadyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  nextReadyRotationArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  nextReadyTitle: {
    color: TEXT_ACTIVE,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 25,
    textAlign: 'center',
  },
  nextReadyGraphicArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 280,
    marginTop: 12,
  },
  nextReadyGraphicAreaCompact: {
    minHeight: 252,
    marginTop: 10,
  },
  nextHourglassButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextCycleHourglassAsset: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStartingOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
  },
  turnArrow: {
    position: 'absolute',
    right: 24,
    bottom: 48,
  },
  nextReadyBottom: {
    alignItems: 'center',
    width: '100%',
    gap: 14,
  },
  nextReadyDescription: {
    color: '#9B9B9B',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  abortButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 62,
    borderWidth: 1.5,
    borderColor: '#777777',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  abortButtonText: {
    color: '#777777',
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 25,
  },
  errorText: {
    color: ERROR_COLOR,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.72,
  },
  buttonDisabled: {
    opacity: 0.58,
  },
});
