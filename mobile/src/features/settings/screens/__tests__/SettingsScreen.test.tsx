/**
 * SettingsScreen の主要な振る舞いを検証する。
 *
 * - useSettings の取得が完了するとカードに値が表示されること
 * - タイマー行をタップしてピッカーから値を選ぶと updateMySettings が呼ばれること
 * - 通知行をタップしてピッカーから値を選ぶと notification_enabled が PATCH されること
 * - 言語行をタップしてピッカーから値を選ぶと表示ラベルが切り替わること
 * - 削除ボタン押下で Alert.alert を開き、確定で deleteMyAccount が呼ばれること
 * - ログアウトボタン押下で Alert.alert を開き、確定で authStore.clear() と router.replace が呼ばれること
 * - 戻るボタンで router.back() が呼ばれること
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as settingsApi from '@/features/settings/api/settingsApi';
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { useAuthStore } from '@/shared/stores/authStore';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}));

jest.mock('@/features/settings/api/settingsApi');
// 本テストでは Firebase Auth を実初期化しない。signOut は実装側の finally で authStore を
// clear するため、mock も同じ副作用 (authStore.clear) を再現する。
jest.mock('@/features/auth/lib/signOut', () => {
  const { useAuthStore } = jest.requireActual('@/shared/stores/authStore');
  return {
    signOut: jest.fn().mockImplementation(async () => {
      useAuthStore.getState().clear();
    }),
  };
});

const SETTINGS_FIXTURE = {
  input_minutes: 25,
  output_minutes: 5,
  break_minutes: 10,
  notification_enabled: true,
  updated_at: '2026-04-16T00:00:00Z',
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

async function flushAsyncUpdates() {
  await act(async () => {});
  act(() => {
    jest.runOnlyPendingTimers();
  });
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    act(() => {
      useAuthStore.setState({ uid: 'u-1', idToken: 'token-1' });
    });
    (settingsApi.fetchMySettings as jest.Mock).mockResolvedValue(SETTINGS_FIXTURE);
    (settingsApi.updateMySettings as jest.Mock).mockResolvedValue(SETTINGS_FIXTURE);
    (settingsApi.deleteMyAccount as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null });
    });
    jest.useRealTimers();
  });

  it('取得完了後にタイマーと通知の値がカードに表示される', async () => {
    const { getByTestId, getByText } = renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(settingsApi.fetchMySettings).toHaveBeenCalled();
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('settings-row-input-minutes')).toBeTruthy();
    });
    expect(getByText('25分')).toBeTruthy();
    expect(getByText('5分')).toBeTruthy();
    expect(getByText('10分')).toBeTruthy();
    expect(getByText('あり')).toBeTruthy();
    expect(getByText('日本語')).toBeTruthy();
  });

  it('インプット時間の行をタップしてピッカーで値を選ぶと updateMySettings が呼ばれる', async () => {
    const { getByTestId } = renderWithProviders(<SettingsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('settings-row-input-minutes')).toBeTruthy();
    });

    fireEvent.press(getByTestId('settings-row-input-minutes'));
    await flushAsyncUpdates();

    const option = getByTestId('settings-picker-option-45');
    await act(async () => {
      fireEvent.press(option);
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(settingsApi.updateMySettings).toHaveBeenCalledWith({ input_minutes: 45 });
    });
  });

  it('通知行をタップしてピッカーで「なし」を選ぶと notification_enabled が PATCH される', async () => {
    const { getByTestId } = renderWithProviders(<SettingsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('settings-row-notification')).toBeTruthy();
    });

    fireEvent.press(getByTestId('settings-row-notification'));
    await flushAsyncUpdates();

    const off = getByTestId('settings-picker-notification-off');
    await act(async () => {
      fireEvent.press(off);
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(settingsApi.updateMySettings).toHaveBeenCalledWith({ notification_enabled: false });
    });
  });

  it('言語行をタップしてピッカーで English を選ぶと表示が切り替わる', async () => {
    const { getByTestId, getByText } = renderWithProviders(<SettingsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('settings-row-language')).toBeTruthy();
    });
    // 初期表示は日本語
    expect(getByText('日本語')).toBeTruthy();

    fireEvent.press(getByTestId('settings-row-language'));
    await flushAsyncUpdates();

    await act(async () => {
      fireEvent.press(getByTestId('settings-picker-language-en'));
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByText('English')).toBeTruthy();
    });
  });

  it('アカウント削除ボタンで確認ダイアログを開き、確定で deleteMyAccount が呼ばれる', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId } = renderWithProviders(<SettingsScreen />);
    await flushAsyncUpdates();

    const deleteButton = getByTestId('settings-delete-account');
    fireEvent.press(deleteButton);

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const buttons = alertSpy.mock.calls[0]![2];
    expect(buttons).toBeDefined();
    const destructive = buttons!.find((b) => b.style === 'destructive');
    expect(destructive).toBeDefined();

    await act(async () => {
      destructive!.onPress?.();
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(settingsApi.deleteMyAccount).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(useAuthStore.getState().uid).toBeNull();
    });
    // 削除成功後は AuthGate に頼らず明示的に (auth)/overview へ遷移する。
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/overview');
    });

    alertSpy.mockRestore();
  });

  it('ログアウトボタンで確認ダイアログを開き、確定で authStore.clear() と router.replace が呼ばれる', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId } = renderWithProviders(<SettingsScreen />);
    await flushAsyncUpdates();

    fireEvent.press(getByTestId('settings-logout'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const buttons = alertSpy.mock.calls[0]![2];
    expect(buttons).toBeDefined();
    const destructive = buttons!.find((b) => b.style === 'destructive');
    expect(destructive).toBeDefined();

    await act(async () => {
      destructive!.onPress?.();
    });
    await flushAsyncUpdates();

    expect(useAuthStore.getState().uid).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');

    alertSpy.mockRestore();
  });

  it('戻るボタンで router.back() が呼ばれる', async () => {
    const { getByTestId } = renderWithProviders(<SettingsScreen />);
    await flushAsyncUpdates();

    fireEvent.press(getByTestId('settings-back-button'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('GET が失敗したときはエラービューと再取得ボタンを表示し、押すと再フェッチする', async () => {
    (settingsApi.fetchMySettings as jest.Mock)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(SETTINGS_FIXTURE);

    const { getByTestId, queryByTestId } = renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(getByTestId('settings-fetch-error')).toBeTruthy();
    });
    expect(queryByTestId('settings-root')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('settings-retry'));
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(settingsApi.fetchMySettings).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(getByTestId('settings-root')).toBeTruthy();
    });
  });
});
