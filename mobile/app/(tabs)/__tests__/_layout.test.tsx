import { act, fireEvent, render } from '@testing-library/react-native';

import { useTimerStore, type TimerPhase } from '@/shared/stores/timerStore';

import TabsLayout, { isReportTabNavigationBlocked } from '../_layout';

type TabPressEvent = {
  preventDefault: jest.Mock;
};

type MockScreenProps = {
  name?: string;
  listeners?: {
    tabPress?: (event: TabPressEvent) => void;
  };
};

const mockTabScreens: MockScreenProps[] = [];

jest.mock('expo-router', () => {
  const React = require('react');
  const Tabs = ({ children }: { children: unknown }) =>
    React.createElement(React.Fragment, null, children);

  function Screen(props: unknown) {
    mockTabScreens.push(props as MockScreenProps);
    return null;
  }

  Tabs.Screen = Screen;

  return { Tabs };
});

function renderStatsTabScreen() {
  const result = render(<TabsLayout />);
  const statsTab = mockTabScreens.find((screen) => screen.name === 'stats');
  if (!statsTab) {
    throw new Error('stats tab is not registered');
  }
  return { ...result, statsTab };
}

describe('TabsLayout', () => {
  beforeEach(() => {
    mockTabScreens.length = 0;
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
});
