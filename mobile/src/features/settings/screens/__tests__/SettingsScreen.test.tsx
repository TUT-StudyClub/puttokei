/**
 * SettingsScreen の主要な振る舞いを検証する。
 *
 * - useSettings の取得が完了するとフォームに値が入ること
 * - タイマー値を変更して保存すると updateMySettings が呼ばれること
 * - 通知 Switch を切り替えると notification_enabled が PATCH されること
 * - プロフィール編集の導線が router.push を呼ぶこと
 * - 削除ボタン押下で Alert.alert が確認ダイアログを表示し、確定で deleteMyAccount が呼ばれること
 *
 * AlertGate / Firebase 周りには触れず、API レイヤと expo-router をモックする。
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

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock('@/features/settings/api/settingsApi');

const SETTINGS_FIXTURE = {
  input_minutes: 25,
  output_minutes: 7,
  break_minutes: 6,
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
    // useSettings の enabled が true になるよう idToken をセット
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

  it('取得完了後にタイマー値がフォームに反映される', async () => {
    const { getByTestId } = renderWithProviders(<SettingsScreen />);

    await waitFor(() => {
      expect(settingsApi.fetchMySettings).toHaveBeenCalled();
    });
    await flushAsyncUpdates();

    const input = getByTestId('settings-input-minutes');
    await waitFor(() => {
      expect(input.props.value).toBe('25');
    });
  });

  it('タイマー値を変更して保存すると updateMySettings が呼ばれる', async () => {
    const { getByTestId } = renderWithProviders(<SettingsScreen />);
    await flushAsyncUpdates();

    const input = getByTestId('settings-input-minutes');
    await waitFor(() => {
      expect(input.props.value).toBe('25');
    });

    fireEvent.changeText(input, '40');
    const saveButton = getByTestId('settings-timer-save');
    await act(async () => {
      fireEvent.press(saveButton);
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(settingsApi.updateMySettings).toHaveBeenCalledWith({
        input_minutes: 40,
        output_minutes: 7,
        break_minutes: 6,
      });
    });
  });

  it('通知トグル切替で notification_enabled が PATCH される', async () => {
    const { getByTestId } = renderWithProviders(<SettingsScreen />);
    await flushAsyncUpdates();

    const switchEl = getByTestId('settings-notification-switch');
    await waitFor(() => {
      // 初期値が反映されてからトグルする
      expect(switchEl.props.accessibilityState?.checked ?? true).toBe(true);
    });

    await act(async () => {
      fireEvent.press(switchEl);
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(settingsApi.updateMySettings).toHaveBeenCalledWith({
        notification_enabled: false,
      });
    });
  });

  it('プロフィール編集の導線で router.push が呼ばれる', async () => {
    const { getByTestId } = renderWithProviders(<SettingsScreen />);
    await flushAsyncUpdates();

    const link = getByTestId('settings-nav-profile-edit');
    fireEvent.press(link);

    expect(mockPush).toHaveBeenCalledWith('/profile/edit');
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

    alertSpy.mockRestore();
  });

  it('ログアウトボタンで authStore.clear() と router.replace が呼ばれる', async () => {
    const { getByTestId } = renderWithProviders(<SettingsScreen />);
    await flushAsyncUpdates();

    const logout = getByTestId('settings-logout');
    fireEvent.press(logout);
    await flushAsyncUpdates();

    expect(useAuthStore.getState().uid).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
  });
});
