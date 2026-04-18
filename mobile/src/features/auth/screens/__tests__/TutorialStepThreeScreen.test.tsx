/**
 * TutorialStepThreeScreen の表示と遷移を検証する。
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import { TutorialStepThreeScreen } from '@/features/auth/screens/TutorialStepThreeScreen';
import { TUTORIAL_ROUTE_TRANSITION_DELAY_MS } from '@/features/auth/screens/tutorialConfig';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

function renderWithProviders(ui: ReactNode) {
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      {ui}
    </TamaguiProvider>,
  );
}

describe('TutorialStepThreeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('Step3 の UI を表示する', () => {
    const screen = renderWithProviders(<TutorialStepThreeScreen />);

    expect(screen.getByTestId('tutorial-step-three-root')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-three-progress')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-three-title')).toBeTruthy();
    expect(screen.getByText('学びを加速しよう')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-three-blank-stage')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-three-next')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-three-skip')).toBeTruthy();
  });

  it('次へは少し待ってからサインイン画面へ進む', () => {
    const screen = renderWithProviders(<TutorialStepThreeScreen />);

    fireEvent.press(screen.getByTestId('tutorial-step-three-next'));

    expect(mockReplace).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(TUTORIAL_ROUTE_TRANSITION_DELAY_MS - 1);
    });
    expect(mockReplace).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(mockReplace).toHaveBeenNthCalledWith(1, '/(auth)/sign-in');
  });

  it('スキップするは少し待ってからサインイン画面へ進む', () => {
    const screen = renderWithProviders(<TutorialStepThreeScreen />);

    fireEvent.press(screen.getByTestId('tutorial-step-three-skip'));

    expect(mockReplace).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(TUTORIAL_ROUTE_TRANSITION_DELAY_MS - 1);
    });
    expect(mockReplace).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(mockReplace).toHaveBeenNthCalledWith(1, '/(auth)/sign-in');
  });
});
