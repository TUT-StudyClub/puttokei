import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import { CircularPhaseTimer, PhaseTabs } from '@/features/session/components/SessionPhaseChrome';
import { useTimerStore } from '@/shared/stores/timerStore';

function renderWithProvider(ui: ReactNode) {
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      {ui}
    </TamaguiProvider>,
  );
}

describe('SessionPhaseChrome', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useTimerStore.setState({
      phase: 'idle',
      status: 'idle',
      totalSeconds: 0,
      remainingSeconds: 0,
      completionToken: 0,
    });
  });

  afterEach(() => {
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('PhaseTabs はフェーズ表示、active 状態、押下 callback を扱う', () => {
    const onChange = jest.fn();

    const { getByTestId, getByText } = renderWithProvider(
      <PhaseTabs
        activePhase="output"
        testIDPrefix="session"
        activeDotColor="#EC4899"
        onChange={onChange}
      />,
    );

    expect(getByText('インプット')).toBeTruthy();
    expect(getByText('アウトプット')).toBeTruthy();
    expect(getByText('休憩')).toBeTruthy();
    expect(getByTestId('session-phase-tab-output').props.accessibilityState).toEqual({
      selected: true,
    });

    fireEvent.press(getByTestId('session-phase-tab-break'));
    expect(onChange).toHaveBeenCalledWith('break');
  });

  it('CircularPhaseTimer は timerStore の残秒数を MM:SS 形式で表示する', () => {
    useTimerStore.setState({
      phase: 'output',
      status: 'paused',
      totalSeconds: 1200,
      remainingSeconds: 65,
    });

    const { getByTestId, getByText } = renderWithProvider(
      <CircularPhaseTimer
        phase="output"
        primaryColor="#EC4899"
        trackColor="#FBE4EF"
        testID="session-circular-timer"
      />,
    );

    expect(getByTestId('session-circular-timer')).toBeTruthy();
    expect(getByText('アウトプット')).toBeTruthy();
    expect(getByTestId('timer-display').props.children).toBe('01:05');
  });
});
