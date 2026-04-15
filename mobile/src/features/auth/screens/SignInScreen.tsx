/**
 * サインイン画面。
 *
 * Apple / Google サインイン本実装は #32 で対応する。
 * 本 PR では onboarding の動作確認用に、開発ビルド時のみ
 * 「テストユーザーでログイン」ボタンを表示して authStore に mock トークンを入れる。
 */
import { Button, H1, Paragraph, YStack } from 'tamagui';

import { useAuthStore } from '@/shared/stores/authStore';

export function SignInScreen() {
  const setDevMockSession = useAuthStore((s) => s.setDevMockSession);

  return (
    <YStack flex={1} alignItems="center" justifyContent="center" padding="$4" gap="$4">
      <H1>サインイン</H1>
      <Paragraph theme="alt2" textAlign="center">
        Apple / Google サインインは近日対応予定です。
      </Paragraph>

      {__DEV__ ? (
        <Button
          onPress={() => setDevMockSession('dev-user-001')}
          themeInverse
          testID="dev-mock-sign-in"
        >
          [dev] テストユーザーでログイン
        </Button>
      ) : null}
    </YStack>
  );
}
