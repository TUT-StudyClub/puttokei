/**
 * SessionHeader の「中断」操作の振る舞いを検証する。
 *
 * Alert.alert は jest.spyOn で差し替え、「中断する」ボタンの onPress を
 * 直接呼び出して、確認ダイアログを承諾した状態をシミュレートする。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import { SessionHeader } from '@/features/session/components/SessionHeader';
import * as sessionApi from '@/features/session/api/sessionApi';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

jest.mock('@/features/session/api/sessionApi');

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </TamaguiProvider>,
  );
}

function flushPendingTimers() {
  act(() => {
    jest.runOnlyPendingTimers();
  });
}

describe('SessionHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    flushPendingTimers();
    jest.useRealTimers();
  });

  it('中断ボタン押下 → 「中断する」承諾で onBeforeCancel → cancelled PATCH → ホームへ replace', async () => {
    (sessionApi.updateSessionStatus as jest.Mock).mockResolvedValue({ status: 'cancelled' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const confirm = (buttons as AlertButton[] | undefined)?.find(
        (b) => b.style === 'destructive',
      );
      confirm?.onPress?.();
    });
    const onBeforeCancel = jest.fn();

    const { getByTestId } = renderWithProviders(
      <SessionHeader sessionId="ses-1" title="インプット" onBeforeCancel={onBeforeCancel} />,
    );
    flushPendingTimers();

    fireEvent.press(getByTestId('session-header-cancel'));
    flushPendingTimers();

    expect(alertSpy).toHaveBeenCalled();
    expect(onBeforeCancel).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(sessionApi.updateSessionStatus).toHaveBeenCalledWith('ses-1', 'cancelled');
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });

    alertSpy.mockRestore();
  });

  it('「キャンセル」選択時は PATCH も遷移も起きない', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const cancel = (buttons as AlertButton[] | undefined)?.find((b) => b.style === 'cancel');
      cancel?.onPress?.();
    });

    const { getByTestId } = renderWithProviders(
      <SessionHeader sessionId="ses-1" title="インプット" />,
    );
    flushPendingTimers();

    fireEvent.press(getByTestId('session-header-cancel'));
    flushPendingTimers();

    expect(sessionApi.updateSessionStatus).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
