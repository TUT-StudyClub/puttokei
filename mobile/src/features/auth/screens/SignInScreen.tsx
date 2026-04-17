/**
 * サインイン画面。
 *
 * Apple / Google サインインボタンを表示し、Firebase credential を取得する。
 * 開発ビルド時のみテストユーザーでログインするボタンも表示する。
 */
import { Platform } from 'react-native';
import { Button, H1, Paragraph, Spinner, YStack } from 'tamagui';

import { useSignIn } from '../hooks/useSignIn';
import { useAuthStore } from '@/shared/stores/authStore';

export function SignInScreen() {
  const setDevMockSession = useAuthStore((s) => s.setDevMockSession);
  const { loading, error, signInWithApple, signInWithGoogle, clearError } = useSignIn();

  return (
    <YStack flex={1} alignItems="center" justifyContent="center" padding="$4" gap="$4">
      <H1>サインイン</H1>

      {error ? (
        <Paragraph color="$red10" textAlign="center" onPress={clearError}>
          {error}
        </Paragraph>
      ) : null}

      {loading ? (
        <Spinner size="large" />
      ) : (
        <YStack gap="$3" width="100%" maxWidth={320}>
          {Platform.OS === 'ios' ? (
            <Button
              onPress={signInWithApple}
              disabled={loading}
              size="$5"
              backgroundColor="$color12"
              color="$color1"
              testID="sign-in-apple"
            >
              Apple でサインイン
            </Button>
          ) : null}

          <Button
            onPress={signInWithGoogle}
            disabled={loading}
            size="$5"
            testID="sign-in-google"
          >
            Google でサインイン
          </Button>

          {__DEV__ ? (
            <Button
              onPress={() => setDevMockSession('dev-user-001')}
              themeInverse
              size="$5"
              testID="dev-mock-sign-in"
            >
              [dev] テストユーザーでログイン
            </Button>
          ) : null}
        </YStack>
      )}
    </YStack>
  );
}
