/**
 * TutorialStepOneScreen の初期表示と自動切り替えを検証する。
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import {
  TUTORIAL_STEP_ONE_PHASE_DISSOLVE_MS,
  TUTORIAL_STEP_ONE_PHASE_DURATION_MS,
  TUTORIAL_STEP_ONE_PHASE_VISIBLE_MS,
  TutorialStepOneScreen,
} from '@/features/auth/screens/TutorialStepOneScreen';

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

  it('次へとスキップするの両方でサインイン画面へ進める', () => {
    const screen = renderWithProviders(<TutorialStepOneScreen />);

    fireEvent.press(screen.getByTestId('tutorial-step-one-next'));
    fireEvent.press(screen.getByTestId('tutorial-step-one-skip'));

    expect(mockReplace).toHaveBeenNthCalledWith(1, '/(auth)/tutorial-step-two');
    expect(mockReplace).toHaveBeenNthCalledWith(2, '/(auth)/sign-in');
  });
});
