import { act, fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Image, StyleSheet } from 'react-native';

import { useTimerStore, type TimerPhase } from '@/shared/stores/timerStore';

import TabsLayout, { isReportTabNavigationBlocked, isTimerTabIconHighlighted } from '../_layout';

const TIMER_ICON_BLUE = require('../../../assets/images/icons/icon_timer_blue.png');
const TIMER_ICON_GRAY = require('../../../assets/images/icons/icon_timer_gray.png');
const REPORT_ICON_BLUE = require('../../../assets/images/icons/icon_report_blue.png');
const REPORT_ICON_GRAY = require('../../../assets/images/icons/icon_report_gray.png');

type TabPressEvent = {
  preventDefault: jest.Mock;
};

type MockScreenProps = {
  name?: string;
  options?: {
    tabBarLabel?: (props: { color: string; focused: boolean }) => unknown;
    tabBarIcon?: (props: { color: string; focused: boolean }) => unknown;
  };
  listeners?: {
    tabPress?: (event: TabPressEvent) => void;
  };
};

const mockTabScreens: MockScreenProps[] = [];
let mockSegments: string[] = ['(tabs)'];

jest.mock('expo-router', () => {
  const React = require('react');
  const Tabs = ({ children }: { children: unknown }) =>
    React.createElement(React.Fragment, null, children);

  function Screen(props: unknown) {
    mockTabScreens.push(props as MockScreenProps);
    return null;
  }

  Tabs.Screen = Screen;

  return {
    Tabs,
    useSegments: () => mockSegments,
  };
});

function renderStatsTabScreen() {
  const result = render(<TabsLayout />);
  const statsTab = mockTabScreens.find((screen) => screen.name === 'stats');
  if (!statsTab) {
    throw new Error('stats tab is not registered');
  }
  return { ...result, statsTab };
}

function renderTimerTabScreen() {
  const result = render(<TabsLayout />);
  const timerTab = mockTabScreens.find((screen) => screen.name === 'index');
  if (!timerTab) {
    throw new Error('timer tab is not registered');
  }
  return { ...result, timerTab };
}

function renderMainTabScreens() {
  const result = render(<TabsLayout />);
  const timerTab = mockTabScreens.find((screen) => screen.name === 'index');
  const statsTab = mockTabScreens.find((screen) => screen.name === 'stats');
  if (!timerTab || !statsTab) {
    throw new Error('main tabs are not registered');
  }
  return { ...result, timerTab, statsTab };
}

function getRenderedImageProps(element: unknown) {
  const { UNSAFE_getByType, unmount } = render(element as ReactElement);
  const imageProps = UNSAFE_getByType(Image).props as { source?: unknown; style?: unknown };
  unmount();
  return imageProps;
}

describe('TabsLayout', () => {
  beforeEach(() => {
    mockTabScreens.length = 0;
    mockSegments = ['(tabs)'];
    useTimerStore.setState({
      phase: 'idle',
      status: 'idle',
      totalSeconds: 0,
      remainingSeconds: 0,
      completionToken: 0,
    });
  });

  it.each<TimerPhase>(['input', 'output', 'break'])(
    '%s フェーズ中はレポートタブ押下で閲覧不可ダイアログを表示する',
    (phase) => {
      useTimerStore.setState({ phase });
      const { getByTestId, getByText, statsTab } = renderStatsTabScreen();
      const event = { preventDefault: jest.fn() };

      act(() => {
        statsTab.listeners?.tabPress?.(event);
      });

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(getByTestId('report-blocked-dialog').props.visible).toBe(true);
      expect(getByText('タイマー起動中はレポート機能を見ることができ')).toBeTruthy();
      expect(getByText('ません。休憩終了後に見ることができます。')).toBeTruthy();
    },
  );

  it('閲覧不可ダイアログではタイマー状態を維持する', () => {
    useTimerStore.setState({
      phase: 'input',
      status: 'running',
      totalSeconds: 1200,
      remainingSeconds: 600,
    });
    const { statsTab } = renderStatsTabScreen();

    act(() => {
      statsTab.listeners?.tabPress?.({ preventDefault: jest.fn() });
    });

    expect(useTimerStore.getState()).toMatchObject({
      phase: 'input',
      status: 'running',
      totalSeconds: 1200,
      remainingSeconds: 600,
    });
  });

  it('閲覧不可ダイアログの OK 押下でダイアログを閉じる', () => {
    useTimerStore.setState({ phase: 'input' });
    const { getByTestId, queryByTestId, statsTab } = renderStatsTabScreen();

    act(() => {
      statsTab.listeners?.tabPress?.({ preventDefault: jest.fn() });
    });
    fireEvent.press(getByTestId('report-blocked-dialog-ok'));

    expect(queryByTestId('report-blocked-dialog')).toBeNull();
  });

  it('idle 中はレポートタブへ遷移できる', () => {
    const { queryByTestId, statsTab } = renderStatsTabScreen();
    const event = { preventDefault: jest.fn() };

    statsTab.listeners?.tabPress?.(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(queryByTestId('report-blocked-dialog')).toBeNull();
  });

  it.each([
    ['idle', false],
    ['input', true],
    ['output', true],
    ['break', true],
  ] as const)('isReportTabNavigationBlocked(%s) は %s を返す', (phase, expected) => {
    expect(isReportTabNavigationBlocked(phase)).toBe(expected);
  });

  it.each([
    [['(tabs)'], true, 'idle', true],
    [['(tabs)'], false, 'idle', false],
    [['(tabs)'], false, 'input', true],
    [['(tabs)'], false, 'output', true],
    [['(tabs)'], false, 'break', true],
    [['(tabs)', 'index'], true, 'idle', true],
    [['(tabs)', 'session', '[id]', 'input'], false, 'idle', true],
    [['(tabs)', 'session', '[id]', 'output'], false, 'idle', true],
    [['(tabs)', 'session', '[id]', 'break'], false, 'idle', true],
    [['(tabs)', 'session', '[id]', 'result'], false, 'idle', false],
    [['(tabs)', 'stats'], false, 'idle', false],
  ] as const)(
    'isTimerTabIconHighlighted(%j, focused: %s, phase: %s) は %s を返す',
    (segments, focused, phase, expected) => {
      expect(isTimerTabIconHighlighted(segments, focused, phase)).toBe(expected);
    },
  );

  it('タイマータブが非フォーカスなら segments が root でもタイマーアイコンをグレーにする', () => {
    mockSegments = ['(tabs)'];
    const { timerTab } = renderTimerTabScreen();

    const timerIcon = timerTab.options?.tabBarIcon?.({ color: '#9CA3AF', focused: false });

    expect(getRenderedImageProps(timerIcon).source).toBe(TIMER_ICON_GRAY);
  });

  it.each<TimerPhase>(['input', 'output', 'break'])(
    '%s フェーズ中はルートセグメントが未更新でもタイマーアイコンを青にする',
    (phase) => {
      mockSegments = ['(tabs)'];
      useTimerStore.setState({ phase });
      const { timerTab } = renderTimerTabScreen();

      const timerIcon = timerTab.options?.tabBarIcon?.({ color: '#9CA3AF', focused: false });

      expect(getRenderedImageProps(timerIcon).source).toBe(TIMER_ICON_BLUE);
    },
  );

  it.each([
    ['ホーム', ['(tabs)']],
    ['インプット', ['(tabs)', 'session', '[id]', 'input']],
    ['アウトプット', ['(tabs)', 'session', '[id]', 'output']],
    ['休憩', ['(tabs)', 'session', '[id]', 'break']],
  ] as const)('%s画面ではタイマーアイコンとラベルを青にする', (_screen, segments) => {
    mockSegments = [...segments];
    const { timerTab } = renderTimerTabScreen();
    const isHomeScreen = segments.length === 1;

    const icon = timerTab.options?.tabBarIcon?.({ color: '#9CA3AF', focused: isHomeScreen });
    const label = timerTab.options?.tabBarLabel?.({ color: '#9CA3AF', focused: isHomeScreen });
    const iconProps = getRenderedImageProps(icon);
    const iconStyle = StyleSheet.flatten(iconProps.style);

    expect(iconProps.source).toBe(TIMER_ICON_BLUE);
    expect(iconStyle).toMatchObject({ width: 39, height: 39 });
    expect((label as { props?: { style?: { color?: string } } }).props?.style?.color).toBe(
      '#4B5CFF',
    );
  });

  it('タイマー画面ではタイマーアイコンを青、レポートアイコンをグレーにする', () => {
    mockSegments = ['(tabs)', 'index'];
    const { timerTab, statsTab } = renderMainTabScreens();

    const timerIcon = timerTab.options?.tabBarIcon?.({ color: '#9CA3AF', focused: true });
    const reportIcon = statsTab.options?.tabBarIcon?.({ color: '#9CA3AF', focused: false });

    expect(getRenderedImageProps(timerIcon).source).toBe(TIMER_ICON_BLUE);
    expect(getRenderedImageProps(reportIcon).source).toBe(REPORT_ICON_GRAY);
  });

  it('レポート画面ではタイマーアイコンをグレー、レポートアイコンを青にする', () => {
    mockSegments = ['(tabs)', 'stats'];
    const { timerTab, statsTab } = renderMainTabScreens();

    const timerIcon = timerTab.options?.tabBarIcon?.({ color: '#9CA3AF', focused: false });
    const reportIcon = statsTab.options?.tabBarIcon?.({ color: '#4B5CFF', focused: true });

    expect(getRenderedImageProps(timerIcon).source).toBe(TIMER_ICON_GRAY);
    expect(getRenderedImageProps(reportIcon).source).toBe(REPORT_ICON_BLUE);
  });

  it('レポートタブの文字色はナビゲーションから渡された色を使う', () => {
    const { statsTab } = renderStatsTabScreen();

    const label = statsTab.options?.tabBarLabel?.({ color: '#4B5CFF', focused: true });
    const labelStyle = StyleSheet.flatten((label as { props?: { style?: unknown } }).props?.style);

    expect(labelStyle).toMatchObject({
      color: '#4B5CFF',
      fontSize: 12,
      fontWeight: '700',
    });
  });
});
