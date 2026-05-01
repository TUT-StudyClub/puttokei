import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import * as sessionApi from '@/features/session/api/sessionApi';
import { useJudgmentProgress } from '@/features/session/hooks/useJudgmentProgress';
import type { JudgmentProgress } from '@/features/session/types';
import { useAuthStore } from '@/shared/stores/authStore';

jest.mock('@/features/session/api/sessionApi');

jest.mock('react-native-sse', () => {
  class MockEventSource {
    static instances: MockEventSource[] = [];

    url: string;
    options: Record<string, unknown>;
  listeners: Record<string, ((event: unknown) => void)[]>;
    close: jest.Mock;
    removeAllEventListeners: jest.Mock;

    constructor(url: string, options: Record<string, unknown> = {}) {
      this.url = url;
      this.options = options;
      this.listeners = {};
      this.close = jest.fn();
      this.removeAllEventListeners = jest.fn((type?: string) => {
        if (type === undefined) {
          this.listeners = {};
          return;
        }
        delete this.listeners[type];
      });

      MockEventSource.instances.push(this);
    }

    addEventListener(type: string, listener: (event: unknown) => void) {
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }
      this.listeners[type]!.push(listener);
    }

    emit(type: string, event: unknown) {
      this.listeners[type]?.forEach((listener) => {
        listener(event);
      });
    }
  }

  return MockEventSource;
});

type MockEventSourceInstance = {
  url: string;
  options: Record<string, unknown>;
  close: jest.Mock;
  emit: (type: string, event: unknown) => void;
};

type MockEventSourceClass = {
  instances: MockEventSourceInstance[];
};

function getEventSourceClass(): MockEventSourceClass {
  return require('react-native-sse') as MockEventSourceClass;
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const QUEUED_PROGRESS: JudgmentProgress = {
  status: 'queued',
  stage: 'queued',
  percent: 5,
  message: '判定をキューに登録しました。',
  updated_at: '2026-05-01T00:00:00.000Z',
  completed_at: null,
  error_code: null,
};

describe('useJudgmentProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getEventSourceClass().instances = [];
    useAuthStore.getState().clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('SSE で判定進捗を受信し、Authorization ヘッダーに authStore の idToken を載せる', async () => {
    useAuthStore.setState({ uid: 'usr-1', idToken: 'id-token-123' });
    (sessionApi.getJudgmentProgress as jest.Mock).mockResolvedValue(QUEUED_PROGRESS);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
      },
    });

    const { result } = renderHook(() => useJudgmentProgress('ses-123'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(sessionApi.getJudgmentProgress).toHaveBeenCalledTimes(1);
    });

    const eventSources = getEventSourceClass().instances;
    expect(eventSources).toHaveLength(1);
    const eventSource = eventSources[0]!;
    expect(eventSource.url).toContain('/sessions/ses-123/judgment/progress/stream');
    expect(eventSource.options).toMatchObject({
      headers: { Authorization: 'Bearer id-token-123' },
    });

    act(() => {
      eventSource.emit('progress', {
        type: 'progress',
        data: JSON.stringify({
          ...QUEUED_PROGRESS,
          status: 'running',
          stage: 'requesting_llm',
          percent: 35,
          message: 'AI に判定を依頼しています。',
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.data?.percent).toBe(35);
    });
    expect(result.current.data?.message).toBe('AI に判定を依頼しています。');
    expect(result.current.isPollingFallback).toBe(false);
  });

  it('SSE エラー時は 1 秒 polling fallback に切り替える', async () => {
    (sessionApi.getJudgmentProgress as jest.Mock)
      .mockResolvedValueOnce(QUEUED_PROGRESS)
      .mockResolvedValue({
        ...QUEUED_PROGRESS,
        status: 'running',
        stage: 'receiving_llm',
        percent: 55,
        message: 'AI から判定内容を受信しています。',
      });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
      },
    });

    const { result } = renderHook(() => useJudgmentProgress('ses-123'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(sessionApi.getJudgmentProgress).toHaveBeenCalledTimes(1);
    });

    const eventSource = getEventSourceClass().instances[0]!;
    act(() => {
      eventSource.emit('error', { type: 'error', message: 'network error' });
    });

    await waitFor(() => {
      expect(result.current.isPollingFallback).toBe(true);
    });

    act(() => {
      jest.advanceTimersByTime(1_000);
    });

    await waitFor(() => {
      expect(sessionApi.getJudgmentProgress).toHaveBeenCalledTimes(2);
    });
  });

  it('enabled=false の間は fetch と SSE 接続を開始しない', async () => {
    (sessionApi.getJudgmentProgress as jest.Mock).mockResolvedValue(QUEUED_PROGRESS);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
      },
    });

    renderHook(() => useJudgmentProgress('ses-123', false), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      jest.advanceTimersByTime(1_000);
    });

    expect(sessionApi.getJudgmentProgress).not.toHaveBeenCalled();
    expect(getEventSourceClass().instances).toHaveLength(0);
  });

  it('completed 受信時は judgment query を invalidate する', async () => {
    (sessionApi.getJudgmentProgress as jest.Mock).mockResolvedValue(QUEUED_PROGRESS);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
      },
    });
    const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useJudgmentProgress('ses-123'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(sessionApi.getJudgmentProgress).toHaveBeenCalledTimes(1);
    });

    const eventSource = getEventSourceClass().instances[0]!;
    act(() => {
      eventSource.emit('progress', {
        type: 'progress',
        data: JSON.stringify({
          ...QUEUED_PROGRESS,
          status: 'completed',
          stage: 'completed',
          percent: 100,
          message: '採点が完了しました。',
          completed_at: '2026-05-01T00:00:10.000Z',
        }),
      });
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['sessions', 'ses-123', 'judgment'],
      });
    });
  });
});
