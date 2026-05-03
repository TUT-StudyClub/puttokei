import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import {
  CircularPhaseTimer,
  PhaseTabs,
  SessionTopChrome,
} from '@/features/session/components/SessionPhaseChrome';
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

  it('PhaseTabs は非 active の dot をフェーズ単位で塗りつぶせる', () => {
    const { getByTestId } = renderWithProvider(
      <PhaseTabs
        activePhase="output"
        testIDPrefix="session"
        activeDotColor="#EC4899"
        inactiveDotColors={{ input: '#B9DFFF' }}
        inactiveDotFilledPhases={{ input: true }}
      />,
    );

    const inputDotStyle = StyleSheet.flatten(
      getByTestId('session-phase-tab-input-dot').props.style,
    );
    const breakDotStyle = StyleSheet.flatten(
      getByTestId('session-phase-tab-break-dot').props.style,
    );

    expect(inputDotStyle.backgroundColor).toBe('#B9DFFF');
    expect(inputDotStyle.borderColor).toBe('#B9DFFF');
    expect(breakDotStyle.backgroundColor).toBe('transparent');
  });

  it('SessionTopChrome はホームではサイクル表示をグレーにする', () => {
    const { getByTestId, getByText } = renderWithProvider(
      <SessionTopChrome
        testIDPrefix="home"
        hourglass={{ currentLoop: 1 }}
        phaseTabs={{
          activePhase: 'input',
          activeDotColor: '#9CA3AF',
        }}
      />,
    );

    expect(getByText('0サイクル')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('home-cycle-label').props.style).color).toBe('#9D9D9D');
    expect(StyleSheet.flatten(getByTestId('home-phase-tabs-wrapper').props.style).top).toBe(
      '19.4%',
    );
  });

  it('SessionTopChrome はセッション画面ではサイクル表示を黒にする', () => {
    const { getByTestId, getByText } = renderWithProvider(
      <SessionTopChrome
        testIDPrefix="input"
        hourglass={{
          currentLoop: 2,
          variant: 'blue',
        }}
        phaseTabs={{
          activePhase: 'input',
          activeDotColor: '#4B5CFF',
        }}
      />,
    );

    expect(getByText('2サイクル')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('input-cycle-label').props.style).color).toBe('#2F2F2F');
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
