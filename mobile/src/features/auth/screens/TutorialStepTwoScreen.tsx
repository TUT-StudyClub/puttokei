/**
 * チュートリアル Step2 画面。
 *
 * 判定結果を次のインプットで見返す流れを説明する。
 */
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
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

const NEXT_ROUTE = '/(auth)/tutorial-step-three' as unknown as Href;
const SKIP_ROUTE = '/(tabs)' as unknown as Href;

export function TutorialStepTwoScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  const markTutorialCompleted = useTutorialStore((s) => s.markCompleted);
  const markTutorialCompletedRef = useRef(markTutorialCompleted);
  const [isNavigating, setIsNavigating] = useState(false);
  const progressFillRatio = useRef(new Animated.Value(0)).current;
  const hasNavigatedRef = useRef(false);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  routerRef.current = router;
  markTutorialCompletedRef.current = markTutorialCompleted;

  const navigate = useCallback((route: Href) => {
    if (hasNavigatedRef.current) return;

    hasNavigatedRef.current = true;
    // (auth) 配下を抜けるとき (= スキップ) は AuthGate に弾かれないよう完了をマーク
    if (route === SKIP_ROUTE) {
      markTutorialCompletedRef.current();
    }
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container} testID="tutorial-step-two-root">
        <View style={styles.progressRow} testID="tutorial-step-two-progress">
          <View style={[styles.progressSegment, styles.progressSegmentComplete]} />
          <View style={[styles.progressSegment, styles.progressSegmentCurrent]}>
            <Animated.View
              style={[
                styles.progressSegmentCurrentFill,
                { transform: [{ scaleX: progressFillRatio }] },
              ]}
              testID="tutorial-step-two-progress-fill"
            />
          </View>
          <View style={[styles.progressSegment, styles.progressSegmentInactive]} />
        </View>

        <View style={styles.hero}>
          <SizableText size="$8" style={styles.title} testID="tutorial-step-two-title">
            答え合わせは次の20分に
          </SizableText>
        </View>

        <View style={styles.previewCard} testID="tutorial-step-two-preview">
          <View style={styles.previewRail} />
          <View style={styles.previewBody}>
            <View style={styles.aiBadge}>
              <SizableText size="$2" style={styles.aiBadgeText}>
                AIフィードバック
              </SizableText>
            </View>

            <View style={styles.previewCanvas}>
              <View style={styles.previewHeader} />
              <View style={styles.previewHighlight} />
              <View style={styles.previewLines}>
                {[84, 108, 74].map((width, index) => (
                  <View key={index} style={[styles.previewLine, { width }]} />
                ))}
              </View>
            </View>
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
            testID="tutorial-step-two-next"
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
            testID="tutorial-step-two-skip"
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
  progressSegmentInactive: {
    backgroundColor: '#D9D9D9',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    color: '#2F2F2F',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    textAlign: 'center',
  },
  previewCard: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 320,
    maxHeight: 400,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    shadowColor: 'rgba(19, 31, 56, 0.08)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 2,
  },
  previewRail: {
    width: 5,
    marginRight: 14,
    borderRadius: 999,
    backgroundColor: '#1E1E1E',
  },
  previewBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 28,
    paddingHorizontal: 18,
  },
  aiBadge: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#EEF1FF',
  },
  aiBadgeText: {
    color: '#4B5CFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  previewCanvas: {
    width: '100%',
    maxWidth: 220,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#F7F8FC',
    gap: 16,
  },
  previewHeader: {
    alignSelf: 'center',
    width: 92,
    height: 14,
    borderRadius: 999,
    backgroundColor: '#D5DBFF',
  },
  previewHighlight: {
    height: 100,
    borderRadius: 18,
    backgroundColor: '#E7EBFF',
  },
  previewLines: {
    gap: 12,
    alignItems: 'center',
  },
  previewLine: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#D7DBE8',
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
