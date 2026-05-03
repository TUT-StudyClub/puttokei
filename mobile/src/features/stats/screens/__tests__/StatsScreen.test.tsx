/**
 * StatsScreen の日単位レポート表示を検証する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { processColor, StyleSheet } from 'react-native';
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
const COLOR_PICKER_CHECK_ICON = require('../../../../../assets/images/icons/check.png');

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: unknown }) => {
    const { Text } = require('react-native');
    return <Text testID="stats-redirect">{JSON.stringify(href)}</Text>;
  },
  useRouter: () => ({
    push: jest.fn(),
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

describe('StatsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-29T00:00:00Z'));
    act(() => {
      useAuthStore.setState({ uid: 'u-1', idToken: 'token-1' });
    });
  });

  afterEach(() => {
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null });
    });
    jest.useRealTimers();
  });

  it('未認証の場合はサインインへ遷移し、レポートを取得しない', () => {
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null });
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
    expect(getByTestId('stats-session-badge').props.children.props.children).toEqual(['×', 5]);
    expect(getByTestId('stats-output-history-title').props.children).toBe('履歴');
    expect(getByTestId('stats-output-history-item-out-1')).toBeTruthy();
    expect(getByText('4月29日')).toBeTruthy();
    expect(getByText('09：35')).toBeTruthy();
    expect(getByText('10：00')).toBeTruthy();
    expect(getByText('サイクル1')).toBeTruthy();
    expect(getByText('今日のハイライト')).toBeTruthy();
    expect(queryByText('教科')).toBeNull();
  });

  it('履歴カードは3サイクル分で枠を閉じる', async () => {
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
    expect(queryByTestId('stats-output-history-item-out-1')).toBeNull();
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
    expect(getByText('4月29日　09：35 - 10：00')).toBeTruthy();
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

    expect(getByTestId('stats-history-sheet-subject-text').props.children).toBe('未設定');
    expect(subjectDotStyle.backgroundColor).toBe('#D0D0D0');
    expect(subjectTextStyle.color).toBe('#777777');

    await act(async () => {
      fireEvent.press(getByTestId('stats-history-sheet-subject-row'));
    });

    expect(getByTestId('stats-history-sheet-subject-picker')).toBeTruthy();
    expect(getByText('新規教科')).toBeTruthy();
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
    ).toBe(122);
    expect(getByText('新規教科')).toBeTruthy();
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

    const { getByTestId, getByText, queryByTestId } = renderWithProviders(<StatsScreen />);
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
    expect(getByText('新規教科追加', { includeHiddenElements: true })).toBeTruthy();
    expect(newSubjectTitleStyle.fontWeight).toBe('800');
    expect(newSubjectColorRowStyle.borderBottomWidth).toBe(0);
    expect(newSubjectSubjectLabelStyle.fontSize).toBe(16);
    expect(newSubjectSubjectLabelStyle.lineHeight).toBe(22);
    expect(newSubjectColorLabelStyle.fontSize).toBe(16);
    expect(newSubjectColorLabelStyle.lineHeight).toBe(22);
    expect(newSubjectInputStyle.fontSize).toBe(16);
    expect(newSubjectInputStyle.fontWeight).toBe('500');
    expect(newSubjectColorPreviewStyle.width).toBe(14);
    expect(newSubjectColorPreviewStyle.height).toBe(14);
    expect(newSubjectColorPreviewStyle.borderRadius).toBe(7);
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
    const colorPickerTitleStyle = StyleSheet.flatten(
      getByTestId('stats-subject-color-picker-title', { includeHiddenElements: true }).props.style,
    );
    const closeButtonStyle = StyleSheet.flatten(
      getByTestId('stats-subject-color-picker-close', { includeHiddenElements: true }).props.style,
    );
    const closeTextStyle = StyleSheet.flatten(
      getByTestId('stats-subject-color-picker-close-text', { includeHiddenElements: true }).props
        .style,
    );
    const confirmButtonStyle = StyleSheet.flatten(
      getByTestId('stats-subject-color-picker-confirm', { includeHiddenElements: true }).props
        .style,
    );
    const checkIcon = getByTestId('stats-subject-color-picker-check-icon', {
      includeHiddenElements: true,
    });
    const firstColorRowStyle = StyleSheet.flatten(firstColorRow.props.style);
    const firstSwatchStyle = StyleSheet.flatten(
      getByTestId('stats-subject-color-swatch-0', { includeHiddenElements: true }).props.style,
    );
    expect(firstColorRow.children).toHaveLength(5);
    expect(secondColorRow.children).toHaveLength(5);
    expect(colorGridStyle.alignItems).toBe('center');
    expect(colorGridStyle.paddingHorizontal).toBe(19);
    expect(colorGridStyle.paddingTop).toBe(22);
    expect(colorGridStyle.gap).toBe(16);
    expect(colorPickerTitleStyle.fontWeight).toBe('800');
    expect(colorPickerTitleStyle.marginTop).toBe(7);
    expect(closeButtonStyle.left).toBe(20);
    expect(closeButtonStyle.top).toBe(18);
    expect(closeButtonStyle.width).toBe(36);
    expect(closeButtonStyle.height).toBe(36);
    expect(closeTextStyle.fontSize).toBe(26);
    expect(confirmButtonStyle.right).toBe(20);
    expect(confirmButtonStyle.top).toBe(18);
    expect(confirmButtonStyle.width).toBe(36);
    expect(confirmButtonStyle.height).toBe(36);
    expect(checkIcon.props.width).toBe(20);
    expect(checkIcon.props.height).toBe(20);
    expect(firstColorRowStyle.gap).toBe(14);
    expect(firstSwatchStyle.width).toBe(50);
    expect(firstSwatchStyle.height).toBe(50);
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
    const selectedSwatchCheckStyle = StyleSheet.flatten(
      getByTestId('stats-subject-color-swatch-check-1', { includeHiddenElements: true }).props
        .style,
    );
    expect(
      getByTestId('stats-subject-color-swatch-check-1', { includeHiddenElements: true }).props
        .source,
    ).toBe(COLOR_PICKER_CHECK_ICON);
    expect(selectedSwatchCheckStyle.width).toBe(24);
    expect(selectedSwatchCheckStyle.height).toBe(19);

    await act(async () => {
      fireEvent.press(getByTestId('stats-subject-color-swatch-5', { includeHiddenElements: true }));
    });
    expect(queryByTestId('stats-subject-color-swatch-check-1')).toBeNull();
    expect(
      getByTestId('stats-subject-color-swatch-check-5', { includeHiddenElements: true }).props
        .source,
    ).toBe(COLOR_PICKER_CHECK_ICON);
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
    expect(getByText('数学')).toBeTruthy();
    expect(
      StyleSheet.flatten(getByTestId('stats-history-sheet-subject-option-dot-1').props.style)
        .backgroundColor,
    ).toBe('#FF9147');
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
    expect(queryByTestId('stats-weekly-highlight-card')).toBeNull();
    expect(queryByText('今週のハイライト')).toBeNull();
    expect(queryByText('4月29日のハイライト')).toBeNull();
  });

  it('週別グラフは履歴詳細で選択した教科の色を反映する', async () => {
    (statsApi.fetchDailyReport as jest.Mock).mockResolvedValue(
      makeDailyResponse({
        output_history: [],
      }),
    );
    (statsApi.fetchWeeklyReport as jest.Mock).mockResolvedValue({
      ...makeWeeklyResponseForDates('2026-04-26', { '2026-04-29': 60 }),
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
    expect(getByTestId('stats-weekly-chart-bar-2026-04-29').props.fill.payload).toBe(
      processColor('#2BAAF3'),
    );

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
      expect(getByTestId('stats-weekly-chart-bar-2026-04-29').props.fill.payload).toBe(
        processColor('#457DFF'),
      );
    });
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
    expect(getByTestId('stats-session-badge').props.children.props.children).toEqual(['×', 0]);
  });
});
