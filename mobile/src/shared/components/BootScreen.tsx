/**
 * アプリ起動時に表示する React 側のブート画面。
 */
import { Image } from 'react-native';
import { Paragraph, Spinner, YStack } from 'tamagui';

const BOOT_LOGO = require('../../../assets/images/typography-black.png');

export const BOOT_SCREEN_MIN_DURATION_MS = 2000;

export function BootScreen() {
  return (
    <YStack
      testID="boot-screen"
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      zIndex={1}
      alignItems="center"
      justifyContent="center"
      gap="$4"
      padding="$6"
      backgroundColor="$background"
    >
      <Image source={BOOT_LOGO} style={{ width: 220, height: 52 }} resizeMode="contain" />
      <Spinner size="large" />
      <Paragraph theme="alt2">アプリを起動しています</Paragraph>
    </YStack>
  );
}
