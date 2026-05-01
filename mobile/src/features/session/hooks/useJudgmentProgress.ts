import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import EventSource from 'react-native-sse';

import { getJudgmentProgress } from '@/features/session/api/sessionApi';
import type { JudgmentProgress } from '@/features/session/types';
import { type ApiError, buildApiUrl } from '@/shared/lib/api';
import { getAuthIdToken } from '@/shared/stores/authStore';

const JUDGMENT_PROGRESS_FALLBACK_INTERVAL_MS = 1_000;
const TERMINAL_PROGRESS_STATUSES = new Set<JudgmentProgress['status']>(['completed', 'failed']);

export function useJudgmentProgress(sessionId: string, enabled = true) {
  const queryClient = useQueryClient();
  const [isPollingFallback, setIsPollingFallback] = useState(false);
  const invalidatedSessionIdRef = useRef<string | null>(null);
  const progressQueryKey = useMemo(
    () => ['sessions', sessionId, 'judgment-progress'] as const,
    [sessionId],
  );

  useEffect(() => {
    setIsPollingFallback(false);
    invalidatedSessionIdRef.current = null;
  }, [sessionId]);

  const progressQuery = useQuery<JudgmentProgress, ApiError>({
    queryKey: progressQueryKey,
    queryFn: () => getJudgmentProgress(sessionId),
    enabled: enabled && sessionId.length > 0,
    retry: false,
    refetchInterval: (query) =>
      enabled &&
      isPollingFallback &&
      !TERMINAL_PROGRESS_STATUSES.has(query.state.data?.status ?? 'queued')
        ? JUDGMENT_PROGRESS_FALLBACK_INTERVAL_MS
        : false,
  });

  useEffect(() => {
    if (!enabled || sessionId.length === 0 || isPollingFallback) return;

    const token = getAuthIdToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const eventSource = new EventSource<'progress'>(
      buildApiUrl(`/sessions/${sessionId}/judgment/progress/stream`),
      {
        headers,
        pollingInterval: 0,
        timeoutBeforeConnection: 0,
      },
    );

    let disposed = false;

    const switchToPollingFallback = () => {
      if (disposed) return;
      setIsPollingFallback(true);
    };

    const handleProgress = (event: { data: string | null }) => {
      if (event.data === null) return;
      try {
        const progress = JSON.parse(event.data) as JudgmentProgress;
        queryClient.setQueryData(progressQueryKey, progress);
        if (TERMINAL_PROGRESS_STATUSES.has(progress.status)) {
          eventSource.close();
        }
      } catch {
        switchToPollingFallback();
        eventSource.close();
      }
    };

    const handleError = () => {
      switchToPollingFallback();
      eventSource.close();
    };

    eventSource.addEventListener('progress', handleProgress);
    eventSource.addEventListener('error', handleError);

    return () => {
      disposed = true;
      eventSource.removeAllEventListeners();
      eventSource.close();
    };
  }, [enabled, isPollingFallback, progressQueryKey, queryClient, sessionId]);

  useEffect(() => {
    if (sessionId.length === 0 || progressQuery.data?.status !== 'completed') return;
    if (invalidatedSessionIdRef.current === sessionId) return;

    invalidatedSessionIdRef.current = sessionId;
    void queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'judgment'] });
  }, [progressQuery.data?.status, queryClient, sessionId]);

  return {
    ...progressQuery,
    isPollingFallback,
  };
}
