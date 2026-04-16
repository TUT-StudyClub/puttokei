/**
 * 判定結果カード。
 */
import { H3, Paragraph, SizableText, XStack, YStack } from 'tamagui';

import type { Judgment } from '@/features/session/types';
import { Card } from '@/shared/components/Card';
import {
  JUDGMENT_VERDICT_COLORS,
  JUDGMENT_VERDICT_LABELS,
} from '@/shared/lib/judgmentPresentation';

type JudgmentCardProps = {
  judgment: Judgment;
  title?: string;
};

export function JudgmentCard({ judgment, title = '今回の判定' }: JudgmentCardProps) {
  return (
    <Card testID="judgment-card">
      <YStack gap="$3">
        <XStack alignItems="center" justifyContent="space-between">
          <H3>{title}</H3>
          <SizableText color={JUDGMENT_VERDICT_COLORS[judgment.verdict]} fontWeight="700" size="$3">
            {JUDGMENT_VERDICT_LABELS[judgment.verdict]}
          </SizableText>
        </XStack>
        <Paragraph testID="judgment-score">スコア: {judgment.score}</Paragraph>
        <Paragraph>{judgment.advice}</Paragraph>
        <YStack gap="$2">
          {judgment.items.map((item) => (
            <YStack key={item.label} gap="$1">
              <SizableText fontWeight="700">{item.label}</SizableText>
              <Paragraph>{item.comment}</Paragraph>
            </YStack>
          ))}
        </YStack>
      </YStack>
    </Card>
  );
}
