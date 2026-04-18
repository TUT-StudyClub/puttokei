/**
 * TutorialStepThreeScreen の表示と遷移を検証する。
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import { TutorialStepThreeScreen } from '@/features/auth/screens/TutorialStepThreeScreen';
import {
  TUTORIAL_PROGRESS_FILL_DURATION_MS,
  TUTORIAL_ROUTE_TRANSITION_DELAY_MS,
} from '@/features/auth/screens/tutorialConfig';

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

function getProgressFillScale(screen: ReturnType<typeof renderWithProviders>) {
  const flattenedStyle = StyleSheet.flatten(
    screen.getByTestId('tutorial-step-three-progress-fill').props.style,
  ) as {
    transform?: {
      scaleX?: number | { __getValue: () => number };
    }[];
  };

  const scaleX = flattenedStyle.transform?.find(
    (transform) => transform.scaleX !== undefined,
  )?.scaleX;

  if (scaleX === undefined) {
    throw new Error('progress fill scale style is missing');
  }

  return typeof scaleX === 'number' ? scaleX : scaleX.__getValue();
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
    expect(screen.getByTestId('tutorial-step-three-hourglass')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-three-next')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-three-skip')).toBeTruthy();
  });

  it('上部バーは 5 秒で 0 から最大まで伸びる', () => {
    const screen = renderWithProviders(<TutorialStepThreeScreen />);

    expect(getProgressFillScale(screen)).toBeCloseTo(0, 3);

    act(() => {
      jest.advanceTimersByTime(TUTORIAL_PROGRESS_FILL_DURATION_MS / 2);
    });
    expect(getProgressFillScale(screen)).toBeGreaterThan(0);
    expect(getProgressFillScale(screen)).toBeLessThan(1);

    act(() => {
      jest.advanceTimersByTime(TUTORIAL_PROGRESS_FILL_DURATION_MS / 2);
    });
    expect(getProgressFillScale(screen)).toBeCloseTo(1, 3);
  });

  it('5秒後に自動でサインイン画面へ進む', () => {
    renderWithProviders(<TutorialStepThreeScreen />);

    expect(mockReplace).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(TUTORIAL_PROGRESS_FILL_DURATION_MS - 1);
    });
    expect(mockReplace).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(mockReplace).toHaveBeenNthCalledWith(1, '/(auth)/sign-in');
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
