/**
 * チュートリアル Step3 画面。
 *
 * 余白を活かした最終案内を表示する。
 */
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import { SizableText } from 'tamagui';

import { TUTORIAL_ROUTE_TRANSITION_DELAY_MS } from '@/features/auth/screens/tutorialConfig';

const NEXT_ROUTE = '/(auth)/sign-in' as unknown as Href;
const SKIP_ROUTE = '/(auth)/sign-in' as unknown as Href;

export function TutorialStepThreeScreen() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNavigation = useCallback(
    (route: Href) => {
      if (isNavigating) return;

      setIsNavigating(true);
      navigationTimeoutRef.current = setTimeout(() => {
        router.replace(route);
      }, TUTORIAL_ROUTE_TRANSITION_DELAY_MS);
    },
    [isNavigating, router],
  );

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current !== null) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container} testID="tutorial-step-three-root">
        <View style={styles.progressRow} testID="tutorial-step-three-progress">
          <View style={[styles.progressSegment, styles.progressSegmentComplete]} />
          <View style={[styles.progressSegment, styles.progressSegmentComplete]} />
          <View style={[styles.progressSegment, styles.progressSegmentCurrent]}>
            <View style={styles.progressSegmentCurrentFill} />
          </View>
        </View>

        <View style={styles.hero}>
          <SizableText size="$8" style={styles.title} testID="tutorial-step-three-title">
            学びを加速しよう
          </SizableText>
        </View>

        <View style={styles.blankStage} testID="tutorial-step-three-blank-stage" />

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
    paddingTop: 20,
    paddingRight: 24,
    paddingBottom: 28,
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
    width: '42%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#777777',
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
  },
  actionArea: {
    paddingTop: 28,
    gap: 14,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
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
    height: 52,
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
