import { Pressable } from 'react-native';
import { Paragraph, SizableText, XStack, YStack } from 'tamagui';

import { Card } from '@/shared/components/Card';
import {
  formatJudgedAt,
  JUDGMENT_VERDICT_COLORS,
  JUDGMENT_VERDICT_LABELS,
} from '@/shared/lib/judgmentPresentation';
import type { Judgment } from '@/shared/types/session';

type JudgmentListItemProps = {
  judgment: Judgment;
  onPress: () => void;
};

export function JudgmentListItem({ judgment, onPress }: JudgmentListItemProps) {
  return (
    <Pressable onPress={onPress} testID={`history-item-${judgment.id}`}>
      <Card>
        <YStack gap="$3">
          <XStack alignItems="center" justifyContent="space-between" gap="$3">
            <SizableText fontWeight="700">{formatJudgedAt(judgment.judged_at)}</SizableText>
            <SizableText
              color={JUDGMENT_VERDICT_COLORS[judgment.verdict]}
              fontWeight="700"
              size="$3"
            >
              {JUDGMENT_VERDICT_LABELS[judgment.verdict]}
            </SizableText>
          </XStack>
          <Paragraph>スコア: {judgment.score}</Paragraph>
          <Paragraph numberOfLines={2}>{judgment.advice}</Paragraph>
          <SizableText color="$gray10" size="$2">
            指摘 {judgment.corrections.length} 件
          </SizableText>
        </YStack>
      </Card>
    </Pressable>
  );
}
