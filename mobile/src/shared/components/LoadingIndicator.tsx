/**
 * 共通ローディング表示。Tamagui の Spinner をラップする。
 */
import { Spinner, YStack } from 'tamagui';

export function LoadingIndicator() {
  return (
    <YStack alignItems="center" justifyContent="center" padding="$4">
      <Spinner size="large" />
    </YStack>
  );
}
