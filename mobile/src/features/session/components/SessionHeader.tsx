/**
 * セッション画面 (input / output / break) 共通のヘッダー。
 *
 * 左端にフェーズ名を表示し、右端に「中断」ボタンを置く。
 * 中断操作は Alert で確認を取り、承諾されたら `PATCH status=cancelled` を送って
 * ホームタブ（`/(tabs)`）へ `router.replace` する。
 *
 * Result 画面は終端ステータス (judged) のため本コンポーネントを使わず、
 * 独自のヘッダー + ホームへ戻るボタンを配置する想定。
 */
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { Button, H3, XStack } from 'tamagui';

import { useUpdateSessionStatus } from '@/features/session/hooks/useUpdateSessionStatus';

export type SessionHeaderProps = {
  sessionId: string;
  title: string;
  /**
   * 中断前にタイマー停止などを呼びたい場合に使う。
   * 例: 動作中の setInterval を解除するため `reset()` を渡す。
   */
  onBeforeCancel?: () => void;
};

export function SessionHeader({ sessionId, title, onBeforeCancel }: SessionHeaderProps) {
  const router = useRouter();
  const cancelMutation = useUpdateSessionStatus();

  const handleCancel = () => {
    Alert.alert('セッションを中断しますか？', '中断するとこのセッションは終了します。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '中断する',
        style: 'destructive',
        onPress: () => {
          onBeforeCancel?.();
          cancelMutation.mutate(
            { sessionId, status: 'cancelled' },
            {
              onSuccess: () => {
                router.replace('/(tabs)');
              },
            },
          );
        },
      },
    ]);
  };

  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      paddingHorizontal="$4"
      paddingVertical="$3"
    >
      <H3>{title}</H3>
      <Button
        size="$3"
        onPress={handleCancel}
        disabled={cancelMutation.isPending}
        testID="session-header-cancel"
      >
        中断
      </Button>
    </XStack>
  );
}
