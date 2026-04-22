/**
 * OutputScreen の振る舞いを検証する。
 *
 * - マウント時に phase=output のタイマーが start される
 * - タイマー完了で本文が空ならエラーメッセージを表示する
 * - タイマー完了で本文があれば送信を促すメッセージを表示し、自動送信しない
 * - OutputEditor で本文を入力 → 送信すると submitOutput → break 画面へ replace する
 * - 画像を撮影 → 提出すると submitOutput → break 画面へ replace する
 * - submitOutput が失敗するとエラーメッセージが表示され、再度送信できる
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import {
  Keyboard,
  NativeModules,
  StyleSheet,
  type KeyboardEvent,
  type KeyboardEventListener,
} from 'react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as sessionApi from '@/features/session/api/sessionApi';
import { useTimerStore } from '@/shared/stores/timerStore';

const mockReplace = jest.fn();
const mockRequestCameraPermissionsAsync = jest.fn();
const mockLaunchCameraAsync = jest.fn();
let mockRouteParams = {
  id: 'ses-123',
  input: '20',
  output: '1',
  break: '5',
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('expo-image-picker', () => ({
  __esModule: true,
  requestCameraPermissionsAsync: mockRequestCameraPermissionsAsync,
  launchCameraAsync: mockLaunchCameraAsync,
}));

jest.mock('@/features/session/api/sessionApi');

const { OutputScreen } =
  require('@/features/session/screens/OutputScreen') as typeof import('@/features/session/screens/OutputScreen');

const keyboardListeners = new Map<string, KeyboardEventListener>();

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  function Providers({ children }: { children: ReactNode }) {
    return (
      <TamaguiProvider config={config} defaultTheme="light">
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </TamaguiProvider>
    );
  }

  return render(ui, { wrapper: Providers });
}

function resetRouteParams() {
  mockRouteParams = {
    id: 'ses-123',
    input: '20',
    output: '1',
    break: '5',
  };
}

const submitSuccessResponse = {
  status: 'judging',
  output: {
    id: 'out-1',
    session_id: 'ses-123',
    content: '関係代名詞は先行詞を修飾する',
    submitted_at: '2026-04-10T15:25:00.000Z',
  },
} as const;

describe('OutputScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).expo = {
      ...(globalThis as any).expo,
      modules: { ExponentImagePicker: {} },
    };
    (NativeModules as any).NativeUnimoduleProxy = undefined;
    mockRequestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    mockLaunchCameraAsync.mockResolvedValue({ canceled: true, assets: [] });
    resetRouteParams();
    keyboardListeners.clear();
    jest.spyOn(Keyboard, 'addListener').mockImplementation((eventName, listener) => {
      keyboardListeners.set(eventName, listener);
      return {
        remove: () => {
          keyboardListeners.delete(eventName);
        },
      } as ReturnType<typeof Keyboard.addListener>;
    });
    useTimerStore.setState({
      phase: 'idle',
      status: 'idle',
      totalSeconds: 0,
      remainingSeconds: 0,
      completionToken: 0,
    });
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-10T15:25:00.000Z'));
  });

  afterEach(() => {
    // CI (Ubuntu) で RTL の auto cleanup (async) が 60s ハングしていたため、
    // fake timers が有効なうちに先回りで unmount を済ませる。
    // これで RTL afterEach の cleanup キューは空になり async 待ちが発生しない。
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('マウントで phase=output のタイマーが開始され、主要 UI が表示される', () => {
    const { getByTestId, getAllByText } = renderWithProviders(<OutputScreen />);
    // 画面タイトル・フェーズタブ・タイマー中央のラベルで複数回「アウトプット」が出現する
    expect(getAllByText('アウトプット').length).toBeGreaterThan(0);
    expect(getByTestId('output-settings-button')).toBeTruthy();
    expect(getByTestId('output-composer-card')).toBeTruthy();
    expect(
      StyleSheet.flatten(getByTestId('output-phase-tab-input-dot').props.style).backgroundColor,
    ).toBe('#B9DFFF');
    expect(useTimerStore.getState().phase).toBe('output');
    expect(useTimerStore.getState().totalSeconds).toBe(60);
  });

  it('キーボード表示時も全体レイアウトを維持しつつ入力欄が利用できる', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(<OutputScreen />);

    act(() => {
      keyboardListeners.get('keyboardWillShow')?.({
        duration: 250,
        endCoordinates: { height: 320, screenX: 0, screenY: 0, width: 0 },
        easing: 'keyboard',
        startCoordinates: { height: 0, screenX: 0, screenY: 0, width: 0 },
      } as KeyboardEvent);
    });

    expect(getByTestId('output-composer-card')).toBeTruthy();
    expect(getByTestId('output-editor-textarea')).toBeTruthy();
    expect(queryByTestId('output-settings-button')).toBeNull();
    expect(queryByTestId('output-hourglass-badge')).toBeNull();
    expect(queryByTestId('output-timer-caption')).toBeNull();
  });

  it('画像タブ選択時は画像パネルと提出 UI を表示する', () => {
    const { getByTestId, getByText, queryByTestId } = renderWithProviders(<OutputScreen />);

    fireEvent.press(getByTestId('output-method-tab-image'));

    expect(getByTestId('output-image-panel')).toBeTruthy();
    expect(getByTestId('output-image-add-button')).toBeTruthy();
    expect(getByTestId('output-image-submit')).toBeTruthy();
    expect(getByText('提出後も時間内であれば編集できます')).toBeTruthy();
    expect(queryByTestId('output-image-thumbnail-0')).toBeNull();
    expect(queryByTestId('output-editor-textarea')).toBeNull();
    expect(queryByTestId('output-method-notice')).toBeNull();
    expect(queryByTestId('output-settings-button')).toBeNull();
    expect(queryByTestId('output-hourglass-badge')).toBeNull();
    expect(queryByTestId('output-timer-caption')).toBeNull();
  });

  it('画像追加メニューからカメラを開き、撮影画像を左から追加する', async () => {
    mockLaunchCameraAsync
      .mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file:///output-first.jpg' }],
      })
      .mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file:///output-second.jpg' }],
      });

    const { getByTestId } = renderWithProviders(<OutputScreen />);

    fireEvent.press(getByTestId('output-method-tab-image'));

    await act(async () => {
      fireEvent.press(getByTestId('output-image-add-button'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('output-image-add-menu-camera'));
    });

    await waitFor(() => {
      expect(getByTestId('output-image-thumbnail-0').props.source).toEqual({
        uri: 'file:///output-first.jpg',
      });
    });

    await act(async () => {
      fireEvent.press(getByTestId('output-image-add-button'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('output-image-add-menu-camera'));
    });

    await waitFor(() => {
      expect(getByTestId('output-image-thumbnail-1').props.source).toEqual({
        uri: 'file:///output-second.jpg',
      });
    });
    expect(mockRequestCameraPermissionsAsync).toHaveBeenCalledTimes(2);
    expect(mockLaunchCameraAsync).toHaveBeenCalledTimes(2);
    expect(mockLaunchCameraAsync).toHaveBeenCalledWith({
      allowsEditing: false,
      mediaTypes: 'images',
      quality: 0.8,
    });
  });

  it('画像未追加で提出するとエラーメッセージを表示し、送信しない', () => {
    const { getByTestId } = renderWithProviders(<OutputScreen />);

    fireEvent.press(getByTestId('output-method-tab-image'));
    fireEvent.press(getByTestId('output-image-submit'));

    expect(getByTestId('output-image-submit-error').props.children).toBe(
      '画像を1枚以上追加してから提出してください。',
    );
    expect(sessionApi.submitOutput).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('画像を追加して提出すると submitOutput → break 画面へ replace する', async () => {
    (sessionApi.submitOutput as jest.Mock).mockResolvedValue({
      ...submitSuccessResponse,
      output: {
        ...submitSuccessResponse.output,
        content: '画像でアウトプットしました。撮影した学習内容の画像を提出しました。（1枚）',
      },
    });
    mockLaunchCameraAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///output-first.jpg' }],
    });

    const { getByTestId } = renderWithProviders(<OutputScreen />);

    fireEvent.press(getByTestId('output-method-tab-image'));

    await act(async () => {
      fireEvent.press(getByTestId('output-image-add-button'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('output-image-add-menu-camera'));
    });

    await waitFor(() => {
      expect(getByTestId('output-image-thumbnail-0')).toBeTruthy();
    });

    act(() => {
      fireEvent.press(getByTestId('output-image-submit'));
    });

    await waitFor(() => {
      expect(sessionApi.submitOutput).toHaveBeenCalledWith('ses-123', {
        content: expect.stringContaining(
          '画像でアウトプットしました。撮影した学習内容の画像を提出しました。（1枚）',
        ),
        submitted_at: '2026-04-10T15:25:00.000Z',
      });
    });
    expect(sessionApi.submitOutput).toHaveBeenCalledWith('ses-123', {
      content: expect.stringContaining('画像1: file:///output-first.jpg'),
      submitted_at: '2026-04-10T15:25:00.000Z',
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/session/[id]/break',
        params: { id: 'ses-123', input: '20', output: '1', break: '5' },
      });
    });
  });

  it('タイマー完了で本文が空ならエラーメッセージを表示し、送信しない', async () => {
    const { getByTestId } = renderWithProviders(<OutputScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(getByTestId('output-editor-error')).toBeTruthy();
    });
    expect(sessionApi.submitOutput).not.toHaveBeenCalled();
  });

  it('タイマー完了で本文があれば送信を促すメッセージを表示し、自動送信しない', async () => {
    const { getByTestId } = renderWithProviders(<OutputScreen />);

    fireEvent.changeText(getByTestId('output-editor-textarea'), '関係代名詞は先行詞を修飾する');

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(getByTestId('output-editor-error')).toBeTruthy();
    });
    expect(sessionApi.submitOutput).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('本文入力 → 送信で submitOutput → break 画面へ replace する', async () => {
    (sessionApi.submitOutput as jest.Mock).mockResolvedValue(submitSuccessResponse);

    const { getByTestId } = renderWithProviders(<OutputScreen />);

    fireEvent.changeText(getByTestId('output-editor-textarea'), '関係代名詞は先行詞を修飾する');

    act(() => {
      fireEvent.press(getByTestId('output-editor-submit'));
    });

    await waitFor(() => {
      expect(sessionApi.submitOutput).toHaveBeenCalledWith('ses-123', {
        content: '関係代名詞は先行詞を修飾する',
        submitted_at: '2026-04-10T15:25:00.000Z',
      });
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/session/[id]/break',
        params: { id: 'ses-123', input: '20', output: '1', break: '5' },
      });
    });
  });

  it('submitOutput 失敗時はエラーメッセージと「再送する」ボタンが現れ、明示操作で再送できる', async () => {
    (sessionApi.submitOutput as jest.Mock)
      .mockRejectedValueOnce(new Error('HTTP 500'))
      .mockResolvedValueOnce(submitSuccessResponse);

    const { getByTestId } = renderWithProviders(<OutputScreen />);

    fireEvent.changeText(getByTestId('output-editor-textarea'), '本文');

    act(() => {
      fireEvent.press(getByTestId('output-editor-submit'));
    });

    await waitFor(() => {
      expect(getByTestId('output-editor-error')).toBeTruthy();
    });

    act(() => {
      fireEvent.press(getByTestId('output-editor-submit'));
      fireEvent.press(getByTestId('output-editor-submit'));
    });
    expect(sessionApi.submitOutput).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.press(getByTestId('output-editor-retry'));
    });

    await waitFor(() => {
      expect(sessionApi.submitOutput).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/session/[id]/break',
        params: { id: 'ses-123', input: '20', output: '1', break: '5' },
      });
    });
  });

  it('session id が変わったら前サイクルの送信状態を引き継がずに新しいアウトプットを送信できる', async () => {
    (sessionApi.submitOutput as jest.Mock)
      .mockResolvedValueOnce(submitSuccessResponse)
      .mockResolvedValueOnce({
        status: 'judging',
        output: {
          id: 'out-2',
          session_id: 'ses-next',
          content: '2回目の本文',
          submitted_at: '2026-04-10T15:25:00.000Z',
        },
      });

    const { getByTestId, rerender } = renderWithProviders(<OutputScreen />);

    fireEvent.changeText(getByTestId('output-editor-textarea'), '1回目の本文');
    act(() => {
      fireEvent.press(getByTestId('output-editor-submit'));
    });

    await waitFor(() => {
      expect(sessionApi.submitOutput).toHaveBeenCalledWith('ses-123', {
        content: '1回目の本文',
        submitted_at: '2026-04-10T15:25:00.000Z',
      });
    });

    act(() => {
      mockRouteParams = {
        id: 'ses-next',
        input: '20',
        output: '1',
        break: '5',
      };
      rerender(<OutputScreen />);
    });

    expect(getByTestId('output-editor-textarea').props.value).toBe('');

    fireEvent.changeText(getByTestId('output-editor-textarea'), '2回目の本文');
    act(() => {
      fireEvent.press(getByTestId('output-editor-submit'));
    });

    await waitFor(() => {
      expect(sessionApi.submitOutput).toHaveBeenCalledWith('ses-next', {
        content: '2回目の本文',
        submitted_at: expect.any(String),
      });
    });
    expect(sessionApi.submitOutput).toHaveBeenCalledTimes(2);
  });
});
