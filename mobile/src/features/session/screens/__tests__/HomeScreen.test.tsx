/**
 * HomeScreen の基本的な振る舞いを検証する。
 *
 * react-hook-form + zodResolver の validation は非同期で errors state を更新するため、
 * `fireEvent` 直後ではなく `findBy*` / `waitFor` で UI への反映を待ってから assertion する
 * ことで act(...) 警告を回避する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as sessionApi from '@/features/session/api/sessionApi';
import { HomeScreen } from '@/features/session/screens/HomeScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/features/session/api/sessionApi');

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

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('初期表示は preset=recommended、subject / topic は空でカスタム入力欄は表示しない', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(<HomeScreen />);

    expect(getByTestId('home-subject-input').props.value).toBe('');
    expect(getByTestId('home-topic-input').props.value).toBe('');
    expect(queryByTestId('home-input-minutes')).toBeNull();
    expect(queryByTestId('home-output-minutes')).toBeNull();
    expect(queryByTestId('home-break-minutes')).toBeNull();
  });

  it('subject / topic 未入力で start を押しても createSession は呼ばれない', async () => {
    const { getByTestId, findByText } = renderWithProviders(<HomeScreen />);
    fireEvent.press(getByTestId('home-start-button'));
    // バリデーションエラー表示を待つことで、非同期の errors state 更新の完了を待つ
    expect(await findByText('科目を入力してください')).toBeTruthy();
    expect(sessionApi.createSession).not.toHaveBeenCalled();
  });

  it('preset を custom にするとカスタム入力欄が表示される', async () => {
    const { getByTestId, findByTestId } = renderWithProviders(<HomeScreen />);
    fireEvent.press(getByTestId('home-preset-custom'));
    expect(await findByTestId('home-input-minutes')).toBeTruthy();
    expect(getByTestId('home-output-minutes')).toBeTruthy();
    expect(getByTestId('home-break-minutes')).toBeTruthy();
  });

  it('正常入力で start を押すと createSession が呼ばれ、成功時に push 遷移する', async () => {
    (sessionApi.createSession as jest.Mock).mockResolvedValue({
      id: 'ses-123',
      user_id: 'usr-1',
      status: 'input',
      subject: '英語',
      topic: '関係代名詞',
      input_minutes: 20,
      output_minutes: 5,
      break_minutes: 5,
      started_at: '2026-04-15T10:00:00Z',
      completed_at: null,
      created_at: '2026-04-15T10:00:00Z',
    });

    const { getByTestId } = renderWithProviders(<HomeScreen />);
    fireEvent.changeText(getByTestId('home-subject-input'), '英語');
    fireEvent.changeText(getByTestId('home-topic-input'), '関係代名詞');
    fireEvent.press(getByTestId('home-start-button'));

    await waitFor(() => {
      expect(sessionApi.createSession).toHaveBeenCalledWith({
        subject: '英語',
        topic: '関係代名詞',
        input_minutes: 20,
        output_minutes: 5,
        break_minutes: 5,
      });
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/session/ses-123/input');
    });
  });

  it('カスタム時間で start を押すとカスタム値が createSession に渡る', async () => {
    (sessionApi.createSession as jest.Mock).mockResolvedValue({
      id: 'ses-456',
      user_id: 'usr-1',
      status: 'input',
      subject: '数学',
      topic: '極限',
      input_minutes: 30,
      output_minutes: 10,
      break_minutes: 3,
      started_at: '2026-04-15T11:00:00Z',
      completed_at: null,
      created_at: '2026-04-15T11:00:00Z',
    });

    const { getByTestId, findByTestId } = renderWithProviders(<HomeScreen />);
    fireEvent.changeText(getByTestId('home-subject-input'), '数学');
    fireEvent.changeText(getByTestId('home-topic-input'), '極限');
    fireEvent.press(getByTestId('home-preset-custom'));
    // カスタム入力欄の表示を待ってから値を入れる
    await findByTestId('home-input-minutes');
    fireEvent.changeText(getByTestId('home-input-minutes'), '30');
    fireEvent.changeText(getByTestId('home-output-minutes'), '10');
    fireEvent.changeText(getByTestId('home-break-minutes'), '3');
    fireEvent.press(getByTestId('home-start-button'));

    await waitFor(() => {
      expect(sessionApi.createSession).toHaveBeenCalledWith({
        subject: '数学',
        topic: '極限',
        input_minutes: 30,
        output_minutes: 10,
        break_minutes: 3,
      });
    });
  });

  it('createSession が失敗するとエラー文言が表示される', async () => {
    (sessionApi.createSession as jest.Mock).mockRejectedValue(new Error('HTTP 500'));

    const { getByTestId, findByText } = renderWithProviders(<HomeScreen />);
    fireEvent.changeText(getByTestId('home-subject-input'), '英語');
    fireEvent.changeText(getByTestId('home-topic-input'), '関係代名詞');
    fireEvent.press(getByTestId('home-start-button'));

    expect(await findByText(/セッションの開始に失敗しました/)).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
