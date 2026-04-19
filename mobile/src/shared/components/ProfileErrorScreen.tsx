/**
 * プロフィール取得に失敗した際に表示する全画面エラー。
 * `AuthGate` から再試行 / サインアウトのハンドラを受け取る。
 */
import { Button, H2, Paragraph, YStack } from 'tamagui';

type ProfileErrorScreenProps = {
  message: string;
  onRetry: () => void;
  onSignOut: () => void | Promise<void>;
};

export function ProfileErrorScreen({ message, onRetry, onSignOut }: ProfileErrorScreenProps) {
  return (
    <YStack
      testID="profile-error-screen"
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      zIndex={2}
      alignItems="center"
      justifyContent="center"
      gap="$4"
      padding="$6"
      backgroundColor="$background"
    >
      <H2>プロフィールを取得できませんでした</H2>
      <Paragraph textAlign="center" theme="alt2">
        {message}
      </Paragraph>
      <YStack gap="$3" width="100%" maxWidth={320}>
        <Button size="$5" onPress={onRetry} testID="profile-error-retry">
          再試行
        </Button>
        <Button size="$5" themeInverse onPress={onSignOut} testID="profile-error-sign-out">
          サインアウト
        </Button>
      </YStack>
    </YStack>
  );
}
