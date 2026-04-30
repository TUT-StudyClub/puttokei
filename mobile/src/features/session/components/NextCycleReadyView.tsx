import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import ReAnimated, {
  Easing as ReEasing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Path, Svg } from 'react-native-svg';
import { SizableText, Spinner } from 'tamagui';

import {
  HOURGLASS_BADGE_ACTIVE_SCALE,
  HOURGLASS_VARIANTS,
  HourglassBadgeIcon,
  HourglassBadgeSandOverlay,
  type HourglassSandLayer,
  useHourglassBadgeXml,
} from '@/features/session/components/SessionPhaseChrome';
import { HOURGLASS_BREAK_SAND_OPACITY, HOURGLASS_SAND_COLORS } from '@/features/session/config';
import { APP_COLORS } from '@/shared/lib/colors';

const NEXT_CYCLE_HOURGLASS_ASPECT_RATIO =
  HOURGLASS_VARIANTS.blue.baseHeight / HOURGLASS_VARIANTS.blue.baseWidth;
const NEXT_CYCLE_ENTRANCE_DURATION_MS = 600;
const NEXT_CYCLE_IDLE_ROTATION_DEGREES = 5;
const NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES = NEXT_CYCLE_IDLE_ROTATION_DEGREES * 1.15;
const NEXT_CYCLE_SAND_SLOSH_DELAY_MS = 180;
const NEXT_CYCLE_ROTATE_THRESHOLD_DEGREES = 360;
const NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES = 1080;
const NEXT_CYCLE_ROTATION_SENSITIVITY = 1.25;
const NEXT_CYCLE_PATH_ROTATION_DEGREES_PER_PIXEL = 1.15;
const NEXT_CYCLE_MIN_ROTATION_RADIUS = 48;
const NEXT_CYCLE_ROTATION_AREA_FALLBACK = { width: 320, height: 430 };
const NEXT_CYCLE_DRAIN_DURATION_MS = 800;
const NEXT_CYCLE_RETURN_DURATION_MS = 600;
const NEXT_CYCLE_MIX_CATCHUP_DURATION_MS = 150;

const INPUT_COLOR = APP_COLORS.input;
const TEXT_ACTIVE = APP_COLORS.textPrimary;
const ERROR_COLOR = APP_COLORS.error;

const NEXT_CYCLE_FULL_SAND_LAYERS: readonly HourglassSandLayer[] = [
  { label: 'input', color: HOURGLASS_SAND_COLORS.input, weight: 1, progress: 1 },
  { label: 'output', color: HOURGLASS_SAND_COLORS.output, weight: 1, progress: 1 },
  {
    label: 'break',
    color: HOURGLASS_SAND_COLORS.break,
    weight: 1,
    progress: 1,
    opacity: HOURGLASS_BREAK_SAND_OPACITY,
  },
];

type ExitPhase = 'draining' | 'returning' | 'done';

export type NextCycleReadyViewProps = {
  isStarting: boolean;
  hasStartError: boolean;
  onStart: () => void;
  onCancel: () => void;
  entranceOrigin: { x: number; y: number } | null;
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

export function NextCycleReadyView({
  isStarting,
  hasStartError,
  onStart,
  onCancel,
  entranceOrigin,
}: NextCycleReadyViewProps) {
  const hourglassRotation = useRef(new Animated.Value(-NEXT_CYCLE_IDLE_ROTATION_DEGREES)).current;
  const idleAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const sandSloshValue = useRef(
    new Animated.Value(-NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES),
  ).current;
  const sandIdleAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const [surfaceTilt, setSurfaceTilt] = useState(0);
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

  const blueHourglassXml = useHourglassBadgeXml(HOURGLASS_VARIANTS.blue.asset);
  const blueHourglassConfig = HOURGLASS_VARIANTS.blue;
  const centerHourglassRef = useRef<View>(null);
  const entranceProgress = useSharedValue(0);
  const entranceOffsetX = useSharedValue(0);
  const entranceOffsetY = useSharedValue(0);
  const entranceStartScale = useSharedValue(1);
  const entranceOpacity = useSharedValue(entranceOrigin ? 0 : 1);
  const [hasLanded, setHasLanded] = useState(!entranceOrigin);

  const mixProgress = useSharedValue(0);
  const [drainProgress, setDrainProgress] = useState(1);
  const [exitPhase, setExitPhase] = useState<ExitPhase | null>(null);
  const isExiting = exitPhase !== null;

  const mixedSandLayers = useMemo<readonly HourglassSandLayer[]>(
    () => [
      {
        label: 'mixed',
        color: HOURGLASS_SAND_COLORS.mixed,
        weight: 1,
        progress: drainProgress,
      },
    ],
    [drainProgress],
  );

  const startIdleAnimation = useCallback(() => {
    idleAnimation.current?.stop();
    sandIdleAnimation.current?.stop();
    hourglassRotation.setValue(-NEXT_CYCLE_IDLE_ROTATION_DEGREES);
    sandSloshValue.setValue(-NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES);

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

    const sandAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(NEXT_CYCLE_SAND_SLOSH_DELAY_MS),
        Animated.timing(sandSloshValue, {
          toValue: NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sandSloshValue, {
          toValue: -NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    sandIdleAnimation.current = sandAnimation;
    sandAnimation.start();
  }, [hourglassRotation, sandSloshValue]);

  useEffect(() => {
    if (!hasLanded || isExiting) return;
    startIdleAnimation();
    return () => {
      idleAnimation.current?.stop();
      sandIdleAnimation.current?.stop();
    };
  }, [hasLanded, isExiting, startIdleAnimation]);

  useEffect(() => {
    const id = sandSloshValue.addListener(({ value }) => {
      const next = Math.max(-1, Math.min(1, value / NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES));
      setSurfaceTilt(next);
    });
    return () => {
      sandSloshValue.removeListener(id);
    };
  }, [sandSloshValue]);

  const handleCenterHourglassLayout = useCallback(() => {
    if (!entranceOrigin) {
      entranceOpacity.value = 1;
      return;
    }
    const node = centerHourglassRef.current;
    if (!node) {
      entranceOpacity.value = 1;
      setHasLanded(true);
      return;
    }
    node.measureInWindow((x, y, w, h) => {
      if (!w || !h) {
        entranceOpacity.value = 1;
        setHasLanded(true);
        return;
      }
      const centerX = x + w / 2;
      const centerY = y + h / 2;
      const badgeWidth = HOURGLASS_VARIANTS.blue.baseWidth * HOURGLASS_BADGE_ACTIVE_SCALE;
      entranceOffsetX.value = entranceOrigin.x - centerX;
      entranceOffsetY.value = entranceOrigin.y - centerY;
      entranceStartScale.value = badgeWidth / hourglassWidth;
      entranceProgress.value = 0;
      entranceOpacity.value = 1;
      entranceProgress.value = withTiming(
        1,
        {
          duration: NEXT_CYCLE_ENTRANCE_DURATION_MS,
          easing: ReEasing.out(ReEasing.cubic),
        },
        (finished) => {
          if (finished) runOnJS(setHasLanded)(true);
        },
      );
    });
  }, [
    entranceOffsetX,
    entranceOffsetY,
    entranceOpacity,
    entranceOrigin,
    entranceProgress,
    entranceStartScale,
    hourglassWidth,
  ]);

  const entranceAnimatedStyle = useAnimatedStyle(() => {
    const t = entranceProgress.value;
    return {
      opacity: entranceOpacity.value,
      transform: [
        { translateX: entranceOffsetX.value * (1 - t) },
        { translateY: entranceOffsetY.value * (1 - t) },
        { scale: entranceStartScale.value + (1 - entranceStartScale.value) * t },
      ],
    };
  });

  const blueLayerStyle = useAnimatedStyle(() => ({ opacity: 1 - mixProgress.value }));
  const purpleLayerStyle = useAnimatedStyle(() => ({ opacity: mixProgress.value }));

  const hourglassRotationStyle = hourglassRotation.interpolate({
    inputRange: [-NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES, NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES],
    outputRange: [
      `${-NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES}deg`,
      `${NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES}deg`,
    ],
  });

  const sandSloshRotationStyle = sandSloshValue.interpolate({
    inputRange: [-NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES, NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES],
    outputRange: [
      `${-NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES}deg`,
      `${NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES}deg`,
    ],
    extrapolate: 'clamp',
  });

  const sandOverlayViewBox = `0 0 ${blueHourglassConfig.viewBoxWidth} ${blueHourglassConfig.viewBoxHeight}`;
  const onStartRef = useRef(onStart);

  useEffect(() => {
    onStartRef.current = onStart;
  }, [onStart]);

  const triggerNextCycleByRotation = useCallback(() => {
    if (hasTriggeredRotationStart.current || isStarting) return;

    hasTriggeredRotationStart.current = true;

    if (!entranceOrigin) {
      onStart();
      return;
    }

    idleAnimation.current?.stop();
    sandIdleAnimation.current?.stop();
    hourglassRotation.setValue(0);
    sandSloshValue.setValue(0);

    if (mixProgress.value < 1) {
      mixProgress.value = withTiming(1, {
        duration: NEXT_CYCLE_MIX_CATCHUP_DURATION_MS,
        easing: ReEasing.out(ReEasing.cubic),
      });
    }

    setDrainProgress(1);
    setExitPhase('draining');
  }, [entranceOrigin, hourglassRotation, isStarting, mixProgress, onStart, sandSloshValue]);

  useEffect(() => {
    if (exitPhase !== 'draining') return;
    let rafId: number | null = null;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / NEXT_CYCLE_DRAIN_DURATION_MS);
      const eased = t * t;
      setDrainProgress(Math.max(0, 1 - eased));
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setExitPhase('returning');
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [exitPhase]);

  useEffect(() => {
    if (exitPhase !== 'returning') return;
    entranceProgress.value = withTiming(
      0,
      { duration: NEXT_CYCLE_RETURN_DURATION_MS, easing: ReEasing.in(ReEasing.cubic) },
      (returned) => {
        if (returned) runOnJS(setExitPhase)('done');
      },
    );
  }, [entranceProgress, exitPhase]);

  useEffect(() => {
    if (exitPhase !== 'done') return;
    onStartRef.current();
  }, [exitPhase]);

  const handleRotationAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;

    rotationAreaSize.current = { width, height };
  }, []);

  const rotationResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => hasLanded && !isExiting && !isStarting,
        onStartShouldSetPanResponder: () => hasLanded && !isExiting && !isStarting,
        onMoveShouldSetPanResponderCapture: () => hasLanded && !isExiting && !isStarting,
        onMoveShouldSetPanResponder: () => hasLanded && !isExiting && !isStarting,
        onPanResponderGrant: (event) => {
          idleAnimation.current?.stop();
          sandIdleAnimation.current?.stop();
          lastTouchAngle.current = getGestureAngle(event, rotationAreaSize.current);
          lastTouchPoint.current = getGesturePoint(event);
          draggedRotation.current = 0;
          pathRotation.current = 0;
          hasCompletedRotationGesture.current = false;
          hourglassRotation.setValue(0);
          sandSloshValue.setValue(0);
          hasTriggeredRotationStart.current = false;
          mixProgress.value = 0;
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
              normalizeRotationDelta(currentAngle - lastTouchAngle.current) *
              NEXT_CYCLE_ROTATION_SENSITIVITY;
            const nextRotation = clampRotation(draggedRotation.current + rotationDelta);
            draggedRotation.current = nextRotation;
            hourglassRotation.setValue(nextRotation);
            lastTouchAngle.current = currentAngle;
          }

          const rotationAmount = Math.max(Math.abs(draggedRotation.current), pathRotation.current);
          mixProgress.value = Math.min(1, rotationAmount / NEXT_CYCLE_ROTATE_THRESHOLD_DEGREES);
          hasCompletedRotationGesture.current =
            rotationAmount >= NEXT_CYCLE_ROTATE_THRESHOLD_DEGREES;
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
            mixProgress.value = withTiming(0, {
              duration: NEXT_CYCLE_MIX_CATCHUP_DURATION_MS,
              easing: ReEasing.out(ReEasing.cubic),
            });
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
            mixProgress.value = withTiming(0, {
              duration: NEXT_CYCLE_MIX_CATCHUP_DURATION_MS,
              easing: ReEasing.out(ReEasing.cubic),
            });
            startIdleAnimation();
          }
        },
      }),
    [
      hasLanded,
      hourglassRotation,
      isExiting,
      isStarting,
      mixProgress,
      sandSloshValue,
      startIdleAnimation,
      triggerNextCycleByRotation,
    ],
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
            <ReAnimated.View
              ref={centerHourglassRef}
              onLayout={handleCenterHourglassLayout}
              style={[
                styles.nextCycleHourglassAsset,
                { width: hourglassWidth, height: hourglassHeight },
                entranceAnimatedStyle,
              ]}
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
                <ReAnimated.View
                  style={[
                    StyleSheet.absoluteFillObject,
                    styles.nextCycleHourglassAsset,
                    purpleLayerStyle,
                  ]}
                  pointerEvents="none"
                >
                  <HourglassBadgeIcon
                    active
                    width={hourglassWidth}
                    height={hourglassHeight}
                    layers={[]}
                    activeLayerIndex={0}
                    showSandStream={false}
                    xml={blueHourglassXml}
                    config={blueHourglassConfig}
                    testID="break-next-cycle-hourglass-icon-mixed"
                  />
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFillObject,
                      { transform: [{ rotate: sandSloshRotationStyle }] },
                    ]}
                    pointerEvents="none"
                  >
                    <Svg
                      width={hourglassWidth}
                      height={hourglassHeight}
                      viewBox={sandOverlayViewBox}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <HourglassBadgeSandOverlay
                        layers={mixedSandLayers}
                        activeLayerIndex={0}
                        showStream={isExiting}
                        config={blueHourglassConfig}
                        surfaceTilt={surfaceTilt}
                      />
                    </Svg>
                  </Animated.View>
                </ReAnimated.View>
                <ReAnimated.View
                  style={[
                    styles.nextCycleHourglassAsset,
                    { width: hourglassWidth, height: hourglassHeight },
                    blueLayerStyle,
                  ]}
                  pointerEvents="none"
                >
                  <HourglassBadgeIcon
                    active
                    width={hourglassWidth}
                    height={hourglassHeight}
                    layers={[]}
                    activeLayerIndex={0}
                    showSandStream={false}
                    xml={blueHourglassXml}
                    config={blueHourglassConfig}
                    testID="break-next-cycle-hourglass-icon"
                  />
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFillObject,
                      { transform: [{ rotate: sandSloshRotationStyle }] },
                    ]}
                    pointerEvents="none"
                  >
                    <Svg
                      width={hourglassWidth}
                      height={hourglassHeight}
                      viewBox={sandOverlayViewBox}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <HourglassBadgeSandOverlay
                        layers={NEXT_CYCLE_FULL_SAND_LAYERS}
                        activeLayerIndex={0}
                        showStream={false}
                        config={blueHourglassConfig}
                        surfaceTilt={surfaceTilt}
                      />
                    </Svg>
                  </Animated.View>
                </ReAnimated.View>
              </Animated.View>
            </ReAnimated.View>
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

const styles = StyleSheet.create({
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
