/**
 * TutorialStepTwoScreen の表示と遷移を検証する。
 */
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import { TutorialStepTwoScreen } from '@/features/auth/screens/TutorialStepTwoScreen';

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

describe('TutorialStepTwoScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Step2 の UI を表示する', () => {
    const screen = renderWithProviders(<TutorialStepTwoScreen />);

    expect(screen.getByTestId('tutorial-step-two-root')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-two-progress')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-two-title')).toBeTruthy();
    expect(screen.getByText('答え合わせは次の20分に')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-two-preview')).toBeTruthy();
    expect(screen.getByText('AIフィードバック')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-two-next')).toBeTruthy();
    expect(screen.getByTestId('tutorial-step-two-skip')).toBeTruthy();
  });

  it('次へとスキップするの両方でサインイン画面へ進める', () => {
    const screen = renderWithProviders(<TutorialStepTwoScreen />);

    fireEvent.press(screen.getByTestId('tutorial-step-two-next'));
    fireEvent.press(screen.getByTestId('tutorial-step-two-skip'));

    expect(mockReplace).toHaveBeenNthCalledWith(1, '/(auth)/sign-in');
    expect(mockReplace).toHaveBeenNthCalledWith(2, '/(auth)/sign-in');
  });
});
