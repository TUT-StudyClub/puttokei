/**
 * BreakScreen の振る舞いを検証する。
 * タイマー完了後に休憩完了画面を表示し、次サイクル準備画面へ進める。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Circle, Path, Rect } from 'react-native-svg';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as sessionApi from '@/features/session/api/sessionApi';
import * as useJudgmentProgressHook from '@/features/session/hooks/useJudgmentProgress';
import { BreakScreen } from '@/features/session/screens/BreakScreen';
import { useLoopStore } from '@/shared/stores/loopStore';
import { useTimerStore } from '@/shared/stores/timerStore';

const HOME_TIMER_CIRCLE_WIDTH_RATIO = 1 - 0.13 - 0.13;
const TIMER_STAGE_PADDING_TOP = 10;
const TIMER_CAPTION_LINE_HEIGHT = 20;
const PROGRESS_BAR_WIDTH = '86%';
const PROGRESS_BAR_HEIGHT = 8;
const PROGRESS_BAR_PADDING = 1;
const PROGRESS_CARD_HEIGHT = 168;
const PROGRESS_CARD_MARGIN_TOP = 22;
const PROGRESS_CARD_MARGIN_BOTTOM = 2;
const PROGRESS_CARD_VERTICAL_PADDING = 14;
const PROGRESS_METER_GAP = 6;
const PROGRESS_STATUS_TITLE_FONT_SIZE = 14;
const PROGRESS_STATUS_TITLE_LINE_HEIGHT = 20;
const PROGRESS_PROCESSING_TITLE_TRANSLATE_Y = 1;
const PROGRESS_READY_SUB_FONT_SIZE = 12;
const PROGRESS_READY_SUB_LINE_HEIGHT = 17;
const PROGRESS_READY_SUB_TRANSLATE_Y = 4;
const PROGRESS_STATUS_SUB_FONT_SIZE = PROGRESS_READY_SUB_FONT_SIZE;
const PROGRESS_STATUS_SUB_LINE_HEIGHT = PROGRESS_READY_SUB_LINE_HEIGHT;
const PROGRESS_PROCESSING_SUB_TRANSLATE_Y = 8;
const PROGRESS_READY_BLOCK_TRANSLATE_Y = 4;
const PROGRESS_READY_TITLE_FONT_SIZE = 14;
const PROGRESS_READY_TITLE_LINE_HEIGHT = 20;
const PROGRESS_READY_CHECK_ICON_WIDTH = 12;
const PROGRESS_READY_CHECK_ICON_HEIGHT = 9;
const PROGRESS_READY_TITLE_ROW_GAP = 8;
const PROGRESS_READY_TITLE_ROW_TRANSLATE_X =
  -(PROGRESS_READY_CHECK_ICON_WIDTH + PROGRESS_READY_TITLE_ROW_GAP) / 2;
const PROGRESS_READY_TITLE_ROW_TRANSLATE_Y = -2;
const PROGRESS_READY_TITLE_TRANSLATE_Y = -1;
const BREAK_TIMER_COLOR = '#9D9D9D';
const HOME_TIMER_TEXT_FONT_SIZE = 58;
const HOME_TIMER_TEXT_LINE_HEIGHT = 64;
const HOME_CYCLE_LABEL_FONT_SIZE = 10;
const HOME_CYCLE_LABEL_LINE_HEIGHT = 14;
const BREAK_CYCLE_LABEL_MARGIN_BOTTOM = 0;
const HOME_CYCLE_LABEL_TRANSLATE_Y = 18;
const CLOSE_CYCLE_HOURGLASS_ROW_MARGIN_TOP = 22;
const TIMER_CAPTION_GAP_CENTER_OFFSET = PROGRESS_CARD_MARGIN_TOP / 2;

const mockReplace = jest.fn();
const mockPush = jest.fn();
const INPUT_PHASE_STATUS_COLOR = 'rgba(20, 139, 255, 0.3)';
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => ({
    id: 'ses-123',
    input: '20',
    output: '5',
    break: '1',
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('@/features/session/api/sessionApi');
jest.mock('@/features/session/hooks/useJudgmentProgress');

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </TamaguiProvider>,
  );
}

function rotationResponderEvent(
  locationX: number,
  locationY: number,
  previousLocationX = locationX,
  previousLocationY = locationY,
  timestamp = 1,
) {
  return {
    nativeEvent: { locationX, locationY },
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: timestamp,
      touchBank: [
        {
          touchActive: true,
          currentPageX: locationX,
          currentPageY: locationY,
          previousPageX: previousLocationX,
          previousPageY: previousLocationY,
          currentTimeStamp: timestamp,
          previousTimeStamp: timestamp - 1,
        },
      ],
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe('BreakScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useJudgmentProgressHook.useJudgmentProgress as jest.Mock).mockReturnValue({
      data: {
        status: 'running',
        stage: 'requesting_llm',
        percent: 42,
        message: 'AI に判定を依頼しています。',
        updated_at: '2026-04-10T15:24:30.000Z',
        completed_at: null,
        error_code: null,
      },
      isPollingFallback: false,
    });
    (sessionApi.getJudgment as jest.Mock).mockResolvedValue({
      kind: 'ready',
      judgment: {
        id: 'judgment-1',
        session_id: 'ses-123',
        verdict: 'correct',
        score: 92,
        advice: 'よくできています。',
        items: [],
        judged_at: '2026-04-10T15:25:00.000Z',
      },
    });
    useTimerStore.setState({
      phase: 'idle',
      status: 'idle',
      totalSeconds: 0,
      remainingSeconds: 0,
      completionToken: 0,
    });
    useLoopStore.getState().reset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    // CI (Ubuntu) で RTL の auto cleanup (async) が 60s ハングしていたため、
    // fake timers が有効なうちに先回りで unmount を済ませる。
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('マウントで phase=break のタイマーが開始され、主要 UI が表示される', () => {
    const {
      UNSAFE_getAllByType,
      getAllByText,
      getByTestId,
      getByText,
      queryByLabelText,
      queryByTestId,
    } = renderWithProviders(<BreakScreen />);
    // 画面タイトル / フェーズタブ / タイマー中央ラベルで複数回「休憩」が出現する
    expect(getAllByText('休憩').length).toBeGreaterThan(0);
    expect(queryByTestId('break-settings-button')).toBeNull();
    expect(queryByLabelText('設定')).toBeNull();
    expect(getByTestId('break-progress-card')).toBeTruthy();
    expect(
      getAllByText('休憩').some((node) => StyleSheet.flatten(node.props.style).color === '#676767'),
    ).toBe(true);
    expect(StyleSheet.flatten(getByText('インプット').props.style).color).toBe(
      INPUT_PHASE_STATUS_COLOR,
    );
    expect(StyleSheet.flatten(getByText('アウトプット').props.style).color).toBe('#FFE4EC');
    const inputDotStyle = StyleSheet.flatten(getByTestId('break-phase-tab-input-dot').props.style);
    const outputDotStyle = StyleSheet.flatten(
      getByTestId('break-phase-tab-output-dot').props.style,
    );
    expect(inputDotStyle.borderColor).toBe(INPUT_PHASE_STATUS_COLOR);
    expect(outputDotStyle.borderColor).toBe('#FFE4EC');
    expect(inputDotStyle.backgroundColor).toBe(INPUT_PHASE_STATUS_COLOR);
    expect(outputDotStyle.backgroundColor).toBe('#FFE4EC');
    const breakDotStyle = StyleSheet.flatten(getByTestId('break-phase-tab-break-dot').props.style);
    expect(breakDotStyle.backgroundColor).toBe('#9D9D9D');
    expect(breakDotStyle.shadowColor).toBe('#000000');
    expect(breakDotStyle.elevation).toBe(4);
    expect(UNSAFE_getAllByType(Circle).some((circle) => circle.props.stroke === '#9D9D9D')).toBe(
      true,
    );
    expect(UNSAFE_getAllByType(Circle).some((circle) => circle.props.stroke === '#EFEFEF')).toBe(
      true,
    );
    const timerCaptionStyle = StyleSheet.flatten(getByTestId('break-timer-caption').props.style);
    const timerCaptionSlotStyle = StyleSheet.flatten(
      getByTestId('break-timer-caption-slot').props.style,
    );
    const timerDisplayStyle = StyleSheet.flatten(getByTestId('break-timer-display').props.style);
    const timerPhaseLabelStyle = StyleSheet.flatten(
      getByTestId('break-timer-phase-label').props.style,
    );
    const circularTimerStyle = StyleSheet.flatten(getByTestId('break-circular-timer').props.style);
    const progressCardStyle = StyleSheet.flatten(getByTestId('break-progress-card').props.style);
    const timerStageStyle = StyleSheet.flatten(getByTestId('break-timer-stage').props.style);
    const cycleLabelStyle = StyleSheet.flatten(getByTestId('break-cycle-label').props.style);
    const hourglassRowStyle = StyleSheet.flatten(getByTestId('break-hourglass-row').props.style);
    const timerProgressCircle = UNSAFE_getAllByType(Circle).find(
      (circle) => circle.props.stroke === '#9D9D9D' && circle.props.strokeDasharray,
    );
    const timerTrackCircle = UNSAFE_getAllByType(Circle).find(
      (circle) => circle.props.stroke === '#EFEFEF' && !circle.props.strokeDasharray,
    );
    expect(timerCaptionStyle.color).toBe('#9D9D9D');
    expect(timerCaptionStyle.width).toBe('100%');
    expect(timerCaptionStyle.transform).toEqual([{ translateY: TIMER_CAPTION_GAP_CENTER_OFFSET }]);
    expect(timerPhaseLabelStyle.fontWeight).toBe('600');
    expect(timerDisplayStyle.color).toBe(BREAK_TIMER_COLOR);
    expect(timerDisplayStyle.fontFamily).toBe('HiraginoSans-W6');
    expect(timerDisplayStyle.fontSize).toBe(HOME_TIMER_TEXT_FONT_SIZE);
    expect(timerDisplayStyle.fontWeight).toBe('500');
    expect(timerDisplayStyle.lineHeight).toBe(HOME_TIMER_TEXT_LINE_HEIGHT);
    expect(cycleLabelStyle.fontFamily).toBe('HiraginoSans-W6');
    expect(cycleLabelStyle.fontSize).toBe(HOME_CYCLE_LABEL_FONT_SIZE);
    expect(cycleLabelStyle.fontWeight).toBe('700');
    expect(cycleLabelStyle.lineHeight).toBe(HOME_CYCLE_LABEL_LINE_HEIGHT);
    expect(cycleLabelStyle.marginBottom).toBe(BREAK_CYCLE_LABEL_MARGIN_BOTTOM);
    expect(cycleLabelStyle.transform).toEqual([{ translateY: HOME_CYCLE_LABEL_TRANSLATE_Y }]);
    expect(hourglassRowStyle.marginTop).toBe(CLOSE_CYCLE_HOURGLASS_ROW_MARGIN_TOP);
    expect(timerCaptionSlotStyle.width).toBeGreaterThan(0);
    expect(timerCaptionSlotStyle.width).toBeCloseTo(750 * HOME_TIMER_CIRCLE_WIDTH_RATIO, 5);
    expect(timerCaptionSlotStyle.flex).toBe(1);
    expect(timerCaptionSlotStyle.justifyContent).toBe('center');
    expect(circularTimerStyle.width).toBe(timerCaptionSlotStyle.width);
    expect(circularTimerStyle.height).toBe(timerCaptionSlotStyle.width);
    expect(progressCardStyle.width).toBe(timerCaptionSlotStyle.width);
    expect(progressCardStyle.alignSelf).toBe('center');
    expect(progressCardStyle.marginTop).toBe(PROGRESS_CARD_MARGIN_TOP);
    expect(progressCardStyle.marginBottom).toBe(PROGRESS_CARD_MARGIN_BOTTOM);
    expect(timerProgressCircle?.props.strokeWidth).toBe(11);
    expect(timerTrackCircle?.props.strokeWidth).toBe(11);
    expect(timerStageStyle.justifyContent).toBe('flex-start');
    expect(timerStageStyle.paddingTop).toBe(10);
    expect(timerStageStyle.minHeight).toBeCloseTo(
      750 * HOME_TIMER_CIRCLE_WIDTH_RATIO + TIMER_STAGE_PADDING_TOP + TIMER_CAPTION_LINE_HEIGHT,
      5,
    );
    expect(getByTestId('break-timer-caption').props.numberOfLines).toBe(1);
    expect(useTimerStore.getState().phase).toBe('break');
    expect(useTimerStore.getState().totalSeconds).toBe(60);
  });

  it('判定進捗カードに progress API の status / message / percent を表示する', async () => {
    (sessionApi.getJudgment as jest.Mock).mockResolvedValue({
      kind: 'pending',
      pending: {
        status: 'pending',
        detail: '判定結果を準備しています。',
        retry_after_seconds: 5,
        estimated_ready_at: '2026-04-10T15:30:00.000Z',
      },
    });

    const { getByTestId, getByText, queryByTestId } = renderWithProviders(<BreakScreen />);

    await waitFor(() => {
      expect(getByTestId('break-progress-status')).toBeTruthy();
    });
    const progressCardStyle = StyleSheet.flatten(getByTestId('break-progress-card').props.style);
    expect(progressCardStyle.backgroundColor).toBe('#363636');
    expect(progressCardStyle.height).toBe(PROGRESS_CARD_HEIGHT);
    expect(progressCardStyle.marginTop).toBe(PROGRESS_CARD_MARGIN_TOP);
    expect(progressCardStyle.marginBottom).toBe(PROGRESS_CARD_MARGIN_BOTTOM);
    expect(progressCardStyle.paddingVertical).toBe(PROGRESS_CARD_VERTICAL_PADDING);
    expect(progressCardStyle.justifyContent).toBe('flex-start');
    const progressBarOuterStyle = StyleSheet.flatten(
      getByTestId('break-progress-bar-outer').props.style,
    );
    const progressHeaderRowStyle = StyleSheet.flatten(
      getByTestId('break-progress-meter-block').props.children[0].props.style,
    );
    const progressMeterBlockStyle = StyleSheet.flatten(
      getByTestId('break-progress-meter-block').props.style,
    );
    const progressTrackStyle = StyleSheet.flatten(getByTestId('break-progress-track').props.style);
    const progressFillStyle = StyleSheet.flatten(getByTestId('break-progress-fill').props.style);
    expect(progressMeterBlockStyle.gap).toBe(PROGRESS_METER_GAP);
    expect(progressHeaderRowStyle.width).toBe(PROGRESS_BAR_WIDTH);
    expect(progressHeaderRowStyle.alignSelf).toBe('center');
    expect(progressBarOuterStyle.width).toBe(PROGRESS_BAR_WIDTH);
    expect(progressBarOuterStyle.height).toBe(PROGRESS_BAR_HEIGHT);
    expect(progressBarOuterStyle.padding).toBe(PROGRESS_BAR_PADDING);
    expect(progressBarOuterStyle.borderRadius).toBe(PROGRESS_BAR_HEIGHT / 2);
    expect(progressBarOuterStyle.alignSelf).toBe('center');
    expect(progressBarOuterStyle.backgroundColor).toBe('#EFEFEF');
    expect(progressBarOuterStyle.shadowColor).toBe('#000000');
    expect(progressBarOuterStyle.elevation).toBe(6);
    expect(progressTrackStyle.backgroundColor).toBe('#CDCDCD');
    expect(progressTrackStyle.borderRadius).toBe(
      (PROGRESS_BAR_HEIGHT - PROGRESS_BAR_PADDING * 2) / 2,
    );
    expect(progressFillStyle.backgroundColor).toBe('#475FFF');
    expect(progressFillStyle.borderRadius).toBe(
      (PROGRESS_BAR_HEIGHT - PROGRESS_BAR_PADDING * 2) / 2,
    );
    expect(getByTestId('break-progress-status').props.children).toBe('テキストの解析...');
    expect(getByTestId('break-progress-processing-title').props.children).toBe('採点中...');
    expect(getByTestId('break-progress-processing-sub').props.children).toEqual([
      'あなたのアウトプットを',
      '\n',
      'AIが採点しています。',
    ]);
    expect(queryByTestId('break-progress-message')).toBeNull();
    const processingTitleStyle = StyleSheet.flatten(
      getByTestId('break-progress-processing-title').props.style,
    );
    const processingSubStyle = StyleSheet.flatten(
      getByTestId('break-progress-processing-sub').props.style,
    );
    const processingSubOffsetStyle = StyleSheet.flatten(
      getByTestId('break-progress-processing-sub-offset').props.style,
    );
    expect(processingTitleStyle.color).toBe('#FFFFFF');
    expect(processingTitleStyle.fontFamily).toBe('HiraginoSans-W3');
    expect(processingTitleStyle.fontSize).toBe(PROGRESS_STATUS_TITLE_FONT_SIZE);
    expect(processingTitleStyle.fontWeight).toBe('600');
    expect(processingTitleStyle.lineHeight).toBe(PROGRESS_STATUS_TITLE_LINE_HEIGHT);
    expect(processingTitleStyle.transform).toEqual([
      { translateY: PROGRESS_PROCESSING_TITLE_TRANSLATE_Y },
    ]);
    expect(processingSubStyle.fontSize).toBe(PROGRESS_STATUS_SUB_FONT_SIZE);
    expect(processingSubStyle.lineHeight).toBe(PROGRESS_STATUS_SUB_LINE_HEIGHT);
    expect(processingSubStyle.transform).toBeUndefined();
    expect(processingSubOffsetStyle.marginTop).toBe(PROGRESS_PROCESSING_SUB_TRANSLATE_Y);
    expect(getByText('42%')).toBeTruthy();
  });

  it('useJudgment が ready のときは進捗を 100% で表示し、上部 status / message を出さない', async () => {
    const { getByTestId, getByText, queryByTestId } = renderWithProviders(<BreakScreen />);

    await waitFor(() => {
      expect(getByTestId('break-progress-ready')).toBeTruthy();
    });
    expect(StyleSheet.flatten(getByTestId('break-progress-card').props.style).height).toBe(
      PROGRESS_CARD_HEIGHT,
    );
    expect(StyleSheet.flatten(getByTestId('break-progress-card').props.style).justifyContent).toBe(
      'flex-start',
    );
    expect(StyleSheet.flatten(getByTestId('break-timer-caption').props.style).color).toBe(
      '#9D9D9D',
    );
    expect(getByText('100%')).toBeTruthy();
    expect(queryByTestId('break-progress-status')).toBeNull();
    expect(queryByTestId('break-progress-message')).toBeNull();
    const readyCheckIconStyle = StyleSheet.flatten(
      getByTestId('break-progress-ready-check-icon').props.style,
    );
    const readyBlockStyle = StyleSheet.flatten(getByTestId('break-progress-ready').props.style);
    const readyTitleRowStyle = StyleSheet.flatten(
      getByTestId('break-progress-ready-title-row').props.style,
    );
    expect(readyBlockStyle.transform).toEqual([{ translateY: PROGRESS_READY_BLOCK_TRANSLATE_Y }]);
    expect(readyCheckIconStyle.width).toBe(PROGRESS_READY_CHECK_ICON_WIDTH);
    expect(readyCheckIconStyle.height).toBe(PROGRESS_READY_CHECK_ICON_HEIGHT);
    expect(readyTitleRowStyle.gap).toBe(PROGRESS_READY_TITLE_ROW_GAP);
    expect(readyTitleRowStyle.transform).toEqual([
      { translateX: PROGRESS_READY_TITLE_ROW_TRANSLATE_X },
      { translateY: PROGRESS_READY_TITLE_ROW_TRANSLATE_Y },
    ]);
    const readyTitleStyle = StyleSheet.flatten(getByText('採点完了').props.style);
    const readySubStyle = StyleSheet.flatten(getByTestId('break-progress-ready-sub').props.style);
    expect(readyTitleStyle.color).toBe('#FFFFFF');
    expect(readyTitleStyle.fontFamily).toBe('HiraginoSans-W3');
    expect(readyTitleStyle.fontSize).toBe(PROGRESS_READY_TITLE_FONT_SIZE);
    expect(readyTitleStyle.fontWeight).toBe('600');
    expect(readyTitleStyle.lineHeight).toBe(PROGRESS_READY_TITLE_LINE_HEIGHT);
    expect(readyTitleStyle.transform).toEqual([{ translateY: PROGRESS_READY_TITLE_TRANSLATE_Y }]);
    expect(readyTitleStyle.textShadowColor).toBeUndefined();
    expect(readyTitleStyle.textShadowRadius).toBeUndefined();
    expect(readySubStyle.color).toBe('#EFEFEF');
    expect(readySubStyle.fontSize).toBe(PROGRESS_READY_SUB_FONT_SIZE);
    expect(readySubStyle.lineHeight).toBe(PROGRESS_READY_SUB_LINE_HEIGHT);
    expect(readySubStyle.transform).toEqual([{ translateY: PROGRESS_READY_SUB_TRANSLATE_Y }]);
  });

  it('休憩中の砂時計は上部が白のみ・下部に青/ピンク/白が積もり、ストリームは白色', () => {
    const { UNSAFE_getAllByType } = renderWithProviders(<BreakScreen />);

    // route params は input='20', output='5', break='1' (合計 26 分)。break 50% 経過。
    act(() => {
      useTimerStore.setState({
        totalSeconds: 60,
        remainingSeconds: 30,
        status: 'running',
      });
    });

    const upperClip = 'url(#hourglassBadgeBlueUpperSandClip)';
    const lowerClip = 'url(#hourglassBadgeBlueLowerSandClip)';

    const upperPaths = UNSAFE_getAllByType(Path).filter(
      (path) => path.props.clipPath === upperClip,
    );
    // 上部は白 (break) のみ。input/output は progress=0 なので上部に出ない。
    const whiteUpper = upperPaths.find((path) => path.props.fill === '#FFFFFF');
    expect(whiteUpper).toBeTruthy();
    expect(whiteUpper?.props.fillOpacity).toBe(0.92);
    expect(upperPaths.find((path) => path.props.fill === '#148BFF')).toBeUndefined();
    expect(upperPaths.find((path) => path.props.fill === '#F24D7E')).toBeUndefined();

    // 下部には input(青) / output(ピンク) / break(白) の 3 色が積もる。
    const lowerPaths = UNSAFE_getAllByType(Path).filter(
      (path) => path.props.clipPath === lowerClip,
    );
    expect(lowerPaths.find((path) => path.props.fill === '#148BFF')).toBeTruthy();
    expect(lowerPaths.find((path) => path.props.fill === '#F24D7E')).toBeTruthy();
    expect(lowerPaths.find((path) => path.props.fill === '#FFFFFF')).toBeTruthy();

    // ストリームは active = 白。blue variant の width=0.43 / height=7.41 で同定する。
    const streamRect = UNSAFE_getAllByType(Rect).find(
      (rect) => rect.props.fill === '#FFFFFF' && rect.props.width === 0.43,
    );
    expect(streamRect).toBeTruthy();
    expect(streamRect?.props.height).toBe(7.41);
  });

  it('休憩終了直後 (remaining=0) は上部に砂が無く、下部に青/ピンク/白が積もる', () => {
    const { UNSAFE_getAllByType } = renderWithProviders(<BreakScreen />);

    act(() => {
      useTimerStore.setState({
        totalSeconds: 60,
        remainingSeconds: 0,
        status: 'running',
      });
    });

    const upperClip = 'url(#hourglassBadgeBlueUpperSandClip)';
    const lowerClip = 'url(#hourglassBadgeBlueLowerSandClip)';

    const upperPaths = UNSAFE_getAllByType(Path).filter(
      (path) => path.props.clipPath === upperClip,
    );
    expect(upperPaths).toHaveLength(0);

    const lowerPaths = UNSAFE_getAllByType(Path).filter(
      (path) => path.props.clipPath === lowerClip,
    );
    expect(lowerPaths.find((path) => path.props.fill === '#148BFF')).toBeTruthy();
    expect(lowerPaths.find((path) => path.props.fill === '#F24D7E')).toBeTruthy();
    expect(lowerPaths.find((path) => path.props.fill === '#FFFFFF')).toBeTruthy();
  });

  it('タイマー完了で休憩完了画面を表示し、result へ自動遷移しない', async () => {
    const { getByTestId, getByText } = renderWithProviders(<BreakScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(getByTestId('break-completed-view')).toBeTruthy();
    });
    expect(getByText('お疲れ様でした！')).toBeTruthy();
    expect(getByText('記念すべき1サイクル目です！')).toBeTruthy();
    const completedTitleStyle = StyleSheet.flatten(getByText('お疲れ様でした！').props.style);
    const completedCycleTitleStyle = StyleSheet.flatten(
      getByText('記念すべき1サイクル目です！').props.style,
    );
    expect(completedTitleStyle.fontFamily).toBe('HiraginoSans-W6');
    expect(completedTitleStyle.fontWeight).toBe('600');
    expect(completedCycleTitleStyle.fontFamily).toBe('HiraginoSans-W6');
    expect(completedCycleTitleStyle.fontWeight).toBe('600');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('「次のサイクルへ」押下で次サイクル準備画面を表示する', async () => {
    const { getByTestId, getByText } = renderWithProviders(<BreakScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(getByTestId('break-next-cycle-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('break-next-cycle-button'));

    expect(getByTestId('break-next-cycle-view')).toBeTruthy();
    expect(getByText('砂時計を回して次のサイクルを回そう！')).toBeTruthy();
    expect(getByTestId('break-next-cycle-cancel')).toBeTruthy();
    expect(useLoopStore.getState().currentLoop).toBe(1);
  });

  it('次サイクル準備画面の砂時計を回転させ、セッション作成成功後にだけループを進める', async () => {
    const nextSession = {
      id: 'ses-next',
      user_id: 'usr-1',
      status: 'input',
      subject: '未設定',
      topic: '未設定',
      input_minutes: 20,
      output_minutes: 5,
      break_minutes: 1,
      started_at: '2026-04-10T15:30:00.000Z',
      completed_at: null,
      created_at: '2026-04-10T15:30:00.000Z',
    };
    const createSessionDeferred = createDeferred<typeof nextSession>();
    (sessionApi.createSession as jest.Mock).mockReturnValue(createSessionDeferred.promise);

    const { getByTestId } = renderWithProviders(<BreakScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(getByTestId('break-next-cycle-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('break-next-cycle-button'));
    fireEvent.press(getByTestId('break-next-cycle-hourglass'));
    expect(sessionApi.createSession).not.toHaveBeenCalled();

    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderGrant',
      rotationResponderEvent(260, 215),
    );
    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderMove',
      rotationResponderEvent(160, 115, 260, 215, 2),
    );
    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderMove',
      rotationResponderEvent(60, 215, 160, 115, 3),
    );
    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderMove',
      rotationResponderEvent(160, 315, 60, 215, 4),
    );
    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderMove',
      rotationResponderEvent(260, 215, 160, 315, 5),
    );

    expect(sessionApi.createSession).not.toHaveBeenCalled();

    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderRelease',
      rotationResponderEvent(260, 215, 260, 215, 6),
    );

    await waitFor(() => {
      expect(sessionApi.createSession).toHaveBeenCalledWith({
        subject: '未設定',
        topic: '未設定',
        input_minutes: 20,
        output_minutes: 5,
        break_minutes: 1,
      });
    });
    expect(useLoopStore.getState().currentLoop).toBe(1);
    expect(mockPush).not.toHaveBeenCalled();

    await act(async () => {
      createSessionDeferred.resolve(nextSession);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/session/[id]/input',
        params: {
          id: 'ses-next',
          input: '20',
          output: '5',
          break: '1',
        },
      });
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(useLoopStore.getState().currentLoop).toBe(2);
  });

  it('次サイクル準備画面で一周未満の回転では指を離しても開始しない', async () => {
    const { getByTestId } = renderWithProviders(<BreakScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(getByTestId('break-next-cycle-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('break-next-cycle-button'));

    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderGrant',
      rotationResponderEvent(260, 215),
    );
    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderMove',
      rotationResponderEvent(160, 115, 260, 215, 2),
    );
    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderMove',
      rotationResponderEvent(60, 215, 160, 115, 3),
    );
    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderRelease',
      rotationResponderEvent(60, 215, 60, 215, 4),
    );

    expect(sessionApi.createSession).not.toHaveBeenCalled();
  });

  it('次サイクル準備画面の中断ボタン押下でホームへ戻る', async () => {
    const { getByTestId } = renderWithProviders(<BreakScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(getByTestId('break-next-cycle-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('break-next-cycle-button'));
    fireEvent.press(getByTestId('break-next-cycle-cancel'));

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});
