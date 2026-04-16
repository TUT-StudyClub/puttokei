/**
 * アウトプットフェーズ画面。
 *
 * - `OutputEditor` でアウトプット本文を入力し、「送信する」で POST /sessions/{id}/output
 * - 送信成功時は `PATCH status=judging` を送り `/session/{id}/break` へ遷移
 * - タイマー完了時は（本文の有無に関わらず）`PATCH status=judging` を送り break へ遷移
 *   （自動送信は行わず、ユーザーの明示的な送信操作のみで submit する方針）
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Paragraph, SizableText, YStack } from 'tamagui';

import { OutputEditor } from '@/features/session/components/OutputEditor';
import type { OutputEditorSubmitPayload } from '@/features/session/components/OutputEditor';
import { SessionHeader } from '@/features/session/components/SessionHeader';
import { Timer } from '@/features/session/components/Timer';
import { DEFAULT_TIMER } from '@/features/session/config';
import { useSubmitOutput } from '@/features/session/hooks/useSubmitOutput';
import { useTimer } from '@/features/session/hooks/useTimer';
import { useUpdateSessionStatus } from '@/features/session/hooks/useUpdateSessionStatus';

type SessionRouteParams = {
  id?: string;
  output?: string;
  break?: string;
};

export function OutputScreen() {
  const params = useLocalSearchParams<SessionRouteParams>();
  const sessionId = params.id ?? '';
  const outputMinutes = Number(params.output) || DEFAULT_TIMER.output_minutes;
  const breakMinutes = Number(params.break) || DEFAULT_TIMER.break_minutes;

  const router = useRouter();
  const submit = useSubmitOutput();
  const updateStatus = useUpdateSessionStatus();

  const [content, setContent] = useState('');

  const navigateToBreak = useCallback(() => {
    router.replace({
      pathname: '/session/[id]/break',
      params: { id: sessionId, break: String(breakMinutes) },
    });
  }, [router, sessionId, breakMinutes]);

  const advanceToJudging = useCallback(() => {
    updateStatus.mutate(
      { sessionId, status: 'judging' },
      {
        onSuccess: navigateToBreak,
      },
    );
  }, [updateStatus, sessionId, navigateToBreak]);

  const handleEditorSubmit = useCallback(
    ({ content: nextContent, submitted_at }: OutputEditorSubmitPayload) => {
      submit.mutate(
        { sessionId, content: nextContent, submitted_at },
        {
          onSuccess: advanceToJudging,
        },
      );
    },
    [submit, sessionId, advanceToJudging],
  );

  const { start, reset } = useTimer({
    onComplete: () => {
      advanceToJudging();
    },
  });

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start('output', outputMinutes * 60);
    return () => {
      reset();
    };
    // 依存を意図的に空にしている: start/reset が参照として安定しているうえ、
    // startedRef で二重 start を防いでいるため再実行は不要。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitErrorMessage = submit.isError
    ? '送信に失敗しました。時間をおいて再度お試しください。'
    : null;

  return (
    <YStack flex={1}>
      <SessionHeader sessionId={sessionId} title="アウトプット" onBeforeCancel={reset} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <YStack flex={1} padding="$4" gap="$4">
            <Paragraph>学んだ内容をまとめて送信してください。</Paragraph>
            <Timer />
            <OutputEditor
              value={content}
              onChange={setContent}
              onSubmit={handleEditorSubmit}
              isSubmitting={submit.isPending || updateStatus.isPending}
              errorMessage={submitErrorMessage}
            />
            {updateStatus.isError ? (
              <SizableText color="$red10" size="$2" testID="output-screen-error">
                通信エラーが発生しました。時間をおいて再度お試しください。
              </SizableText>
            ) : null}
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </YStack>
  );
}
