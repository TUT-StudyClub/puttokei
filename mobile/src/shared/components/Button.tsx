/**
 * Tamagui ベースの共通ボタン。
 * variant や size の追加は Epic #2 以降の画面要件に合わせて拡張する。
 */
import { Button as TamaguiButton, ButtonProps } from 'tamagui';

export type AppButtonProps = ButtonProps & {
  testID?: string;
};

export function Button(props: AppButtonProps) {
  return <TamaguiButton {...props} />;
}
