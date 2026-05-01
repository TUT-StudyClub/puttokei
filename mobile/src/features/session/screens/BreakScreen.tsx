/**
 * 休憩フェーズ画面 (S-07 / S-08-2)。
 *
 * 休憩中は既存のタイマーと AI 採点進捗を表示する。休憩タイマー完了後は、
 * 参考画面に合わせて「休憩完了」→「次サイクル準備」の 2 段階 UI に切り替える。
 */
import { useIsFocused } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type GestureResponderEvent,
  ImageBackground,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  SafeAreaView,
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

import { createSession } from '@/features/session/api/sessionApi';
import {
  CircularPhaseTimer,
  HOURGLASS_BADGE_ACTIVE_SCALE,
  HOURGLASS_VARIANTS,
  HourglassBadge,
  HourglassBadgeIcon,
  HourglassBadgeSandOverlay,
  type HourglassSandLayer,
  PhaseTabs,
  type SessionPhase,
  SessionSettingsButton,
  useHourglassBadgeXml,
} from '@/features/session/components/SessionPhaseChrome';
import { DEFAULT_TIMER } from '@/features/session/config';
import { useJudgment } from '@/features/session/hooks/useJudgment';
import {
  useSmoothRemainingSeconds,
  useThrottledRemainingSeconds,
  useTimer,
} from '@/features/session/hooks/useTimer';
import type { CreateSessionInput, Session } from '@/features/session/types';
import { useLoopStore } from '@/shared/stores/loopStore';
import { useTimerStore } from '@/shared/stores/timerStore';

const BREAK_COMPLETE_CARD_IMAGE = require('../../../../assets/images/break_complete.png');
// 画像本体 (1329x1857) のアスペクト比。card 全体をこの比率で配置する。
const BREAK_COMPLETE_CARD_ASPECT_RATIO = 1329 / 1857;

const SETTINGS_ROUTE = '/(tabs)/settings' as unknown as Href;
// 中央表示用の砂時計は青枠 SVG を blue variant の baseHeight/baseWidth から比率を求める。
const NEXT_CYCLE_HOURGLASS_ASPECT_RATIO =
  HOURGLASS_VARIANTS.blue.baseHeight / HOURGLASS_VARIANTS.blue.baseWidth;
const NEXT_CYCLE_ENTRANCE_DURATION_MS = 600;
const NEXT_CYCLE_IDLE_ROTATION_DEGREES = 5;
// 砂塊の追加揺れ。枠より少し振幅を大きくして「中の砂が慣性で振られる」感じを作る。
const NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES = NEXT_CYCLE_IDLE_ROTATION_DEGREES * 1.15;
// 枠の揺れに対して砂揺れを位相遅れで開始することで、剛体ではない追従に見せる。
const NEXT_CYCLE_SAND_SLOSH_DELAY_MS = 180;
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
const DOT_INACTIVE = '#D9D9D9';
const BORDER_COLOR = '#E5E7EB';
const CAPTION_COLOR = '#777777';
const ERROR_COLOR = '#D92D20';

// 砂時計の砂積層に使う色。input=青 / output=ピンク / break=白。
const HOURGLASS_INPUT_COLOR = '#148BFF';
const HOURGLASS_OUTPUT_COLOR = '#F24D7E';
const HOURGLASS_BREAK_COLOR = '#FFFFFF';
const HOURGLASS_BREAK_OPACITY = 0.92;

// 次サイクル準備中に中央へ表示する砂時計の砂層。3 層が満タンに積まれた状態で、
// 「これから始まる新しいサイクル」を象徴する。weight は等比でよい。
const NEXT_CYCLE_FULL_SAND_LAYERS: readonly HourglassSandLayer[] = [
  { label: 'input', color: HOURGLASS_INPUT_COLOR, weight: 1, progress: 1 },
  { label: 'output', color: HOURGLASS_OUTPUT_COLOR, weight: 1, progress: 1 },
  {
    label: 'break',
    color: HOURGLASS_BREAK_COLOR,
    weight: 1,
    progress: 1,
    opacity: HOURGLASS_BREAK_OPACITY,
  },
];

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

type BreakCompletedViewProps = {
  currentLoop: number;
  onNextCycle: () => void;
};

function BreakCompletedView({ currentLoop, onNextCycle }: BreakCompletedViewProps) {
  const { width: windowWidth } = useWindowDimensions();
  // container.paddingHorizontal=24 を引き、その 87% をカード幅として使う。
  // aspectRatio + パーセント幅では画像本体の natural size が勝ち、
  // 横方向にはみ出してしまったため明示的な数値で確定させる。
  const cardWidth = Math.min(320, (windowWidth - 48) * 0.87);
  const cardHeight = cardWidth / BREAK_COMPLETE_CARD_ASPECT_RATIO;
  // 参考画像の余白比率に合わせる。タイトルは上端から ~11%、ボタンは下端から ~15% に置く。
  const topInset = Math.round(cardHeight * 0.11);
  const bottomInset = Math.round(cardHeight * 0.15);

  return (
    <View style={styles.completedContent} testID="break-completed-view">
      <View style={styles.completedStack}>
        <ImageBackground
          source={BREAK_COMPLETE_CARD_IMAGE}
          style={[
            styles.completedCard,
            { width: cardWidth, height: cardHeight, paddingTop: topInset, paddingBottom: bottomInset },
          ]}
          imageStyle={styles.completedCardImage}
          resizeMode="stretch"
          testID="break-complete-card"
        >
          <View style={styles.completedTitleBlock}>
            <SizableText
              style={styles.completedTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              お疲れ様でした！
            </SizableText>
            <SizableText
              style={styles.completedTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              記念すべき{currentLoop}サイクル目です！
            </SizableText>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onNextCycle}
            style={({ pressed }) => [
              styles.nextCycleButton,
              pressed ? styles.buttonPressed : null,
            ]}
            testID="break-next-cycle-button"
          >
            <SizableText
              style={styles.nextCycleButtonText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              次のサイクルへ
            </SizableText>
          </Pressable>
        </ImageBackground>

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
  /**
   * エントランスアニメの起点となる、画面上部 HourglassBadge のアクティブ砂時計の中心 (window 座標)。
   * `null` の場合はアニメをスキップして即着地状態にする。
   */
  entranceOrigin: { x: number; y: number } | null;
};

const NEXT_CYCLE_DRAIN_DURATION_MS = 800;
const NEXT_CYCLE_RETURN_DURATION_MS = 600;
// 回転がリリースされた際に「混色がまだ 1 に達していない」場合の追いつきアニメ尺。
const NEXT_CYCLE_MIX_CATCHUP_DURATION_MS = 150;
// mix→drain で 3 色から 1 色に統合された後の砂の色。purple variant SVG の濃い側 (#BA64E8) に揃える。
const HOURGLASS_MIXED_COLOR = '#BA64E8';
type ExitPhase = 'draining' | 'returning' | 'done';

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
  entranceOrigin,
}: NextCycleReadyViewProps) {
  const hourglassRotation = useRef(new Animated.Value(-NEXT_CYCLE_IDLE_ROTATION_DEGREES)).current;
  const idleAnimation = useRef<Animated.CompositeAnimation | null>(null);
  // 砂塊だけに掛ける追加の rotate 値。枠より位相が遅れた揺れを駆動する。
  const sandSloshValue = useRef(
    new Animated.Value(-NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES),
  ).current;
  const sandIdleAnimation = useRef<Animated.CompositeAnimation | null>(null);
  // 砂の表面 (谷 / 山) を中心からどれだけ左右にずらすか (-1..1)。
  // sandSloshValue を購読して 30fps 程度で再描画する。
  // 初期は中央 (傾きなし) で表示しておき、idle 開始後に listener が値を流し込む。
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

  // 中央砂時計の SVG XML (blue variant)。バッジと同じ青枠アセットを終始大きく表示する。
  // 砂の混色・落下は内側の sand layers (HourglassSandLayer) を差し替えて表現するため、
  // purple variant の SVG は中央表示では使わない。
  const blueHourglassXml = useHourglassBadgeXml(HOURGLASS_VARIANTS.blue.asset);
  const blueHourglassConfig = HOURGLASS_VARIANTS.blue;

  // エントランスアニメ。entranceOrigin が null のときは即着地状態とする。
  const centerHourglassRef = useRef<View>(null);
  const entranceProgress = useSharedValue(0);
  const entranceOffsetX = useSharedValue(0);
  const entranceOffsetY = useSharedValue(0);
  const entranceStartScale = useSharedValue(1);
  const entranceOpacity = useSharedValue(entranceOrigin ? 0 : 1);
  const [hasLanded, setHasLanded] = useState(!entranceOrigin);

  // 回し終え後の「色混ぜ → 砂落下 → バッジ位置へ戻る」アニメ用の各種値。
  // mixProgress: 0 = 青/ピンク/白 3 層, 1 = 紫 1 層 (位置はどちらも上部チャンバーで満タン)
  // drainProgress: 1 = 上部に満タン, 0 = 下部に落ちきった (mix 完了後に 1→0)
  const mixProgress = useSharedValue(0);
  const [drainProgress, setDrainProgress] = useState(1);
  const [exitPhase, setExitPhase] = useState<ExitPhase | null>(null);
  const isExiting = exitPhase !== null;

  // 落下中の紫の砂層。drainProgress が変わるたびに新しい配列にして HourglassBadgeIcon に渡す。
  const mixedSandLayers = useMemo<readonly HourglassSandLayer[]>(
    () => [{ label: 'mixed', color: HOURGLASS_MIXED_COLOR, weight: 1, progress: drainProgress }],
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

    // 砂揺れは枠と同じ周期だが Animated.delay で開始タイミングを遅らせ、視覚上の位相遅れを作る。
    // useNativeDriver を有効にするのは rotate transform 用、surfaceTilt の購読は addListener 経由。
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

  // 着地後 (= entrance 完了) かつ exit 開始前のあいだだけ idle 回転を再生する。
  // 回し中の固定 / 回し終え後の mix+return 中は idle を止め、ジェスチャー結果の rotate を保持する。
  useEffect(() => {
    if (!hasLanded || isExiting) return;
    startIdleAnimation();
    return () => {
      idleAnimation.current?.stop();
      sandIdleAnimation.current?.stop();
    };
  }, [hasLanded, isExiting, startIdleAnimation]);

  // sandSloshValue の角度を購読して、砂表面 (谷 / 山) の傾き (-1..1) を 30fps 程度で更新する。
  // useNativeDriver の rotate transform と並行に SVG の path を再生成する用途。
  useEffect(() => {
    const id = sandSloshValue.addListener(({ value }) => {
      const next = Math.max(-1, Math.min(1, value / NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES));
      setSurfaceTilt(next);
    });
    return () => {
      sandSloshValue.removeListener(id);
    };
  }, [sandSloshValue]);

  // 中央位置のレイアウト確定をトリガーに、バッジ位置 → 中央への transform 補間を仕込む。
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
    entranceProgress,
    entranceStartScale,
    entranceOrigin,
    hourglassWidth,
  ]);

  const entranceAnimatedStyle = useAnimatedStyle(() => {
    const t = entranceProgress.value;
    const tx = entranceOffsetX.value * (1 - t);
    const ty = entranceOffsetY.value * (1 - t);
    const scale = entranceStartScale.value + (1 - entranceStartScale.value) * t;
    return {
      opacity: entranceOpacity.value,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }],
    };
  });

  // mix の cross-fade。青/3層 (input/output/break) は mixProgress 0→1 で消え、
  // 紫 (purple variant) が同じ尺で現れる。
  const blueLayerStyle = useAnimatedStyle(() => ({
    opacity: 1 - mixProgress.value,
  }));
  const purpleLayerStyle = useAnimatedStyle(() => ({
    opacity: mixProgress.value,
  }));

  const hourglassRotationStyle = hourglassRotation.interpolate({
    inputRange: [-NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES, NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES],
    outputRange: [
      `${-NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES}deg`,
      `${NEXT_CYCLE_MAX_DRAG_ROTATION_DEGREES}deg`,
    ],
  });

  // 砂塊だけに掛ける rotate transform。枠の rotate に重ねて、位相遅れの揺れを表現する。
  const sandSloshRotationStyle = sandSloshValue.interpolate({
    inputRange: [-NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES, NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES],
    outputRange: [
      `${-NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES}deg`,
      `${NEXT_CYCLE_SAND_SLOSH_AMPLITUDE_DEGREES}deg`,
    ],
    extrapolate: 'clamp',
  });

  const sandOverlayViewBox = `0 0 ${blueHourglassConfig.viewBoxWidth} ${blueHourglassConfig.viewBoxHeight}`;

  // 回し終え時のチェイン (drain → return) 完了時に onStart を呼ぶための ref。
  // worklet コールバック / タイマーから安全に参照できるよう、最新の関数を保持する。
  const onStartRef = useRef(onStart);
  useEffect(() => {
    onStartRef.current = onStart;
  }, [onStart]);

  // ジェスチャー回転で 1 周以上達成 → 落下 (drain) フェーズへ直行する。
  // 混色 (mixProgress) は回転中に既にユーザー入力で 0→1 まで進んでいる前提なので、
  // ここでは念のため 1 に追いつかせるだけ。entranceOrigin が無い (テスト等) 場合は
  // アニメをスキップして即 onStart。
  const triggerNextCycleByRotation = useCallback(() => {
    if (hasTriggeredRotationStart.current || isStarting) return;

    hasTriggeredRotationStart.current = true;

    if (!entranceOrigin) {
      onStart();
      return;
    }

    // ジェスチャーで残った回転は 0 に即値リセット。SVG は 0° と 360n° で見た目が
    // 同じため、巻き戻しアニメは行わず、外側の translate+scale で視覚を引っ張る。
    idleAnimation.current?.stop();
    sandIdleAnimation.current?.stop();
    hourglassRotation.setValue(0);
    sandSloshValue.setValue(0);

    // 1 をわずかに割っているケースに備えて、短いタイミングで 1 へ寄せる。
    if (mixProgress.value < 1) {
      mixProgress.value = withTiming(1, {
        duration: NEXT_CYCLE_MIX_CATCHUP_DURATION_MS,
        easing: ReEasing.out(ReEasing.cubic),
      });
    }

    setDrainProgress(1);
    setExitPhase('draining');
  }, [entranceOrigin, hourglassRotation, isStarting, mixProgress, onStart, sandSloshValue]);

  // drain phase: 紫 1 層の progress を 1→0 に動かして上部から下部へ砂を落下させる。
  // SVG の sand overlay は JS スレッドでビルドされるため、Reanimated でなく React state を
  // ~30fps で更新する。
  useEffect(() => {
    if (exitPhase !== 'draining') return;
    let rafId: number | null = null;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / NEXT_CYCLE_DRAIN_DURATION_MS);
      // ease-in: 落下開始はゆっくり、後半で素早く落ちきる感じ。
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

  // return phase: entranceProgress を 1→0 に逆再生してバッジ位置へ移動・縮小。
  // 完了時は worklet からは setExitPhase('done') のみを runOnJS する。
  // 「+1」と「onStart」は次の useEffect (exitPhase==='done' 監視) で React レンダー後に呼ぶ。
  // worklet コールバック内で複数 setState + 関数呼び出しを連続実行すると、router.push と
  // Reanimated cleanup が衝突して落ちることがあるため、必ず一段噛ませる。
  useEffect(() => {
    if (exitPhase !== 'returning') return;
    entranceProgress.value = withTiming(
      0,
      { duration: NEXT_CYCLE_RETURN_DURATION_MS, easing: ReEasing.in(ReEasing.cubic) },
      (returned) => {
        if (!returned) return;
        runOnJS(setExitPhase)('done');
      },
    );
  }, [entranceProgress, exitPhase]);

  // exitPhase が 'done' = バッジ位置への return が完了したタイミングで createSession を起動する。
  // ここは React レンダー後の同期 JS なので、router.push と worklet 完了の競合を起こさない。
  // ループ進行 (= バッジを紫に進める) は createNextCycle.onSuccess 内の incrementLoop に任せる。
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
        // 着地前 (hasLanded === false) と exit (mix/return) 中はジェスチャー不可。
        // エントランス・退場アニメ中の二重トリガーを防ぐ。
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
          // ジェスチャー中は砂揺れを止めて中央に戻す。表面 tilt も中央に戻る。
          sandSloshValue.setValue(0);
          hasTriggeredRotationStart.current = false;
          // 新しいジェスチャー開始時は混色を初期化する。
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

          // 混色は回転量 (= 完了判定で使う metric) に比例して 0→1 まで進める。
          // ユーザーが回している途中で「だんだん混ざる」見え方を作る。
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
            // 未達成のリリースは混色も逆再生で 0 に戻す。
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
                {/*
                  下層: 紫 1 層 (mix 後の砂)。drainProgress に従って上部 → 下部へ落下する。
                  上層: 青/ピンク/白 3 層 (mix 前の砂)。mixProgress で fade-out して下層へ譲る。
                  どちらも同じ青枠 SVG (blueHourglassXml) を使うため、cross-fade 中は枠線が
                  ブレない。
                */}
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
  const resetLoop = useLoopStore((s) => s.reset);
  const [screenMode, setScreenMode] = useState<BreakScreenMode>('resting');
  // 進行中サイクルの砂時計バッジ (= currentLoop 番目の砂時計) の位置を window 座標で測ってキャッシュする。
  // 「次のサイクルへ」押下時にこのキャッシュを entranceOrigin に流し込む。
  const badgeStackRef = useRef<View>(null);
  const activeBadgeIconRef = useRef<View>(null);
  const badgeOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [entranceOrigin, setEntranceOrigin] = useState<{ x: number; y: number } | null>(null);

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

  const timerStatus = useTimerStore((s) => s.status);
  const throttledRemainingSeconds = useThrottledRemainingSeconds(100);

  // 休憩中だけ白の残量を反映する。完了 / 次サイクル準備中は 0 として扱い、白も下に積もりきった見た目にする。
  const hourglassSandProgress =
    screenMode === 'resting' && totalSeconds > 0
      ? Math.min(1, Math.max(0, throttledRemainingSeconds / totalSeconds))
      : 0;

  // input / output の砂は既に下部に積もりきっている (progress=0)。
  // break のみが active として上から減っていく。
  const hourglassSandLayers = useMemo<readonly HourglassSandLayer[]>(
    () => [
      { label: 'input', color: HOURGLASS_INPUT_COLOR, weight: inputMinutes, progress: 0 },
      { label: 'output', color: HOURGLASS_OUTPUT_COLOR, weight: outputMinutes, progress: 0 },
      {
        label: 'break',
        color: HOURGLASS_BREAK_COLOR,
        weight: breakMinutes,
        progress: hourglassSandProgress,
        opacity: HOURGLASS_BREAK_OPACITY,
      },
    ],
    [inputMinutes, outputMinutes, breakMinutes, hourglassSandProgress],
  );

  // 次サイクル準備中は「これから始まる新しいサイクル」を表すため、砂層を渡さず素のアセットを表示する。
  const effectiveSandLayers: readonly HourglassSandLayer[] =
    screenMode === 'nextCycle' ? [] : hourglassSandLayers;
  const showSandStream = screenMode === 'resting' && timerStatus === 'running';

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
    resetLoop();
    router.replace('/(tabs)');
  };

  const measureActiveBadgeOrigin = useCallback(() => {
    let measuredOrigin: { x: number; y: number } | null = null;
    activeBadgeIconRef.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) {
        const origin = { x: x + w / 2, y: y + h / 2 };
        measuredOrigin = origin;
        badgeOriginRef.current = origin;
      }
    });

    return measuredOrigin ?? badgeOriginRef.current;
  }, []);

  // 進行中サイクル (currentLoop) の砂時計の中心を window 座標で測ってキャッシュする。
  // バッジ列の onLayout から呼び出すことで、初回マウント以降の再レイアウトにも追従する。
  // tests のように measureInWindow が非同期で fire しない環境では origin が null のままになり、
  // エントランスアニメはスキップされる (NextCycleReadyView 側で即着地)。
  const handleBadgeStackLayout = useCallback(() => {
    measureActiveBadgeOrigin();
  }, [measureActiveBadgeOrigin]);

  // 「次のサイクルへ」ボタン押下: 可能なら直前の実測値を使い、取れない場合はキャッシュ済み位置へフォールバックする。
  const handleEnterNextCycle = useCallback(() => {
    setEntranceOrigin(measureActiveBadgeOrigin());
    setScreenMode('nextCycle');
  }, [measureActiveBadgeOrigin]);

  const captionText = isJudgmentReady
    ? '休憩後次のサイクルを回すか決めることができます。'
    : 'AI採点中です。ゆっくり休憩してください。';

  const isNextCycleMode = screenMode === 'nextCycle';
  const usesCompletedPhasePalette = screenMode === 'completed' || isNextCycleMode;
  const displayedPhase = usesCompletedPhasePalette ? null : CURRENT_PHASE;
  const phaseActiveColor = BREAK_COLOR;
  // ループ進行 (= 終わったループを紫化、次を青化) はここでは行わない。
  // return アニメで戻ってきた砂時計を「現在 active な青バッジ」と完全に重ねるため、
  // バッジ列のレイアウトは触らずに据え置く。実際のループ進行は createNextCycle.onSuccess
  // 内の incrementLoop() に任せ、router.push と同タイミングで自然に反映される。
  const displayedLoop = currentLoop;
  const completedPhaseColors = usesCompletedPhasePalette ? COMPLETED_PHASE_COLORS : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container} testID="break-root">
        <SessionSettingsButton
          onPress={() => router.push(SETTINGS_ROUTE)}
          testID="break-settings-button"
        />

        <View ref={badgeStackRef} style={styles.badgeStack} onLayout={handleBadgeStackLayout}>
          <HourglassBadge
            currentLoop={displayedLoop}
            testIDPrefix="break"
            borderColor={BORDER_COLOR}
            marginBottom={0}
            variant="blue"
            sandLayers={effectiveSandLayers}
            activeLayerIndex={2}
            showSandStream={showSandStream}
            activeIconRef={activeBadgeIconRef}
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
          <BreakCompletedView currentLoop={currentLoop} onNextCycle={handleEnterNextCycle} />
        ) : (
          <NextCycleReadyView
            isStarting={createNextCycle.isPending}
            hasStartError={createNextCycle.isError}
            onStart={handleStartNextCycle}
            onCancel={handleCancelNextCycle}
            entranceOrigin={entranceOrigin}
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
  completedCard: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    overflow: 'hidden',
    zIndex: 1,
  },
  completedCardImage: {
    borderRadius: 24,
  },
  completedTitleBlock: {
    alignItems: 'center',
    width: '100%',
  },
  completedTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 26,
    textAlign: 'center',
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
