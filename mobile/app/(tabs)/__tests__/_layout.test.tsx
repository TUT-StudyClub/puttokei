import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { useTimerStore, type TimerPhase } from '@/shared/stores/timerStore';

import TabsLayout, { isReportTabNavigationBlocked, isTimerTabIconHighlighted } from '../_layout';

type TabPressEvent = {
  preventDefault: jest.Mock;
};

type MockScreenProps = {
  name?: string;
  options?: {
    tabBarLabel?: (props: { color: string }) => unknown;
    tabBarIcon?: (props: { color: string }) => unknown;
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
    [['(tabs)'], true],
    [['(tabs)', 'index'], true],
    [['(tabs)', 'session', '[id]', 'input'], true],
    [['(tabs)', 'session', '[id]', 'output'], true],
    [['(tabs)', 'session', '[id]', 'break'], true],
    [['(tabs)', 'session', '[id]', 'result'], false],
    [['(tabs)', 'stats'], false],
  ] as const)('isTimerTabIconHighlighted(%j) は %s を返す', (segments, expected) => {
    expect(isTimerTabIconHighlighted(segments)).toBe(expected);
  });

  it.each([
    ['ホーム', ['(tabs)']],
    ['インプット', ['(tabs)', 'session', '[id]', 'input']],
    ['アウトプット', ['(tabs)', 'session', '[id]', 'output']],
    ['休憩', ['(tabs)', 'session', '[id]', 'break']],
  ] as const)('%s画面ではタイマーアイコンとラベルを青にする', (_screen, segments) => {
    mockSegments = [...segments];
    const { timerTab } = renderTimerTabScreen();

    const icon = timerTab.options?.tabBarIcon?.({ color: '#9CA3AF' });
    const label = timerTab.options?.tabBarLabel?.({ color: '#9CA3AF' });

    expect((icon as { props?: { color?: string } }).props?.color).toBe('#4B5CFF');
    expect((label as { props?: { style?: { color?: string } } }).props?.style?.color).toBe(
      '#475FFF',
    );
  });

  it('レポートタブの文字色はナビゲーションから渡された色を使う', () => {
    const { statsTab } = renderStatsTabScreen();

    const label = statsTab.options?.tabBarLabel?.({ color: '#4B5CFF' });
    const labelStyle = StyleSheet.flatten((label as { props?: { style?: unknown } }).props?.style);

    expect(labelStyle).toMatchObject({
      color: '#676767',
      fontSize: 11,
      fontFamily: 'HiraginoSans-W6',
    });
  });
});
