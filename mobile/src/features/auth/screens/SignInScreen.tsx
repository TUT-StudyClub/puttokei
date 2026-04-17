/**
 * サインイン待機画面。
 *
 * Apple / Google サインイン本実装は #32 で対応する。
 */
import { H1, Paragraph, YStack } from 'tamagui';

export function SignInScreen() {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      padding="$4"
      gap="$4"
      testID="sign-in-root"
    >
      <H1>サインイン</H1>
      <Paragraph theme="alt2" textAlign="center" testID="sign-in-description">
        Apple / Google サインインは近日対応予定です。
      </Paragraph>
    </YStack>
  );
}
