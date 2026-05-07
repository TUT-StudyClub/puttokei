/**
 * StatsScreen の日単位レポート表示を検証する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { processColor, StyleSheet, View } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as statsApi from '@/features/stats/api/statsApi';
import { StatsScreen } from '@/features/stats/screens/StatsScreen';
import type { DailyReportResponse, WeeklyReportResponse } from '@/features/stats/types';
import type { OutputReviewItem } from '@/features/session/types';
import { ApiError } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/authStore';

jest.mock('@/features/stats/api/statsApi');

const TEXT_MODE_ICON_BLACK = require('../../../../../assets/images/icons/icon_pen_black.png');
const TEXT_MODE_ICON_GRAY = require('../../../../../assets/images/icons/icon_pen_gray.png');
const IMAGE_MODE_ICON_BLACK = require('../../../../../assets/images/icons/icon_pic_black..png');
const IMAGE_MODE_ICON_GRAY = require('../../../../../assets/images/icons/icon_pic_gray..png');
const VOICE_MODE_ICON_GRAY = require('../../../../../assets/images/icons/icon_mic_gray.png');
const PLUS_ICON = require('../../../../../assets/images/icons/plus.png');

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: unknown }) => {
    const { Text } = require('react-native');
    return <Text testID="stats-redirect">{JSON.stringify(href)}</Text>;
  },
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

function makeDailyResponse(overrides: Partial<DailyReportResponse> = {}): DailyReportResponse {
  const base: DailyReportResponse = {
    date: '2026-04-29',
    summary: {
      input_minutes: 100,
      output_minutes: 25,
      break_minutes: 25,
      total_study_minutes: 125,
      total_sessions: 5,
    },
    output_history: [
      {
        session_id: 'ses-1',
        session_started_at: '2026-04-29T00:35:00Z',
        input_minutes: 20,
        output_minutes: 5,
        output: {
          id: 'out-1',
          session_id: 'ses-1',
          kind: 'text',
          content: '関係代名詞は先行詞を修飾する表現です。',
          image_url: null,
          submitted_at: '2026-04-29T01:00:00Z',
        },
        cycle_index: 1,
        subject: '英語',
        subject_id: null,
        subject_color: null,
        topic: '関係代名詞',
        judgment: {
          id: 'judgment-1',
          session_id: 'ses-1',
          verdict: 'partial',
          score: 80,
          advice: '要点は整理できています。',
          corrections: [],
          judged_at: '2026-04-29T01:05:00Z',
        },
      },
    ],
  };

  return {
    ...base,
    ...overrides,
  };
}

function parseDateKeyForTest(dateKey: string): Date {
  const [year = '1970', month = '1', day = '1'] = dateKey.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function toDateKeyForTest(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToDateKeyForTest(dateKey: string, days: number): string {
  const date = parseDateKeyForTest(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKeyForTest(date);
}

function makeOutputHistoryItem(cycleIndex: number): OutputReviewItem {
  const startedMinute = 10 + cycleIndex * 10;
  const submittedMinute = startedMinute + 5;
  return {
    session_id: `ses-${cycleIndex}`,
    session_started_at: `2026-04-29T00:${String(startedMinute).padStart(2, '0')}:00Z`,
    input_minutes: 20,
    output_minutes: 5,
    output: {
      id: `out-${cycleIndex}`,
      session_id: `ses-${cycleIndex}`,
      kind: 'text',
      content: `アウトプット${cycleIndex}`,
      image_url: null,
      submitted_at: `2026-04-29T00:${String(submittedMinute).padStart(2, '0')}:00Z`,
    },
    cycle_index: cycleIndex,
    subject: '英語',
    subject_id: null,
    subject_color: null,
    topic: '関係代名詞',
    judgment: null,
  };
}

function makeWeeklyResponseForDates(
  weekStart: string,
  studiedMinutesByDate: Record<string, number>,
): WeeklyReportResponse {
  const points = Array.from({ length: 7 }, (_value, index) => {
    const bucket = addDaysToDateKeyForTest(weekStart, index);
    const minutes = studiedMinutesByDate[bucket] ?? 0;
    return {
      bucket,
      label: String(parseDateKeyForTest(bucket).getDate()),
      study_minutes: minutes,
      sessions: minutes > 0 ? 1 : 0,
    };
  });

  return {
    week_start: weekStart,
    week_end: addDaysToDateKeyForTest(weekStart, 6),
    summary: {
      input_minutes: 0,
      output_minutes: 0,
      break_minutes: 0,
      total_study_minutes: points.reduce((total, point) => total + point.study_minutes, 0),
      total_sessions: points.reduce((total, point) => total + point.sessions, 0),
    },
    points,
    output_history: [],
  };
}

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

async function flushAsyncUpdates() {
  await act(async () => {});
  act(() => {
    jest.runOnlyPendingTimers();
  });
}

type TestNodeWithParent = {
  parent: TestNodeWithParent | null;
  props: {
    testID?: string;
  };
};

function hasTestIdAncestor(node: TestNodeWithParent, testID: string): boolean {
  let current = node.parent;
  while (current) {
    if (current.props.testID === testID) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

describe('StatsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-29T00:00:00Z'));
    (statsApi.updateOutputSubject as jest.Mock).mockImplementation(
      (outputId: string, input: { label: string; color: string }) =>
        Promise.resolve({
          output_id: outputId,
          subject_id: `subject-${input.label}`,
          subject: input.label,
          subject_color: input.color,
          updated_at: '2026-05-03T12:00:00Z',
        }),
    );
    (statsApi.fetchWeeklyReport as jest.Mock).mockImplementation((weekStart: string) =>
      Promise.resolve(makeWeeklyResponseForDates(weekStart, {})),
    );
    act(() => {
      useAuthStore.setState({ uid: 'u-1', idToken: 'token-1', isAnonymous: false });
    });
  });

  afterEach(() => {
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null, isAnonymous: false });
    });
    jest.useRealTimers();
  });

  it('未認証の場合はサインインへ遷移し、レポートを取得しない', () => {
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null, isAnonymous: false });
    });

    const { getByTestId } = renderWithProviders(<StatsScreen />);

    expect(getByTestId('stats-redirect').props.children).toBe(
      JSON.stringify({
        pathname: '/(auth)/sign-in',
        params: { returnTo: '/(tabs)/stats' },
      }),
    );
    expect(statsApi.fetchDailyReport).not.toHaveBeenCalled();
    expect(statsApi.fetchWeeklyReport).not.toHaveBeenCalled();
  });

  it('匿名ユーザーの場合はサインインへ遷移し、レポートを取得しない', () => {
    act(() => {
      useAuthStore.setState({
        uid: 'anonymous-user',
        idToken: 'anonymous-token',
        isAnonymous: true,
      });
    });

    const { getByTestId } = renderWithProviders(<StatsScreen />);

    expect(getByTestId('stats-redirect').props.children).toBe(
      JSON.stringify({
        pathname: '/(auth)/sign-in',
        params: { returnTo: '/(tabs)/stats' },
      }),
    );
    expect(statsApi.fetchDailyReport).not.toHaveBeenCalled();
    expect(statsApi.fetchWeeklyReport).not.toHaveBeenCalled();
  });

  it('設定ボタンを少し右寄せで表示し、設定画面へ遷移できる', () => {
    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(makeDailyResponse());

    const { getByLabelText, getByTestId, UNSAFE_getAllByType } = renderWithProviders(
      <StatsScreen />,
    );
    const hasHomeAlignedSettingsRow = UNSAFE_getAllByType(View).some((view) => {
      const style = StyleSheet.flatten(view.props.style);
      return style?.position === 'absolute' && style.top === -4.5 && style.right === 34;
    });

    expect(getByLabelText('設定')).toBeTruthy();
    expect(getByTestId('stats-settings-button')).toBeTruthy();
    expect(hasHomeAlignedSettingsRow).toBe(true);

    fireEvent.press(getByTestId('stats-settings-button'));

    expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/settings');
  });

  it('初期表示で当日の日次レポートを取得し、ハイライトと履歴を表示する', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(makeDailyResponse());

    const { getByTestId, getByText, queryByText } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchDailyReport).toHaveBeenCalledWith('2026-04-29');
    });
    await waitFor(() => {
      expect(getByTestId('stats-highlight-card')).toBeTruthy();
    });
    const sessionBadgeRow = getByTestId('stats-session-badge').props.children;
    const sessionBadgeChildren = sessionBadgeRow.props.children;
    const sessionBadgeXOffset = sessionBadgeChildren[0];
    const sessionBadgeXText = sessionBadgeXOffset.props.children;
    const sessionBadgeNumberText = sessionBadgeChildren[1];
    expect(StyleSheet.flatten(sessionBadgeNumberText.props.style)).toMatchObject({
      fontSize: 16,
      fontFamily: 'HiraginoSans-W6',
      fontWeight: '600',
      transform: [{ translateX: -2 }],
    });
    expect(StyleSheet.flatten(sessionBadgeXOffset.props.style)).toMatchObject({
      left: -2,
      position: 'relative',
      top: 0,
    });
    expect(sessionBadgeXText.props.children).toBe('×');
    expect(StyleSheet.flatten(sessionBadgeXText.props.style)).toMatchObject({
      fontSize: 14,
    });
    expect(sessionBadgeNumberText.props.children).toBe(5);
    expect(getByTestId('stats-output-history-title').props.children).toBe('履歴');
    expect(getByTestId('stats-scroll-content').type).toBe('View');
    expect(getByTestId('stats-output-history-table-scroll').type).toBe('RCTScrollView');
    expect(
      hasTestIdAncestor(
        getByTestId('stats-output-history-title'),
        'stats-output-history-table-scroll',
      ),
    ).toBe(true);
    expect(getByTestId('stats-output-history-item-out-1')).toBeTruthy();
    expect(getByText('4月29日')).toBeTruthy();
    expect(getByText('09：35 - 10：00')).toBeTruthy();
    expect(getByText('サイクル1')).toBeTruthy();
    expect(getByText('今日のハイライト')).toBeTruthy();
    expect(StyleSheet.flatten(getByText('今日のハイライト').props.style)).toMatchObject({
      fontFamily: 'HiraginoSans-W6',
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 23,
    });
    expect(
      StyleSheet.flatten(getByTestId('stats-highlight-title-row').props.style).transform,
    ).toEqual([{ translateY: 8 }]);
    expect(queryByText('教科')).toBeNull();
  });

  it('履歴表のスクロール領域に全サイクル分を表示する', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(
      makeDailyResponse({
        output_history: [1, 2, 3, 4].map((cycleIndex) => makeOutputHistoryItem(cycleIndex)),
      }),
    );

    const { getByTestId, queryByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-output-history-item-out-4')).toBeTruthy();
    });
    expect(getByTestId('stats-output-history-item-out-3')).toBeTruthy();
    expect(getByTestId('stats-output-history-item-out-2')).toBeTruthy();
    expect(queryByTestId('stats-output-history-item-out-1')).toBeTruthy();
  });

  it('履歴行をタップすると下部シートでアウトプット内容を確認できる', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(makeDailyResponse());

    const { getAllByText, getByTestId, getByText, queryByTestId } = renderWithProviders(
      <StatsScreen />,
    );
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-output-history-item-out-1')).toBeTruthy();
    });
    expect(queryByTestId('stats-history-sheet')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('stats-output-history-item-out-1'));
    });

    expect(getByTestId('stats-history-sheet')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('stats-history-sheet').props.style).height).toBe('67%');
    expect(StyleSheet.flatten(getByTestId('stats-history-sheet').props.style).maxHeight).toBe(
      '69%',
    );
    const historySheetTitleStyle = StyleSheet.flatten(
      getByTestId('stats-history-sheet-title').props.style,
    );
    const historySheetTitleTimeStyle = StyleSheet.flatten(
      getByTestId('stats-history-sheet-title-time').props.style,
    );
    const historySheetCloseStyle = StyleSheet.flatten(
      getByTestId('stats-history-sheet-close').props.style,
    );
    const historySheetConfirmStyle = StyleSheet.flatten(
      getByTestId('stats-history-sheet-confirm').props.style,
    );
    const historySheetCloseIcon = getByTestId('stats-history-sheet-close-icon');
    const historySheetConfirmIcon = getByTestId('stats-history-sheet-confirm-icon');
    expect(historySheetTitleStyle.paddingLeft).toBe(12);
    expect(historySheetTitleStyle.fontWeight).toBe('700');
    expect(historySheetTitleStyle.transform).toEqual([{ translateY: 5 }]);
    expect(historySheetTitleTimeStyle.transform).toEqual([{ translateX: 3 }, { scaleX: 0.98 }]);
    expect(historySheetCloseStyle.width).toBe(36);
    expect(historySheetCloseStyle.height).toBe(36);
    expect(historySheetCloseStyle.borderRadius).toBe(18);
    expect(historySheetCloseStyle.transform).toEqual([{ translateY: 4 }]);
    expect(historySheetCloseIcon.props.width).toBe(17);
    expect(historySheetCloseIcon.props.height).toBe(17);
    expect(historySheetConfirmStyle.width).toBe(36);
    expect(historySheetConfirmStyle.height).toBe(36);
    expect(historySheetConfirmStyle.borderRadius).toBe(18);
    expect(historySheetConfirmStyle.transform).toEqual([{ translateY: 4 }]);
    expect(historySheetConfirmIcon.props.width).toBe(17);
    expect(historySheetConfirmIcon.props.height).toBe(17);
    expect(getByText('教科')).toBeTruthy();
    expect(getByText('英語')).toBeTruthy();
    expect(getAllByText('アウトプット').length).toBeGreaterThan(0);
    expect(getByTestId('stats-history-sheet-tab-icon-text').props.source).toBe(
      TEXT_MODE_ICON_BLACK,
    );
    expect(getByTestId('stats-history-sheet-tab-icon-image').props.source).toBe(
      IMAGE_MODE_ICON_GRAY,
    );
    expect(getByTestId('stats-history-sheet-tab-icon-voice').props.source).toBe(
      VOICE_MODE_ICON_GRAY,
    );
    expect(getByTestId('stats-history-sheet-output-text')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-close'));
    });
    expect(queryByTestId('stats-history-sheet')).toBeNull();
  });

  it('履歴詳細の教科が未設定の場合は値表示をグレーにする', async () => {
    const baseResponse = makeDailyResponse();
    const baseHistoryItem = baseResponse.output_history[0];
    if (baseHistoryItem === undefined) {
      throw new Error('base history item is missing');
    }

    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(
      makeDailyResponse({
        output_history: [
          {
            ...baseHistoryItem,
            subject: '未設定',
          },
        ],
      }),
    );

    const { getByTestId, getByText, queryByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-output-history-item-out-1')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('stats-output-history-item-out-1'));
    });

    const subjectDotStyle = StyleSheet.flatten(
      getByTestId('stats-history-sheet-subject-dot').props.style,
    );
    const subjectTextStyle = StyleSheet.flatten(
      getByTestId('stats-history-sheet-subject-text').props.style,
    );
    const subjectRowStyle = StyleSheet.flatten(
      getByTestId('stats-history-sheet-subject-row').props.style,
    );

    expect(getByTestId('stats-history-sheet-subject-text').props.children).toBe('未設定');
    expect(subjectRowStyle.transform).toEqual([{ translateY: -3 }]);
    expect(subjectDotStyle.backgroundColor).toBe('#D0D0D0');
    expect(subjectDotStyle.transform).toBeUndefined();
    expect(subjectTextStyle.color).toBe('#777777');
    expect(subjectTextStyle.transform).toBeUndefined();

    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-subject-row'));
    });

    expect(getByTestId('stats-history-sheet-subject-picker')).toBeTruthy();
    expect(getByText('教科を追加する')).toBeTruthy();
    expect(getByTestId('stats-history-sheet-new-subject-plus-icon').props.source).toBe(PLUS_ICON);
    const newSubjectButtonStyle = StyleSheet.flatten(
      getByTestId('stats-history-sheet-subject-picker-new').props.style,
    );
    const newSubjectText = getByTestId('stats-history-sheet-subject-picker-new-text');
    const newSubjectTextStyle = StyleSheet.flatten(newSubjectText.props.style);
    expect(newSubjectButtonStyle.flex).toBe(1);
    expect(newSubjectButtonStyle.minWidth).toBe(0);
    expect(newSubjectButtonStyle.marginRight).toBe(8);
    expect(newSubjectText.props.numberOfLines).toBe(1);
    expect(newSubjectText.props.adjustsFontSizeToFit).toBe(true);
    expect(newSubjectTextStyle.flexShrink).toBe(1);
    expect(queryByTestId('stats-history-sheet-subject-option-0')).toBeNull();
    expect(
      StyleSheet.flatten(getByTestId('stats-history-sheet-subject-picker').props.style).height,
    ).toBe(59);
  });

  it('履歴詳細の教科行をタップすると作成済み教科の一覧を表示する', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(
      makeDailyResponse({
        output_history: [
          {
            ...makeOutputHistoryItem(1),
            subject: '理科',
          },
          {
            ...makeOutputHistoryItem(2),
            subject: '現代文',
          },
        ],
      }),
    );

    const { getAllByText, getByTestId, getByText, queryByTestId } = renderWithProviders(
      <StatsScreen />,
    );
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-output-history-item-out-2')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('stats-output-history-item-out-2'));
    });
    expect(queryByTestId('stats-history-sheet-subject-picker')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-subject-row'));
    });

    expect(getByTestId('stats-history-sheet-subject-picker')).toBeTruthy();
    expect(
      StyleSheet.flatten(getByTestId('stats-history-sheet-subject-picker').props.style).height,
    ).toBe(124);
    expect(getByText('教科を追加する')).toBeTruthy();
    expect(getByText('理科')).toBeTruthy();
    expect(getAllByText('現代文').length).toBeGreaterThan(1);
    expect(
      StyleSheet.flatten(getByTestId('stats-history-sheet-subject-option-dot-0').props.style)
        .backgroundColor,
    ).toBe('#457DFF');
    expect(
      StyleSheet.flatten(getByTestId('stats-history-sheet-subject-option-dot-1').props.style)
        .backgroundColor,
    ).toBe('#2BAAF3');

    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-subject-option-0'));
    });
    expect(queryByTestId('stats-history-sheet-subject-picker')).toBeNull();
    expect(statsApi.updateOutputSubject).toHaveBeenCalledWith('out-2', {
      label: '理科',
      color: '#457DFF',
    });
    expect(getByTestId('stats-history-sheet-subject-text').props.children).toBe('理科');
    expect(
      StyleSheet.flatten(getByTestId('stats-history-sheet-subject-dot').props.style)
        .backgroundColor,
    ).toBe('#457DFF');

    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-subject-row'));
    });
    expect(getByTestId('stats-history-sheet-subject-option-check-0')).toBeTruthy();
    expect(queryByTestId('stats-history-sheet-subject-option-check-1')).toBeNull();
    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-subject-picker-close'));
    });
    expect(queryByTestId('stats-history-sheet-subject-picker')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-close'));
    });
    expect(queryByTestId('stats-history-sheet')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('stats-output-history-item-out-2'));
    });
    expect(getByTestId('stats-history-sheet-subject-text').props.children).toBe('理科');

    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-subject-row'));
    });
    expect(getByTestId('stats-history-sheet-subject-option-check-0')).toBeTruthy();
    expect(queryByTestId('stats-history-sheet-subject-option-check-1')).toBeNull();
  });

  it('教科ポップアップの新規教科押下で追加画面を表示し保存後に一覧へ追加する', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(
      makeDailyResponse({
        output_history: [
          {
            ...makeOutputHistoryItem(1),
            subject: '理科',
          },
        ],
      }),
    );

    const { getAllByText, getByTestId, getByText, queryByTestId } = renderWithProviders(
      <StatsScreen />,
    );
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-output-history-item-out-1')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('stats-output-history-item-out-1'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-subject-row'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-subject-picker-new'));
    });

    const newSubjectTitleStyle = StyleSheet.flatten(
      getByTestId('stats-new-subject-title', { includeHiddenElements: true }).props.style,
    );
    const newSubjectColorRowStyle = StyleSheet.flatten(
      getByTestId('stats-new-subject-color-row', { includeHiddenElements: true }).props.style,
    );
    const newSubjectSubjectLabelStyle = StyleSheet.flatten(
      getByTestId('stats-new-subject-subject-label', { includeHiddenElements: true }).props.style,
    );
    const newSubjectColorLabelStyle = StyleSheet.flatten(
      getByTestId('stats-new-subject-color-label', { includeHiddenElements: true }).props.style,
    );
    const newSubjectInputStyle = StyleSheet.flatten(
      getByTestId('stats-new-subject-input', { includeHiddenElements: true }).props.style,
    );
    const newSubjectColorPreviewStyle = StyleSheet.flatten(
      getByTestId('stats-new-subject-color', { includeHiddenElements: true }).props.style,
    );
    const newSubjectSaveButtonStyle = StyleSheet.flatten(
      getByTestId('stats-new-subject-save', { includeHiddenElements: true }).props.style,
    );
    expect(getByText('教科を追加', { includeHiddenElements: true })).toBeTruthy();
    expect(newSubjectTitleStyle.top).toBe(9);
    expect(newSubjectTitleStyle.fontWeight).toBe('600');
    expect(newSubjectColorRowStyle.borderBottomWidth).toBe(0);
    expect(newSubjectSubjectLabelStyle.fontSize).toBe(17);
    expect(newSubjectSubjectLabelStyle.lineHeight).toBe(23);
    expect(newSubjectColorLabelStyle.fontSize).toBe(17);
    expect(newSubjectColorLabelStyle.lineHeight).toBe(23);
    expect(newSubjectInputStyle.fontSize).toBe(17);
    expect(newSubjectInputStyle.fontWeight).toBe('400');
    expect(newSubjectInputStyle.lineHeight).toBe(23);
    expect(newSubjectColorPreviewStyle.width).toBe(18);
    expect(newSubjectColorPreviewStyle.height).toBe(18);
    expect(newSubjectColorPreviewStyle.borderRadius).toBe(9);
    expect(newSubjectSaveButtonStyle.height).toBe(56);
    expect(newSubjectSaveButtonStyle.left).toBe(55);
    expect(newSubjectSaveButtonStyle.right).toBe(43);
    expect(newSubjectSaveButtonStyle.borderRadius).toBe(20);
    expect(newSubjectSaveButtonStyle.backgroundColor).toBe('#4B5CFF');
    expect(
      getByTestId('stats-new-subject-input', { includeHiddenElements: true }).props.placeholder,
    ).toBe('新規教科');
    expect(getByText('保存する', { includeHiddenElements: true })).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('stats-new-subject-color-row', { includeHiddenElements: true }));
    });

    expect(getByTestId('stats-new-subject-modal', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('stats-subject-color-picker', { includeHiddenElements: true })).toBeTruthy();
    expect(getByText('色の選択', { includeHiddenElements: true })).toBeTruthy();
    const firstColorRow = getByTestId('stats-subject-color-row-0', {
      includeHiddenElements: true,
    });
    const secondColorRow = getByTestId('stats-subject-color-row-1', {
      includeHiddenElements: true,
    });
    const colorGridStyle = StyleSheet.flatten(
      getByTestId('stats-subject-color-grid', { includeHiddenElements: true }).props.style,
    );
    const colorPickerStyle = StyleSheet.flatten(
      getByTestId('stats-subject-color-picker', { includeHiddenElements: true }).props.style,
    );
    const colorPickerBottomFillStyle = StyleSheet.flatten(
      getByTestId('stats-subject-color-picker-bottom-fill', { includeHiddenElements: true }).props
        .style,
    );
    const colorPickerTitleStyle = StyleSheet.flatten(
      getByTestId('stats-subject-color-picker-title', { includeHiddenElements: true }).props.style,
    );
    const closeButtonStyle = StyleSheet.flatten(
      getByTestId('stats-subject-color-picker-close', { includeHiddenElements: true }).props.style,
    );
    const closeIcon = getByTestId('stats-subject-color-picker-close-icon', {
      includeHiddenElements: true,
    });
    const closeIconLine1 = getByTestId('stats-subject-color-picker-close-icon-line-1', {
      includeHiddenElements: true,
    });
    const closeIconLine2 = getByTestId('stats-subject-color-picker-close-icon-line-2', {
      includeHiddenElements: true,
    });
    const confirmButtonStyle = StyleSheet.flatten(
      getByTestId('stats-subject-color-picker-confirm', { includeHiddenElements: true }).props
        .style,
    );
    const checkIcon = getByTestId('stats-subject-color-picker-check-icon', {
      includeHiddenElements: true,
    });
    const firstColorRowStyle = StyleSheet.flatten(firstColorRow.props.style);
    const secondColorRowStyle = StyleSheet.flatten(secondColorRow.props.style);
    const firstSwatchStyle = StyleSheet.flatten(
      getByTestId('stats-subject-color-swatch-0', { includeHiddenElements: true }).props.style,
    );
    expect(firstColorRow.children).toHaveLength(5);
    expect(secondColorRow.children).toHaveLength(5);
    expect(colorPickerStyle.height).toBe('70%');
    expect(colorPickerStyle.maxHeight).toBe('72%');
    expect(colorPickerStyle.minHeight).toBeUndefined();
    expect(colorPickerStyle.bottom).toBe(40);
    expect(colorPickerBottomFillStyle.height).toBe(40);
    expect(colorPickerBottomFillStyle.backgroundColor).toBe('#FFFFFF');
    expect(colorPickerBottomFillStyle.bottom).toBe(0);
    expect(colorGridStyle.alignItems).toBe('center');
    expect(colorGridStyle.paddingHorizontal).toBe(19);
    expect(colorGridStyle.paddingTop).toBe(42);
    expect(colorGridStyle.gap).toBe(16);
    expect(colorPickerTitleStyle.fontSize).toBe(18);
    expect(colorPickerTitleStyle.fontWeight).toBe('600');
    expect(colorPickerTitleStyle.lineHeight).toBe(24);
    expect(colorPickerTitleStyle.marginTop).toBe(30);
    expect(colorPickerTitleStyle.transform).toEqual([{ translateX: 2 }]);
    expect(closeButtonStyle.left).toBe(20);
    expect(closeButtonStyle.top).toBe(26);
    expect(closeButtonStyle.width).toBe(36);
    expect(closeButtonStyle.height).toBe(36);
    expect(closeIcon.props.width).toBe(18);
    expect(closeIcon.props.height).toBe(18);
    expect(closeIconLine1.props.strokeLinecap).toBe(1);
    expect(closeIconLine2.props.strokeLinecap).toBe(1);
    expect(confirmButtonStyle.right).toBe(20);
    expect(confirmButtonStyle.top).toBe(26);
    expect(confirmButtonStyle.width).toBe(36);
    expect(confirmButtonStyle.height).toBe(36);
    expect(checkIcon.props.width).toBe(20);
    expect(checkIcon.props.height).toBe(20);
    expect(firstColorRowStyle.gap).toBe(14);
    expect(firstColorRowStyle.marginTop).toBeUndefined();
    expect(secondColorRowStyle.gap).toBe(14);
    expect(secondColorRowStyle.marginTop).toBe(6);
    expect(firstSwatchStyle.width).toBe(50);
    expect(firstSwatchStyle.height).toBe(50);
    expect(firstSwatchStyle.borderRadius).toBe(6);
    expect(firstSwatchStyle.alignItems).toBe('center');
    expect(firstSwatchStyle.justifyContent).toBe('center');
    expect(queryByTestId('stats-subject-color-swatch-check-0')).toBeNull();
    expect(queryByTestId('stats-subject-color-swatch-check-1')).toBeNull();
    [
      '#457DFF',
      '#2BAAF3',
      '#00E0C6',
      '#2DDF39',
      '#F7E927',
      '#FF9147',
      '#FF484B',
      '#F84897',
      '#C251E2',
      '#AC6700',
    ].forEach((color, index) => {
      expect(
        StyleSheet.flatten(
          getByTestId(`stats-subject-color-swatch-${index}`, { includeHiddenElements: true }).props
            .style,
        ).backgroundColor,
      ).toBe(color);
    });

    await act(async () => {
      fireEvent.press(getByTestId('stats-subject-color-swatch-1', { includeHiddenElements: true }));
    });
    const selectedSwatchCheck = getByTestId('stats-subject-color-swatch-check-1', {
      includeHiddenElements: true,
    });
    const selectedSwatchCheckStyle = StyleSheet.flatten(
      selectedSwatchCheck.props.style,
    );
    const selectedSwatchCheckPath = getByTestId('stats-subject-color-swatch-check-1-path', {
      includeHiddenElements: true,
    });
    expect(selectedSwatchCheckStyle.width).toBe(24);
    expect(selectedSwatchCheckStyle.height).toBe(19);
    expect(selectedSwatchCheck.props.width).toBe(24);
    expect(selectedSwatchCheck.props.height).toBe(19);
    expect(selectedSwatchCheckPath.props.strokeWidth).toBe(3.2);

    await act(async () => {
      fireEvent.press(getByTestId('stats-subject-color-swatch-5', { includeHiddenElements: true }));
    });
    expect(queryByTestId('stats-subject-color-swatch-check-1')).toBeNull();
    expect(
      getByTestId('stats-subject-color-swatch-check-5-path', { includeHiddenElements: true }).props
        .strokeWidth,
    ).toBe(3.2);
    await act(async () => {
      fireEvent.press(
        getByTestId('stats-subject-color-picker-confirm', { includeHiddenElements: true }),
      );
    });
    expect(
      StyleSheet.flatten(
        getByTestId('stats-new-subject-color', { includeHiddenElements: true }).props.style,
      ).backgroundColor,
    ).toBe('#FF9147');

    await act(async () => {
      fireEvent.changeText(
        getByTestId('stats-new-subject-input', { includeHiddenElements: true }),
        '数学',
      );
    });
    expect(
      StyleSheet.flatten(
        getByTestId('stats-new-subject-color', { includeHiddenElements: true }).props.style,
      ).backgroundColor,
    ).toBe('#FF9147');

    await act(async () => {
      fireEvent.press(getByTestId('stats-new-subject-save', { includeHiddenElements: true }));
    });

    expect(queryByTestId('stats-new-subject-input')).toBeNull();
    expect(getByTestId('stats-history-sheet-subject-picker')).toBeTruthy();
    expect(getAllByText('数学').length).toBeGreaterThan(1);
    expect(
      StyleSheet.flatten(getByTestId('stats-history-sheet-subject-option-dot-0').props.style)
        .backgroundColor,
    ).toBe('#FF9147');
    expect(statsApi.updateOutputSubject).toHaveBeenCalledWith('out-1', {
      label: '数学',
      color: '#FF9147',
    });
    expect(getByTestId('stats-history-sheet-subject-option-check-0')).toBeTruthy();
    expect(getByTestId('stats-history-sheet-subject-text').props.children).toBe('数学');
  });

  it('画像アウトプットの履歴詳細では画像アイコンを黒にする', async () => {
    const baseResponse = makeDailyResponse();
    const baseHistoryItem = baseResponse.output_history[0];
    if (baseHistoryItem === undefined) {
      throw new Error('base history item is missing');
    }

    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(
      makeDailyResponse({
        output_history: [
          {
            ...baseHistoryItem,
            output: {
              ...baseHistoryItem.output,
              kind: 'image',
              content: null,
              image_url: 'https://example.com/output.png',
            },
          },
        ],
      }),
    );

    const { getByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-output-history-item-out-1')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('stats-output-history-item-out-1'));
    });

    expect(getByTestId('stats-history-sheet-tab-icon-text').props.source).toBe(TEXT_MODE_ICON_GRAY);
    expect(getByTestId('stats-history-sheet-tab-icon-image').props.source).toBe(
      IMAGE_MODE_ICON_BLACK,
    );
    expect(getByTestId('stats-history-sheet-output-image')).toBeTruthy();
  });

  it('履歴詳細の出力種別ラベルを太字にする', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(makeDailyResponse());

    const { getByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-output-history-item-out-1')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('stats-output-history-item-out-1'));
    });

    (['text', 'image', 'voice'] as const).forEach((kind) => {
      const labelStyle = StyleSheet.flatten(
        getByTestId(`stats-history-sheet-tab-label-${kind}`).props.style,
      );
      expect(labelStyle.fontFamily).toBe('HiraginoSans-W6');
      expect(labelStyle.fontWeight).toBe('700');
    });
  });

  it('別の日の日付セルをタップするとその日のレポートを取得しタイトルが切り替わる', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockImplementation((date: string) =>
      Promise.resolve(makeDailyResponse({ date })),
    );

    const { getByTestId, getByText } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchDailyReport).toHaveBeenCalledWith('2026-04-29');
    });

    await act(async () => {
      fireEvent.press(getByTestId('week-date-2026-04-27'));
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchDailyReport).toHaveBeenCalledWith('2026-04-27');
    });
    expect(getByText('4月27日のハイライト')).toBeTruthy();
  });

  it('右矢印押下で同曜日に追従して翌週の日次レポートを取得する', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockImplementation((date: string) =>
      Promise.resolve(makeDailyResponse({ date })),
    );

    const { getByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchDailyReport).toHaveBeenCalledWith('2026-04-29');
    });

    await act(async () => {
      fireEvent.press(getByTestId('week-date-next'));
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchDailyReport).toHaveBeenCalledWith('2026-05-06');
    });
  });

  it('画面上部カレンダーで学習済み日を薄い青にする', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(makeDailyResponse());
    (statsApi.fetchWeeklyReport as jest.Mock).mockImplementation((weekStart: string) =>
      Promise.resolve(makeWeeklyResponseForDates(weekStart, { '2026-04-28': 30 })),
    );

    const { getByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchWeeklyReport).toHaveBeenCalledWith('2026-04-26');
    });
    await waitFor(() => {
      expect(getByTestId('week-date-2026-04-28-studied-background')).toBeTruthy();
    });

    const studiedBackgroundStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-04-28-studied-background').props.style,
    );
    expect(studiedBackgroundStyle.backgroundColor).toBe('#DBE3FF');
  });

  it('カレンダーアイコン押下で月間カレンダーと今月のハイライトを表示する', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(makeDailyResponse());
    const studiedMinutesByDate = {
      '2026-04-05': 30,
      '2026-04-08': 20,
      '2026-04-09': 25,
      '2026-04-12': 50,
      '2026-04-13': 40,
    };
    (statsApi.fetchWeeklyReport as jest.Mock).mockImplementation((weekStart: string) =>
      Promise.resolve(makeWeeklyResponseForDates(weekStart, studiedMinutesByDate)),
    );

    const { getByTestId, getByText } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchDailyReport).toHaveBeenCalledWith('2026-04-29');
    });

    await act(async () => {
      fireEvent.press(getByTestId('stats-calendar-toggle'));
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-month-calendar')).toBeTruthy();
    });
    const monthCalendarRootStyle = StyleSheet.flatten(
      getByTestId('stats-month-calendar').props.style,
    );
    const monthCalendarGridStyle = StyleSheet.flatten(
      getByTestId('month-calendar-grid').props.style,
    );
    const monthDayStyle = StyleSheet.flatten(
      getByTestId('month-day-2026-04-05-single').props.style,
    );
    const calendarWeekdayTextStyle = StyleSheet.flatten(
      getByTestId('month-weekday-日').props.style,
    );
    const studiedMonthDayTextStyle = StyleSheet.flatten(
      getByTestId('month-day-2026-04-05-text').props.style,
    );
    const futureMonthDayTextStyle = StyleSheet.flatten(
      getByTestId('month-day-2026-04-30-text').props.style,
    );
    expect(monthCalendarRootStyle.width).toBe('100%');
    expect(monthCalendarGridStyle.width).toBe('100%');
    expect(monthDayStyle.flex).toBe(1);
    expect(monthDayStyle.width).toBeUndefined();
    expect(calendarWeekdayTextStyle.fontFamily).toBe('HiraginoSans-W6');
    expect(calendarWeekdayTextStyle.color).toBe('#333333');
    expect(studiedMonthDayTextStyle.fontFamily).toBe('HiraginoSans-W6');
    expect(studiedMonthDayTextStyle.color).toBe('#5367FF');
    expect(futureMonthDayTextStyle.color).toBe('#CFCFCF');
    expect(getByTestId('month-day-2026-04-05-single')).toBeTruthy();
    expect(getByTestId('month-day-2026-04-08-streak')).toBeTruthy();
    expect(getByTestId('month-day-2026-04-09-streak')).toBeTruthy();
    expect(getByTestId('month-day-2026-04-12-streak')).toBeTruthy();
    expect(getByTestId('month-day-2026-04-13-streak')).toBeTruthy();
    expect(getByTestId('monthly-highlight-card')).toBeTruthy();
    expect(getByText('今月のハイライト')).toBeTruthy();
    expect(getByText('合計日数')).toBeTruthy();
    expect(getByText('最高連続日数')).toBeTruthy();
  });

  it('月間カレンダーの日付セルをタップするとその日の日別サマリーに戻る', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockImplementation((date: string) =>
      Promise.resolve(makeDailyResponse({ date })),
    );
    (statsApi.fetchWeeklyReport as jest.Mock).mockImplementation((weekStart: string) =>
      Promise.resolve(
        makeWeeklyResponseForDates(weekStart, {
          '2026-04-12': 50,
        }),
      ),
    );

    const { getByTestId, getByText, queryByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await act(async () => {
      fireEvent.press(getByTestId('stats-calendar-toggle'));
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('month-day-2026-04-12-single')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('month-day-2026-04-12-single'));
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchDailyReport).toHaveBeenCalledWith('2026-04-12');
    });
    expect(queryByTestId('stats-monthly-content')).toBeNull();
    expect(getByText('4月12日のハイライト')).toBeTruthy();
  });

  it('取得失敗時は error メッセージと retry ボタンが表示される', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockRejectedValue(
      new ApiError(500, {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: '一時的な障害です',
      }),
    );

    const { getByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-error-message').props.children).toBe('一時的な障害です');
    });
    expect(getByTestId('stats-retry')).toBeTruthy();
  });

  it('選択中の日をもう一度タップすると週別カレンダーに切り替わり週次レポートを取得する', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(makeDailyResponse());
    (statsApi.fetchWeeklyReport as jest.Mock).mockResolvedValue(
      makeWeeklyResponseForDates('2026-04-26', { '2026-04-29': 60 }),
    );

    const { getByTestId, queryByTestId, queryByText } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchDailyReport).toHaveBeenCalledWith('2026-04-29');
    });

    await act(async () => {
      fireEvent.press(getByTestId('week-date-2026-04-29'));
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchWeeklyReport).toHaveBeenCalledWith('2026-04-26');
    });
    expect(getByTestId('stats-weekly-chart')).toBeTruthy();
    expect(getByTestId('stats-weekly-calendar-graph-boundary')).toBeTruthy();
    expect(getByTestId('stats-weekly-content').type).toBe('View');
    expect(getByTestId('stats-output-history-table-scroll').type).toBe('RCTScrollView');
    expect(getByTestId('stats-output-history-table-scroll').props.nestedScrollEnabled).toBe(true);
    expect(StyleSheet.flatten(getByTestId('stats-weekly-content').props.style)).toMatchObject({
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
    });
    const selectedDateBackgroundStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-04-29-studied-background').props.style,
    );
    expect(queryByTestId('week-date-2026-04-29-selected-background')).toBeNull();
    expect(selectedDateBackgroundStyle.borderColor).toBeUndefined();
    expect(selectedDateBackgroundStyle.borderWidth).toBeUndefined();
    const weeklyHistoryTitleStyle = StyleSheet.flatten(
      getByTestId('stats-output-history-title').props.style,
    );
    const weeklyHistoryCardStyle = StyleSheet.flatten(
      getByTestId('stats-output-history-empty').parent?.parent?.props.style,
    );
    expect(weeklyHistoryTitleStyle.alignSelf).toBe('center');
    expect(weeklyHistoryTitleStyle.marginLeft).toBe(0);
    expect(typeof weeklyHistoryTitleStyle.width).toBe('number');
    expect(weeklyHistoryCardStyle.alignSelf).toBe('center');
    expect(weeklyHistoryCardStyle.marginLeft).toBe(0);
    expect(weeklyHistoryCardStyle.width).toBe(weeklyHistoryTitleStyle.width);
    expect(
      hasTestIdAncestor(
        getByTestId('stats-output-history-title'),
        'stats-output-history-table-scroll',
      ),
    ).toBe(true);
    expect(queryByTestId('stats-weekly-highlight-card')).toBeNull();
    expect(queryByText('今週のハイライト')).toBeNull();
    expect(queryByText('4月29日のハイライト')).toBeNull();
  });

  it('週別グラフは画面上部カレンダーの日付順に合わせて描画する', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockImplementation((date: string) =>
      Promise.resolve(makeDailyResponse({ date })),
    );
    (statsApi.fetchWeeklyReport as jest.Mock).mockResolvedValue(
      makeWeeklyResponseForDates('2026-04-26', { '2026-04-28': 60 }),
    );

    const { getByTestId, queryByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await act(async () => {
      fireEvent.press(getByTestId('week-date-2026-04-28'));
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchDailyReport).toHaveBeenCalledWith('2026-04-28');
    });

    await act(async () => {
      fireEvent.press(getByTestId('week-date-2026-04-28'));
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-weekly-chart-bar-2026-04-25')).toBeTruthy();
    });
    expect(getByTestId('stats-weekly-chart-bar-2026-04-28').props.height).toBeGreaterThan(0);
    expect(queryByTestId('stats-weekly-chart-bar-2026-05-02')).toBeNull();
  });

  it('週別グラフは履歴詳細で選択した教科の色を反映する', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(
      makeDailyResponse({
        output_history: [],
      }),
    );
    (statsApi.fetchWeeklyReport as jest.Mock).mockResolvedValue({
      ...makeWeeklyResponseForDates('2026-04-26', { '2026-04-29': 70 }),
      output_history: [
        {
          ...makeOutputHistoryItem(1),
          subject: '理科',
        },
        {
          ...makeOutputHistoryItem(2),
          input_minutes: 30,
          output_minutes: 15,
          subject: '現代文',
        },
      ],
    });

    const { getByTestId, queryByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await act(async () => {
      fireEvent.press(getByTestId('week-date-2026-04-29'));
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-weekly-chart-bar-segment-2026-04-29-out-2')).toBeTruthy();
    });
    const totalBarHeight = getByTestId('stats-weekly-chart-bar-2026-04-29').props.height;
    const secondSegment = getByTestId('stats-weekly-chart-bar-segment-2026-04-29-out-2');
    expect(getByTestId('stats-weekly-chart-bar-2026-04-29').props.fill.payload).toBe(
      processColor('#D6D6D6'),
    );
    expect(getByTestId('stats-weekly-chart-bar-segment-2026-04-29-out-1').props.fill.payload).toBe(
      processColor('#457DFF'),
    );
    expect(secondSegment.props.fill.payload).toBe(processColor('#2BAAF3'));
    expect(secondSegment.props.clipPath).toBe('weekly-chart-bar-clip-2026-04-29');
    expect(secondSegment.props.height / totalBarHeight).toBeCloseTo(45 / 70, 5);

    await act(async () => {
      fireEvent.press(getByTestId('stats-output-history-item-out-2'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-subject-row'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-subject-option-0'));
    });

    expect(queryByTestId('stats-history-sheet-subject-picker')).toBeNull();
    expect(getByTestId('stats-history-sheet-subject-text').props.children).toBe('理科');
    await waitFor(() => {
      expect(
        getByTestId('stats-weekly-chart-bar-segment-2026-04-29-out-2').props.fill.payload,
      ).toBe(processColor('#457DFF'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-confirm'));
    });
    expect(queryByTestId('stats-history-sheet')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('stats-output-history-item-out-2'));
    });
    expect(getByTestId('stats-history-sheet-subject-text').props.children).toBe('理科');

    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-subject-row'));
    });
    expect(getByTestId('stats-history-sheet-subject-option-check-0')).toBeTruthy();
    expect(queryByTestId('stats-history-sheet-subject-option-check-1')).toBeNull();
    expect(getByTestId('stats-weekly-chart-bar-segment-2026-04-29-out-2').props.fill.payload).toBe(
      processColor('#457DFF'),
    );
  });

  it('週別グラフは新規追加して保存した教科の色を反映する', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(
      makeDailyResponse({
        output_history: [],
      }),
    );
    (statsApi.fetchWeeklyReport as jest.Mock).mockResolvedValue({
      ...makeWeeklyResponseForDates('2026-04-26', { '2026-04-29': 70 }),
      output_history: [
        {
          ...makeOutputHistoryItem(1),
          subject: '未設定',
        },
        {
          ...makeOutputHistoryItem(2),
          input_minutes: 30,
          output_minutes: 15,
          subject: '未設定',
        },
      ],
    });

    const { getByTestId, queryByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await act(async () => {
      fireEvent.press(getByTestId('week-date-2026-04-29'));
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-weekly-chart-bar-2026-04-29')).toBeTruthy();
    });
    expect(queryByTestId('stats-weekly-chart-bar-segment-2026-04-29-out-1')).toBeNull();
    expect(queryByTestId('stats-weekly-chart-bar-segment-2026-04-29-out-2')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('stats-output-history-item-out-2'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-subject-row'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-subject-picker-new'));
    });
    await act(async () => {
      fireEvent.changeText(
        getByTestId('stats-new-subject-input', { includeHiddenElements: true }),
        '強化',
      );
    });
    await act(async () => {
      fireEvent.press(getByTestId('stats-new-subject-color-row', { includeHiddenElements: true }));
    });
    await act(async () => {
      fireEvent.press(getByTestId('stats-subject-color-swatch-5', { includeHiddenElements: true }));
    });
    await act(async () => {
      fireEvent.press(
        getByTestId('stats-subject-color-picker-confirm', { includeHiddenElements: true }),
      );
    });
    await act(async () => {
      fireEvent.press(getByTestId('stats-new-subject-save', { includeHiddenElements: true }));
    });

    expect(queryByTestId('stats-new-subject-input')).toBeNull();
    const totalBar = getByTestId('stats-weekly-chart-bar-2026-04-29');
    const selectedSegment = getByTestId('stats-weekly-chart-bar-segment-2026-04-29-out-2');
    expect(getByTestId('stats-history-sheet-subject-text').props.children).toBe('強化');
    expect(getByTestId('stats-history-sheet-subject-option-check-0')).toBeTruthy();
    await waitFor(() => {
      expect(
        getByTestId('stats-weekly-chart-bar-segment-2026-04-29-out-2').props.fill.payload,
      ).toBe(processColor('#FF9147'));
    });
    expect(selectedSegment.props.height / totalBar.props.height).toBeCloseTo(45 / 70, 5);
    expect(selectedSegment.props.y).toBeCloseTo(totalBar.props.y, 5);
    expect(queryByTestId('stats-weekly-chart-bar-segment-2026-04-29-out-1')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-confirm'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('stats-output-history-item-out-2'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-subject-row'));
    });
    expect(getByTestId('stats-history-sheet-subject-option-check-0')).toBeTruthy();
    expect(getByTestId('stats-weekly-chart-bar-segment-2026-04-29-out-2').props.fill.payload).toBe(
      processColor('#FF9147'),
    );
  });

  it('週別カレンダー中に別の日付セルをタップすると日別カレンダーに戻る', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockImplementation((date: string) =>
      Promise.resolve(makeDailyResponse({ date })),
    );
    (statsApi.fetchWeeklyReport as jest.Mock).mockResolvedValue(
      makeWeeklyResponseForDates('2026-04-26', {}),
    );

    const { getByTestId, getByText } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await act(async () => {
      fireEvent.press(getByTestId('week-date-2026-04-29'));
    });
    await flushAsyncUpdates();
    await waitFor(() => {
      expect(getByTestId('stats-weekly-chart')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('week-date-2026-04-27'));
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchDailyReport).toHaveBeenCalledWith('2026-04-27');
    });
    expect(getByText('4月27日のハイライト')).toBeTruthy();
  });

  it('選択日の履歴が空の場合は empty メッセージが表示される', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(
      makeDailyResponse({
        summary: {
          input_minutes: 0,
          output_minutes: 0,
          break_minutes: 0,
          total_study_minutes: 0,
          total_sessions: 0,
        },
        output_history: [],
      }),
    );

    const { getByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-output-history-empty')).toBeTruthy();
    });
    const sessionBadgeRow = getByTestId('stats-session-badge').props.children;
    const sessionBadgeChildren = sessionBadgeRow.props.children;
    expect(sessionBadgeChildren[0].props.children.props.children).toBe('×');
    expect(sessionBadgeChildren[1].props.children).toBe(0);
  });
});
