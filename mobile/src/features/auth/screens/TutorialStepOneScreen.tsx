/**
 * チュートリアル Step1 画面。
 *
 * 学習サイクルの 3 フェーズ（インプット / アウトプット / 休憩）を
 * 1 ステップ内で自動切り替え表示する。
 */
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';
import { SizableText } from 'tamagui';

type TutorialPhase = {
  key: 'input' | 'output' | 'break';
  subtitle: string;
  previewLabel: string;
  accentColor: string;
  rows: number[];
};

const NEXT_ROUTE = '/(auth)/sign-in' as unknown as Href;
const SKIP_ROUTE = '/(auth)/sign-in' as unknown as Href;

export const TUTORIAL_STEP_ONE_PHASE_DURATION_MS = 3200;
export const TUTORIAL_STEP_ONE_PHASE_DISSOLVE_MS = 520;
export const TUTORIAL_STEP_ONE_PHASE_VISIBLE_MS =
  TUTORIAL_STEP_ONE_PHASE_DURATION_MS - TUTORIAL_STEP_ONE_PHASE_DISSOLVE_MS;

export const TUTORIAL_STEP_ONE_PHASES: readonly TutorialPhase[] = [
  {
    key: 'input',
    subtitle: '20分 集中して勉強',
    previewLabel: 'インプット',
    accentColor: '#4B5CFF',
    rows: [84, 72, 90],
  },
  {
    key: 'output',
    subtitle: '5分アウトプット',
    previewLabel: 'アウトプット',
    accentColor: '#3E77FF',
    rows: [78, 92, 66],
  },
  {
    key: 'break',
    subtitle: '5分休憩&AI正誤チェック',
    previewLabel: '休憩',
    accentColor: '#39A58D',
    rows: [60, 88, 74],
  },
] as const;

function TutorialPhasePane({
  phase,
  testID,
}: {
  phase: TutorialPhase;
  testID: string;
}) {
  return (
    <View style={styles.phasePane} testID={testID}>
      <SizableText size="$5" style={styles.subtitle} testID="tutorial-step-one-subtitle">
        {phase.subtitle}
      </SizableText>

      <View style={styles.previewCard} testID={`tutorial-step-one-preview-${phase.key}`}>
        <View style={styles.previewRail} />
        <View style={styles.previewBody}>
          <View style={[styles.phaseBadge, { backgroundColor: phase.accentColor }]}>
            <SizableText size="$2" style={styles.phaseBadgeText}>
              {phase.previewLabel}
            </SizableText>
          </View>
          <View style={styles.previewCanvas}>
            <View style={[styles.previewAccent, { backgroundColor: phase.accentColor }]} />
            <View style={styles.previewRows}>
              {phase.rows.map((width, index) => (
                <View key={`${phase.key}-${index}`} style={[styles.previewRow, { width }]} />
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export function TutorialStepOneScreen() {
  const router = useRouter();
  const [phaseSlotIndexes, setPhaseSlotIndexes] = useState<[number, number]>([0, 0]);
  const phaseOpacities = useRef([new Animated.Value(1), new Animated.Value(0)] as const).current;
  const phaseIndexRef = useRef(0);
  const visibleSlotRef = useRef(0);

  useEffect(() => {
    let isCancelled = false;
    let phaseTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let activeAnimation: Animated.CompositeAnimation | null = null;

    const scheduleNextPhase = () => {
      phaseTimeoutId = setTimeout(() => {
        if (isCancelled) return;

        const currentSlot = visibleSlotRef.current;
        const nextSlot = currentSlot === 0 ? 1 : 0;
        const nextPhaseIndex = (phaseIndexRef.current + 1) % TUTORIAL_STEP_ONE_PHASES.length;

        setPhaseSlotIndexes((currentIndexes) => {
          const nextIndexes: [number, number] = [...currentIndexes] as [number, number];
          nextIndexes[nextSlot] = nextPhaseIndex;
          return nextIndexes;
        });

        const currentOpacity = phaseOpacities[currentSlot]!;
        const nextOpacity = phaseOpacities[nextSlot]!;

        currentOpacity.setValue(1);
        nextOpacity.setValue(0);

        activeAnimation = Animated.parallel(
          [
            Animated.timing(currentOpacity, {
              toValue: 0,
              duration: TUTORIAL_STEP_ONE_PHASE_DISSOLVE_MS,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(nextOpacity, {
              toValue: 1,
              duration: TUTORIAL_STEP_ONE_PHASE_DISSOLVE_MS,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ],
          { stopTogether: true },
        );

        activeAnimation.start(({ finished }) => {
          if (!finished || isCancelled) return;

          phaseIndexRef.current = nextPhaseIndex;
          visibleSlotRef.current = nextSlot;
          scheduleNextPhase();
        });
      }, TUTORIAL_STEP_ONE_PHASE_VISIBLE_MS);
    };

    scheduleNextPhase();

    return () => {
      isCancelled = true;
      if (phaseTimeoutId !== null) {
        clearTimeout(phaseTimeoutId);
      }
      activeAnimation?.stop();
    };
  }, [phaseOpacities]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container} testID="tutorial-step-one-root">
        <View style={styles.progressRow} testID="tutorial-step-one-progress">
          {[0, 1, 2].map((stepIndex) => (
            <View
              key={stepIndex}
              style={[
                styles.progressSegment,
                stepIndex === 0 ? styles.progressSegmentActive : styles.progressSegmentInactive,
              ]}
              testID={`tutorial-step-one-progress-${stepIndex + 1}`}
            />
          ))}
        </View>

        <View style={styles.hero}>
          <SizableText size="$8" style={styles.title} testID="tutorial-step-one-title">
            簡単3ステップ
          </SizableText>
        </View>

        <View style={styles.phaseStack}>
          {phaseSlotIndexes.map((slotPhaseIndex, slotIndex) => {
            const phase = TUTORIAL_STEP_ONE_PHASES[slotPhaseIndex] ?? TUTORIAL_STEP_ONE_PHASES[0]!;

            return (
              <Animated.View
                key={slotIndex}
                pointerEvents="none"
                style={[
                  styles.phaseLayer,
                  styles.phaseLayerOverlay,
                  { opacity: phaseOpacities[slotIndex]! },
                ]}
                testID={`tutorial-step-one-phase-pane-slot-${slotIndex}`}
              >
                <TutorialPhasePane
                  phase={phase}
                  testID={`tutorial-step-one-phase-pane-${slotIndex}`}
                />
              </Animated.View>
            );
          })}
        </View>

        <View style={styles.actionArea}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.primaryButtonPressed : null,
            ]}
            onPress={() => router.replace(NEXT_ROUTE)}
            testID="tutorial-step-one-next"
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
            onPress={() => router.replace(SKIP_ROUTE)}
            testID="tutorial-step-one-skip"
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
  },
  progressSegmentActive: {
    backgroundColor: '#777777',
  },
  progressSegmentInactive: {
    backgroundColor: '#D9D9D9',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#2F2F2F',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  phasePane: {
    flex: 1,
  },
  phaseStack: {
    flex: 1,
    position: 'relative',
  },
  phaseLayer: {
    flex: 1,
  },
  phaseLayerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  subtitle: {
    alignSelf: 'center',
    marginBottom: 28,
    color: '#434343',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
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
  phaseBadge: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  phaseBadgeText: {
    color: '#FFFFFF',
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
    gap: 20,
  },
  previewAccent: {
    height: 92,
    borderRadius: 16,
    opacity: 0.12,
  },
  previewRows: {
    gap: 12,
    alignItems: 'center',
  },
  previewRow: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#D7DBE8',
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
