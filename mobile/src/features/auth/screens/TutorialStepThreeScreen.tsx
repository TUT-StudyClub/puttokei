/**
 * チュートリアル Step3 画面。
 *
 * 最終案内として回転する砂時計を表示する。
 */
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import { ClipPath, Defs, LinearGradient, Path, Rect, Stop, Svg } from 'react-native-svg';
import { SizableText } from 'tamagui';

import {
  TUTORIAL_ACTION_AREA_BOTTOM_OFFSET,
  TUTORIAL_ACTION_BUTTON_GAP,
  TUTORIAL_ACTION_BUTTON_HEIGHT,
  TUTORIAL_PROGRESS_FILL_DURATION_MS,
  TUTORIAL_ROUTE_TRANSITION_DELAY_MS,
  TUTORIAL_TWO_BUTTON_ACTION_AREA_RESERVE,
} from '@/features/auth/screens/tutorialConfig';
import { useTutorialStore } from '@/shared/stores/tutorialStore';

const NEXT_ROUTE = '/(tabs)' as unknown as Href;
const SKIP_ROUTE = '/(tabs)' as unknown as Href;
const HOURGLASS_FALL_DURATION_MS = 1500;
const HOURGLASS_ROTATION_DURATION_MS = 1200;
const HOURGLASS_EFFECT_FADE_DURATION_MS = 180;
const HOURGLASS_VIEWBOX_WIDTH = 43.11;
const HOURGLASS_TOP_BULB_TOP = 8;
const HOURGLASS_PINCH = 38;
const HOURGLASS_BOTTOM_BULB_BOTTOM = 68;
const HOURGLASS_TOP_BULB_RANGE = HOURGLASS_PINCH - HOURGLASS_TOP_BULB_TOP;
const HOURGLASS_BOTTOM_BULB_RANGE = HOURGLASS_BOTTOM_BULB_BOTTOM - HOURGLASS_PINCH;
const ROTATION_EFFECT_STAGE_SIZE = 320;
const ROTATION_EFFECT_RADIUS = 138;
const ROTATION_EFFECT_ARC_SWEEP_DEG = 26;
const ROTATION_EFFECT_ARC_CENTER_DEGS = [90, 270];

function buildArcPath(startDeg: number, sweepDeg: number, radius: number) {
  const startRad = (startDeg * Math.PI) / 180;
  const endRad = ((startDeg + sweepDeg) * Math.PI) / 180;
  const startX = radius * Math.cos(startRad);
  const startY = radius * Math.sin(startRad);
  const endX = radius * Math.cos(endRad);
  const endY = radius * Math.sin(endRad);
  return `M ${startX.toFixed(2)} ${startY.toFixed(2)} A ${radius} ${radius} 0 0 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`;
}

const ROTATION_EFFECT_ARCS = ROTATION_EFFECT_ARC_CENTER_DEGS.map((centerDeg) =>
  buildArcPath(
    centerDeg - ROTATION_EFFECT_ARC_SWEEP_DEG / 2,
    ROTATION_EFFECT_ARC_SWEEP_DEG,
    ROTATION_EFFECT_RADIUS,
  ),
);

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const HOURGLASS_WHITE_FILL_PATH =
  'M.26,4.19v4.22c0,1.22.99,2.21,2.21,2.21h0c1.77,0,2.76,1.94,1.83,3.45-1,1.64-1.56,3.45-1.56,5.36,0,2.66,1.09,5.14,2.94,7.21l5.31,6.77c2.68,3.41,2.68,8.21,0,11.62l-5.31,6.77c-1.85,2.07-2.94,4.54-2.94,7.21,0,1.91.56,3.73,1.56,5.36.93,1.51-.06,3.45-1.83,3.45h0c-1.22,0-2.21.99-2.21,2.21v4.22c0,1.22.99,2.21,2.21,2.21h36.25c1.22,0,2.21-.99,2.21-2.21v-4.22c0-1.22-.99-2.21-2.21-2.21h0c-1.77,0-2.76-1.94-1.83-3.45,1-1.64,1.56-3.45,1.56-5.36,0-2.66-1.09-5.14-2.94-7.21l-5.31-6.77c-2.68-3.41-2.68-8.21,0-11.62l5.31-6.77c1.85-2.07,2.94-4.54,2.94-7.21,0-1.91-.56-3.73-1.56-5.36-.93-1.51.06-3.45,1.83-3.45h0c1.22,0,2.21-.99,2.21-2.21v-4.22c0-1.22-.99-2.21-2.21-2.21H2.47C1.25,1.97.26,2.96.26,4.19';
const HOURGLASS_CENTER_PATH =
  'M21.56,8.96c-7.11,0-12.89,4.36-12.89,9.72,0,1.77.66,3.52,1.91,5.06l5.97,8.32c2.74,3.83,2.74,8.97,0,12.8l-5.84,8.15c-1.38,1.7-2.05,3.45-2.05,5.23,0,5.36,5.78,9.72,12.89,9.72s12.89-4.36,12.89-9.72c0-1.77-.66-3.52-1.91-5.06l-5.97-8.32c-2.74-3.83-2.74-8.97,0-12.8l5.84-8.15c1.38-1.7,2.05-3.45,2.05-5.23,0-5.36-5.78-9.72-12.89-9.72Z';

type HourglassIllustrationProps = {
  topSandY: Animated.AnimatedInterpolation<number>;
  topSandHeight: Animated.AnimatedInterpolation<number>;
  bottomSandHeight: Animated.AnimatedInterpolation<number>;
};

function HourglassIllustration({
  topSandY,
  topSandHeight,
  bottomSandHeight,
}: HourglassIllustrationProps) {
  return (
    <Svg width={132} height={236} viewBox="-1.5 -1.5 46.11 79.91">
      <Defs>
        <LinearGradient
          id="hourglassGradient"
          gradientUnits="userSpaceOnUse"
          x1="6"
          y1="8"
          x2="35"
          y2="70"
        >
          <Stop offset="0" stopColor="#44D4FF" />
          <Stop offset="0.42" stopColor="#FF7A8D" />
          <Stop offset="1" stopColor="#8E7CFF" />
        </LinearGradient>
        <ClipPath id="hourglassInnerClip">
          <Path d={HOURGLASS_CENTER_PATH} />
        </ClipPath>
      </Defs>

      <Path
        d={HOURGLASS_WHITE_FILL_PATH}
        fill="#FFFFFF"
        stroke="#475FFF"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <AnimatedRect
        x={0}
        y={topSandY}
        width={HOURGLASS_VIEWBOX_WIDTH}
        height={topSandHeight}
        fill="url(#hourglassGradient)"
        clipPath="url(#hourglassInnerClip)"
      />
      <AnimatedRect
        x={0}
        y={HOURGLASS_PINCH}
        width={HOURGLASS_VIEWBOX_WIDTH}
        height={bottomSandHeight}
        fill="url(#hourglassGradient)"
        clipPath="url(#hourglassInnerClip)"
      />
    </Svg>
  );
}

export function TutorialStepThreeScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  const markTutorialCompleted = useTutorialStore((s) => s.markCompleted);
  const markTutorialCompletedRef = useRef(markTutorialCompleted);
  const [isNavigating, setIsNavigating] = useState(false);
  const progressFillRatio = useRef(new Animated.Value(0)).current;
  const rotationValue = useRef(new Animated.Value(0)).current;
  const sandFallProgress = useRef(new Animated.Value(0)).current;
  const rotationEffectOpacity = useRef(new Animated.Value(0)).current;
  const hasNavigatedRef = useRef(false);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  routerRef.current = router;
  markTutorialCompletedRef.current = markTutorialCompleted;

  const navigate = useCallback((route: Href) => {
    if (hasNavigatedRef.current) return;

    hasNavigatedRef.current = true;
    // チュートリアル完了をマークしてから (tabs) などへ遷移する。
    // AuthGate がフラグを参照して overview に戻さないようにする。
    markTutorialCompletedRef.current();
    routerRef.current.replace(route);
  }, []);

  const scheduleNavigation = useCallback(
    (route: Href, delayMs = TUTORIAL_ROUTE_TRANSITION_DELAY_MS) => {
      if (isNavigating || navigationTimeoutRef.current !== null || hasNavigatedRef.current) return;

      if (autoAdvanceTimeoutRef.current !== null) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }

      setIsNavigating(true);
      navigationTimeoutRef.current = setTimeout(() => {
        navigate(route);
      }, delayMs);
    },
    [isNavigating, navigate],
  );

  useEffect(() => {
    const progressAnimation = Animated.timing(progressFillRatio, {
      toValue: 1,
      duration: TUTORIAL_PROGRESS_FILL_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });

    progressAnimation.start();
    autoAdvanceTimeoutRef.current = setTimeout(() => {
      navigate(NEXT_ROUTE);
    }, TUTORIAL_PROGRESS_FILL_DURATION_MS);

    return () => {
      progressAnimation.stop();
      if (autoAdvanceTimeoutRef.current !== null) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
      if (navigationTimeoutRef.current !== null) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, [navigate, progressFillRatio]);

  useEffect(() => {
    const firstFall = Animated.timing(sandFallProgress, {
      toValue: 1,
      duration: HOURGLASS_FALL_DURATION_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    });
    // 回転中は砂を動かさず、代わりにエフェクトラインをフェードで見せる
    const rotateWithEffect = Animated.parallel([
      Animated.timing(rotationValue, {
        toValue: 1,
        duration: HOURGLASS_ROTATION_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(rotationEffectOpacity, {
          toValue: 1,
          duration: HOURGLASS_EFFECT_FADE_DURATION_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(HOURGLASS_ROTATION_DURATION_MS - HOURGLASS_EFFECT_FADE_DURATION_MS * 2),
        Animated.timing(rotationEffectOpacity, {
          toValue: 0,
          duration: HOURGLASS_EFFECT_FADE_DURATION_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);
    // 180 度回転後は上下が入れ替わるので、砂の落下方向を逆向きに進める
    const secondFall = Animated.timing(sandFallProgress, {
      toValue: 0,
      duration: HOURGLASS_FALL_DURATION_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    });
    const sequence = Animated.sequence([firstFall, rotateWithEffect, secondFall]);

    rotationValue.setValue(0);
    sandFallProgress.setValue(0);
    rotationEffectOpacity.setValue(0);
    sequence.start();

    return () => {
      sequence.stop();
    };
  }, [rotationEffectOpacity, rotationValue, sandFallProgress]);

  const hourglassRotation = rotationValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const topSandY = sandFallProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [HOURGLASS_TOP_BULB_TOP, HOURGLASS_PINCH],
  });
  const topSandHeight = sandFallProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [HOURGLASS_TOP_BULB_RANGE, 0],
  });
  const bottomSandHeight = sandFallProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, HOURGLASS_BOTTOM_BULB_RANGE],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container} testID="tutorial-step-three-root">
        <View style={styles.progressRow} testID="tutorial-step-three-progress">
          <View style={[styles.progressSegment, styles.progressSegmentComplete]} />
          <View style={[styles.progressSegment, styles.progressSegmentComplete]} />
          <View style={[styles.progressSegment, styles.progressSegmentCurrent]}>
            <Animated.View
              style={[
                styles.progressSegmentCurrentFill,
                { transform: [{ scaleX: progressFillRatio }] },
              ]}
              testID="tutorial-step-three-progress-fill"
            />
          </View>
        </View>

        <View style={styles.hero}>
          <SizableText size="$8" style={styles.title} testID="tutorial-step-three-title">
            学びを加速しよう
          </SizableText>
        </View>

        <View style={styles.blankStage} testID="tutorial-step-three-blank-stage">
          <View style={styles.hourglassStage}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.rotationEffect,
                {
                  opacity: rotationEffectOpacity,
                  transform: [{ rotate: hourglassRotation }],
                },
              ]}
              testID="tutorial-step-three-rotation-effect"
            >
              <Svg
                width={ROTATION_EFFECT_STAGE_SIZE}
                height={ROTATION_EFFECT_STAGE_SIZE}
                viewBox={`-${ROTATION_EFFECT_STAGE_SIZE / 2} -${ROTATION_EFFECT_STAGE_SIZE / 2} ${ROTATION_EFFECT_STAGE_SIZE} ${ROTATION_EFFECT_STAGE_SIZE}`}
              >
                {ROTATION_EFFECT_ARCS.map((d) => (
                  <Path
                    key={d}
                    d={d}
                    stroke="#4B5CFF"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    fill="none"
                    opacity={0.5}
                  />
                ))}
              </Svg>
            </Animated.View>
            <Animated.View
              style={[styles.hourglassWrapper, { transform: [{ rotate: hourglassRotation }] }]}
              testID="tutorial-step-three-hourglass"
            >
              <HourglassIllustration
                topSandY={topSandY}
                topSandHeight={topSandHeight}
                bottomSandHeight={bottomSandHeight}
              />
            </Animated.View>
          </View>
        </View>

        <View style={styles.actionArea}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.primaryButtonPressed : null,
            ]}
            disabled={isNavigating}
            onPress={() => scheduleNavigation(NEXT_ROUTE)}
            testID="tutorial-step-three-next"
          >
            <SizableText size="$5" style={styles.primaryButtonText}>
              次へ
            </SizableText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed ? styles.secondaryButtonPressed : null,
            ]}
            disabled={isNavigating}
            onPress={() => scheduleNavigation(SKIP_ROUTE)}
            testID="tutorial-step-three-skip"
          >
            <SizableText size="$5" style={styles.secondaryButtonText}>
              スキップする
            </SizableText>
          </Pressable>
        </View>
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
    position: 'relative',
    paddingTop: 20,
    paddingRight: 24,
    paddingBottom: TUTORIAL_TWO_BUTTON_ACTION_AREA_RESERVE,
    paddingLeft: 24,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 56,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressSegmentComplete: {
    backgroundColor: '#777777',
  },
  progressSegmentCurrent: {
    backgroundColor: '#D9D9D9',
  },
  progressSegmentCurrentFill: {
    ...StyleSheet.absoluteFillObject,
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#777777',
    transformOrigin: 'left center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#2F2F2F',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    textAlign: 'center',
  },
  blankStage: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourglassStage: {
    width: ROTATION_EFFECT_STAGE_SIZE,
    height: ROTATION_EFFECT_STAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourglassWrapper: {
    width: 272,
    height: 272,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotationEffect: {
    position: 'absolute',
    width: ROTATION_EFFECT_STAGE_SIZE,
    height: ROTATION_EFFECT_STAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionArea: {
    position: 'absolute',
    right: 24,
    bottom: TUTORIAL_ACTION_AREA_BOTTOM_OFFSET,
    left: 24,
    gap: TUTORIAL_ACTION_BUTTON_GAP,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: TUTORIAL_ACTION_BUTTON_HEIGHT,
    borderRadius: 18,
    backgroundColor: '#4B5CFF',
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: TUTORIAL_ACTION_BUTTON_HEIGHT,
    borderWidth: 1.5,
    borderColor: '#8C8C8C',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonPressed: {
    backgroundColor: '#F6F6F6',
  },
  secondaryButtonText: {
    color: '#4B4B4B',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
});
