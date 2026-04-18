/**
 * TutorialStepOneScreen の初期表示と自動切り替えを検証する。
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import {
  TUTORIAL_STEP_ONE_PHASES,
  TUTORIAL_STEP_ONE_PHASE_DISSOLVE_MS,
  TUTORIAL_STEP_ONE_PHASE_DURATION_MS,
  TUTORIAL_STEP_ONE_PHASE_VISIBLE_MS,
  TutorialStepOneScreen,
} from '@/features/auth/screens/TutorialStepOneScreen';
import { TUTORIAL_ROUTE_TRANSITION_DELAY_MS } from '@/features/auth/screens/tutorialConfig';

const mockReplace = jest.fn();
const PHASE_TRANSITION_SETTLE_BUFFER_MS = 500;

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

function getPhaseOpacity(screen: ReturnType<typeof renderWithProviders>, slotIndex: 0 | 1) {
  const flattenedStyle = StyleSheet.flatten(
    screen.getByTestId(`tutorial-step-one-phase-pane-slot-${slotIndex}`).props.style,
  ) as {
    opacity?: number | { __getValue: () => number };
  };

  if (flattenedStyle.opacity === undefined) {
    throw new Error('phase opacity style is missing');
  }

  return typeof flattenedStyle.opacity === 'number'
    ? flattenedStyle.opacity
    : flattenedStyle.opacity.__getValue();
}

function getProgressBackgroundColor(
  screen: ReturnType<typeof renderWithProviders>,
  stepNumber: 1 | 2 | 3,
) {
  const flattenedStyle = StyleSheet.flatten(
    screen.getByTestId(`tutorial-step-one-progress-${stepNumber}`).props.style,
  ) as {
    backgroundColor?: string;
  };

  return flattenedStyle.backgroundColor;
}

function getProgressFillScale(screen: ReturnType<typeof renderWithProviders>) {
  const flattenedStyle = StyleSheet.flatten(
    screen.getByTestId('tutorial-step-one-progress-1-fill').props.style,
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

describe('TutorialStepOneScreen', () => {
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

  it('Step1 の UI を表示する', () => {
    const screen = renderWithProviders(<TutorialStepOneScreen />);

    expect(screen.getByTestId('tutorial-step-one-root')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-one-progress-1')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-one-progress-2')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-one-progress-3')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-one-title')).toBeTruthy();
    expect(screen.getByText('簡単3ステップ')).toBeTruthy();
    expect(screen.getAllByText('20分 集中して勉強').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('tutorial-step-one-preview-input').length).toBeGreaterThan(0);
    expect(screen.getByTestId('tutorial-step-one-next')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-one-skip')).toBeTruthy();
  });

  it('フェーズの切り替えに合わせて上部バーも進む', () => {
    const screen = renderWithProviders(<TutorialStepOneScreen />);
    const getExpectedScale = (phaseIndex: number) =>
      (phaseIndex + 1) / TUTORIAL_STEP_ONE_PHASES.length;

    expect(getProgressBackgroundColor(screen, 1)).toBe('#D9D9D9');
    expect(getProgressBackgroundColor(screen, 2)).toBe('#D9D9D9');
    expect(getProgressBackgroundColor(screen, 3)).toBe('#D9D9D9');
    expect(getProgressFillScale(screen)).toBeCloseTo(getExpectedScale(0), 3);

    act(() => {
      jest.advanceTimersByTime(
        TUTORIAL_STEP_ONE_PHASE_VISIBLE_MS + TUTORIAL_STEP_ONE_PHASE_DISSOLVE_MS / 2,
      );
    });

    expect(getProgressFillScale(screen)).toBeGreaterThan(getExpectedScale(0));
    expect(getProgressFillScale(screen)).toBeLessThan(getExpectedScale(1));

    act(() => {
      jest.advanceTimersByTime(
        TUTORIAL_STEP_ONE_PHASE_DISSOLVE_MS / 2 + PHASE_TRANSITION_SETTLE_BUFFER_MS,
      );
    });

    expect(getProgressBackgroundColor(screen, 1)).toBe('#D9D9D9');
    expect(getProgressBackgroundColor(screen, 2)).toBe('#D9D9D9');
    expect(getProgressBackgroundColor(screen, 3)).toBe('#D9D9D9');
    expect(getProgressFillScale(screen)).toBeCloseTo(getExpectedScale(1), 3);

    act(() => {
      jest.advanceTimersByTime(
        TUTORIAL_STEP_ONE_PHASE_DURATION_MS + PHASE_TRANSITION_SETTLE_BUFFER_MS,
      );
    });

    expect(getProgressBackgroundColor(screen, 1)).toBe('#D9D9D9');
    expect(getProgressBackgroundColor(screen, 2)).toBe('#D9D9D9');
    expect(getProgressBackgroundColor(screen, 3)).toBe('#D9D9D9');
    expect(getProgressFillScale(screen)).toBeCloseTo(getExpectedScale(2), 3);
  });

  it('インプットからアウトプット、休憩へ自動で切り替わる', () => {
    const screen = renderWithProviders(<TutorialStepOneScreen />);

    expect(screen.getAllByText('20分 集中して勉強').length).toBeGreaterThan(0);

    act(() => {
      jest.advanceTimersByTime(
        TUTORIAL_STEP_ONE_PHASE_DURATION_MS + PHASE_TRANSITION_SETTLE_BUFFER_MS,
      );
    });
    expect(screen.getByText('5分アウトプット')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-one-preview-output')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(
        TUTORIAL_STEP_ONE_PHASE_DURATION_MS + PHASE_TRANSITION_SETTLE_BUFFER_MS,
      );
    });
    expect(screen.getByText('5分休憩&AI正誤チェック')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-one-preview-break')).toBeTruthy();
  });

  it('ディゾルブ中は前後のフェーズが重なって表示される', () => {
    const screen = renderWithProviders(<TutorialStepOneScreen />);

    act(() => {
      jest.advanceTimersByTime(
        TUTORIAL_STEP_ONE_PHASE_VISIBLE_MS + TUTORIAL_STEP_ONE_PHASE_DISSOLVE_MS / 2,
      );
    });

    expect(screen.getByText('20分 集中して勉強')).toBeTruthy();
    expect(screen.getByText('5分アウトプット')).toBeTruthy();
    expect(getPhaseOpacity(screen, 0)).toBeGreaterThan(0);
    expect(getPhaseOpacity(screen, 0)).toBeLessThan(1);
    expect(getPhaseOpacity(screen, 1)).toBeGreaterThan(0);
    expect(getPhaseOpacity(screen, 1)).toBeLessThan(1);
  });

  it('ディゾルブ完了後も次のフェーズ内容が表示されたままになる', () => {
    const screen = renderWithProviders(<TutorialStepOneScreen />);

    act(() => {
      jest.advanceTimersByTime(
        TUTORIAL_STEP_ONE_PHASE_DURATION_MS + PHASE_TRANSITION_SETTLE_BUFFER_MS,
      );
    });

    expect(screen.getByText('5分アウトプット')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-one-preview-output')).toBeTruthy();
    expect(Math.max(getPhaseOpacity(screen, 0), getPhaseOpacity(screen, 1))).toBe(1);
  });

  it('次へは少し待ってから Step2 へ進む', () => {
    const screen = renderWithProviders(<TutorialStepOneScreen />);

    fireEvent.press(screen.getByTestId('tutorial-step-one-next'));

    expect(mockReplace).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(TUTORIAL_ROUTE_TRANSITION_DELAY_MS - 1);
    });
    expect(mockReplace).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(mockReplace).toHaveBeenNthCalledWith(1, '/(auth)/tutorial-step-two');
  });

  it('スキップするは少し待ってからサインイン画面へ進む', () => {
    const screen = renderWithProviders(<TutorialStepOneScreen />);

    fireEvent.press(screen.getByTestId('tutorial-step-one-skip'));

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
