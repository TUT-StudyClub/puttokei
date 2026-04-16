/**
 * 判定結果カード。
 */
import { H3, Paragraph, SizableText, XStack, YStack } from 'tamagui';

import type { Judgment } from '@/features/session/types';
import { Card } from '@/shared/components/Card';

type JudgmentCardProps = {
  judgment: Judgment;
};

const VERDICT_LABELS: Record<Judgment['verdict'], string> = {
  correct: 'Good',
  partial: 'Partial',
  incorrect: 'Needs Work',
  rejected: 'Rejected',
};

const VERDICT_COLORS: Record<Judgment['verdict'], string> = {
  correct: '$green10',
  partial: '$orange10',
  incorrect: '$red10',
  rejected: '$red10',
};

export function JudgmentCard({ judgment }: JudgmentCardProps) {
  return (
    <Card testID="judgment-card">
      <YStack gap="$3">
        <XStack alignItems="center" justifyContent="space-between">
          <H3>今回の判定</H3>
          <SizableText color={VERDICT_COLORS[judgment.verdict]} fontWeight="700" size="$3">
            {VERDICT_LABELS[judgment.verdict]}
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
