/**
 * `Timer` コンポーネントが `timerStore` の `remainingSeconds` を購読し、
 * `MM:SS` 形式で表示することを検証する。
 *
 * Tamagui の `SizableText` を使うため `TamaguiProvider` 配下でレンダする。
 */
import { act, cleanup, render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import { Timer } from '../Timer';
import { useTimerStore } from '@/shared/stores/timerStore';

function renderTimer(ui: React.ReactElement) {
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      {ui}
    </TamaguiProvider>,
  );
}

describe('Timer', () => {
  beforeEach(() => {
    useTimerStore.setState({
      phase: 'idle',
      status: 'idle',
      totalSeconds: 0,
      remainingSeconds: 0,
      completionToken: 0,
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('初期状態は 00:00 を表示する', () => {
    const { getByText } = renderTimer(<Timer />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(getByText('00:00')).toBeTruthy();
  });

  it('remainingSeconds=1200 のときに 20:00 を表示する', () => {
    useTimerStore.setState({
      phase: 'input',
      status: 'paused',
      totalSeconds: 1200,
      remainingSeconds: 1200,
    });
    const { getByText } = renderTimer(<Timer />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(getByText('20:00')).toBeTruthy();
  });

  it('store の更新に追従して再レンダリングされる (ゼロパディング含む)', () => {
    const { getByText } = renderTimer(<Timer />);
    act(() => {
      useTimerStore.setState({ remainingSeconds: 65 });
      jest.runOnlyPendingTimers();
    });
    expect(getByText('01:05')).toBeTruthy();

    act(() => {
      useTimerStore.setState({ remainingSeconds: 9 });
      jest.runOnlyPendingTimers();
    });
    expect(getByText('00:09')).toBeTruthy();
  });

  it('testID で取得できる (デフォルトは timer-display)', () => {
    const { getByTestId } = renderTimer(<Timer />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(getByTestId('timer-display')).toBeTruthy();
  });

  it('testID を明示指定できる', () => {
    const { getByTestId } = renderTimer(<Timer testID="custom-timer" />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(getByTestId('custom-timer')).toBeTruthy();
  });
});
