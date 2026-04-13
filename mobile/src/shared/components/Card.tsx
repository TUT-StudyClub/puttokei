/**
 * Tamagui ベースの共通カード。
 */
import { Card as TamaguiCard, CardProps } from 'tamagui';

export type AppCardProps = CardProps;

export function Card(props: AppCardProps) {
  return <TamaguiCard padded bordered {...props} />;
}
