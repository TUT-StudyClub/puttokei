import { render } from '@testing-library/react-native';

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
  render(<TabsLayout />);
  const statsTab = mockTabScreens.find((screen) => screen.name === 'stats');
  if (!statsTab) {
    throw new Error('stats tab is not registered');
  }
  return statsTab;
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
    '%s フェーズ中はレポートタブ押下を抑止する',
    (phase) => {
      useTimerStore.setState({ phase });
      const statsTab = renderStatsTabScreen();
      const event = { preventDefault: jest.fn() };

      statsTab.listeners?.tabPress?.(event);

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    },
  );

  it('idle 中はレポートタブへ遷移できる', () => {
    const statsTab = renderStatsTabScreen();
    const event = { preventDefault: jest.fn() };

    statsTab.listeners?.tabPress?.(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
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
