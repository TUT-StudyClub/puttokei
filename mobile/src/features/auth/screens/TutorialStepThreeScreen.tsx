/**
 * チュートリアル Step3 画面。
 *
 * 最終案内として回転する砂時計を表示する。
 */
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import { ClipPath, Defs, Ellipse, LinearGradient, Path, Rect, Stop, Svg } from 'react-native-svg';
import { SizableText } from 'tamagui';

import {
  TUTORIAL_ACTION_AREA_BOTTOM_OFFSET,
  TUTORIAL_ACTION_BUTTON_GAP,
  TUTORIAL_ACTION_BUTTON_HEIGHT,
  TUTORIAL_PROGRESS_FILL_DURATION_MS,
  TUTORIAL_ROUTE_TRANSITION_DELAY_MS,
  TUTORIAL_TWO_BUTTON_ACTION_AREA_RESERVE,
} from '@/features/auth/screens/tutorialConfig';

const NEXT_ROUTE = '/(auth)/sign-in' as unknown as Href;
const SKIP_ROUTE = '/(auth)/sign-in' as unknown as Href;
const HOURGLASS_ROTATION_DURATION_MS = 1500;
const HOURGLASS_SAND_FALL_DURATION_MS = 3000;
const HOURGLASS_VIEWBOX_WIDTH = 43.11;
const HOURGLASS_VIEWBOX_HEIGHT = 76.91;
const HOURGLASS_SAND_DRAIN_MAX = 42;

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const HOURGLASS_WHITE_FILL_PATH =
  'M.26,4.19v4.22c0,1.22.99,2.21,2.21,2.21h0c1.77,0,2.76,1.94,1.83,3.45-1,1.64-1.56,3.45-1.56,5.36,0,2.66,1.09,5.14,2.94,7.21l5.31,6.77c2.68,3.41,2.68,8.21,0,11.62l-5.31,6.77c-1.85,2.07-2.94,4.54-2.94,7.21,0,1.91.56,3.73,1.56,5.36.93,1.51-.06,3.45-1.83,3.45h0c-1.22,0-2.21.99-2.21,2.21v4.22c0,1.22.99,2.21,2.21,2.21h36.25c1.22,0,2.21-.99,2.21-2.21v-4.22c0-1.22-.99-2.21-2.21-2.21h0c-1.77,0-2.76-1.94-1.83-3.45,1-1.64,1.56-3.45,1.56-5.36,0-2.66-1.09-5.14-2.94-7.21l-5.31-6.77c-2.68-3.41-2.68-8.21,0-11.62l5.31-6.77c1.85-2.07,2.94-4.54,2.94-7.21,0-1.91-.56-3.73-1.56-5.36-.93-1.51.06-3.45,1.83-3.45h0c1.22,0,2.21-.99,2.21-2.21v-4.22c0-1.22-.99-2.21-2.21-2.21H2.47C1.25,1.97.26,2.96.26,4.19';
const HOURGLASS_CENTER_PATH =
  'M21.56,8.96c-7.11,0-12.89,4.36-12.89,9.72,0,1.77.66,3.52,1.91,5.06l5.97,8.32c2.74,3.83,2.74,8.97,0,12.8l-5.84,8.15c-1.38,1.7-2.05,3.45-2.05,5.23,0,5.36,5.78,9.72,12.89,9.72s12.89-4.36,12.89-9.72c0-1.77-.66-3.52-1.91-5.06l-5.97-8.32c-2.74-3.83-2.74-8.97,0-12.8l5.84-8.15c1.38-1.7,2.05-3.45,2.05-5.23,0-5.36-5.78-9.72-12.89-9.72Z';

type HourglassIllustrationProps = {
  sandDrainHeight: Animated.AnimatedInterpolation<number>;
};

function HourglassIllustration({ sandDrainHeight }: HourglassIllustrationProps) {
  return (
    <Svg width={132} height={236} viewBox="0 0 43.11 76.91">
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
        <LinearGradient
          id="hourglassHighlight"
          gradientUnits="userSpaceOnUse"
          x1="10"
          y1="14"
          x2="24"
          y2="44"
        >
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
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
      <Path d={HOURGLASS_CENTER_PATH} fill="url(#hourglassGradient)" opacity={0.96} />
      <AnimatedRect
        x={0}
        y={0}
        width={HOURGLASS_VIEWBOX_WIDTH}
        height={sandDrainHeight}
        fill="#FFFFFF"
        clipPath="url(#hourglassInnerClip)"
      />
      <Ellipse cx="16.8" cy="22" rx="8.5" ry="12" fill="url(#hourglassHighlight)" />
    </Svg>
  );
}

export function TutorialStepThreeScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  const [isNavigating, setIsNavigating] = useState(false);
  const progressFillRatio = useRef(new Animated.Value(0)).current;
  const rotationValue = useRef(new Animated.Value(0)).current;
  const sandFallProgress = useRef(new Animated.Value(0)).current;
  const hasNavigatedRef = useRef(false);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  routerRef.current = router;

  const navigate = useCallback((route: Href) => {
    if (hasNavigatedRef.current) return;

    hasNavigatedRef.current = true;
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
    const rotationAnimation = Animated.timing(rotationValue, {
      toValue: 1,
      duration: HOURGLASS_ROTATION_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    const sandFallAnimation = Animated.timing(sandFallProgress, {
      toValue: 1,
      duration: HOURGLASS_SAND_FALL_DURATION_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    });
    const sequence = Animated.sequence([rotationAnimation, sandFallAnimation]);

    rotationValue.setValue(0);
    sandFallProgress.setValue(0);
    sequence.start();

    return () => {
      sequence.stop();
    };
  }, [rotationValue, sandFallProgress]);

  const hourglassRotation = rotationValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const sandDrainHeight = sandFallProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, HOURGLASS_SAND_DRAIN_MAX],
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
          <Animated.View
            style={[styles.hourglassWrapper, { transform: [{ rotate: hourglassRotation }] }]}
            testID="tutorial-step-three-hourglass"
          >
            <HourglassIllustration sandDrainHeight={sandDrainHeight} />
          </Animated.View>
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
  hourglassWrapper: {
    width: 132,
    height: 236,
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
