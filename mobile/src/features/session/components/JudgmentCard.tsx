/**
 * 判定結果カード。
 *
 * 誤り箇所(corrections)を「該当 → 正解 + 解説」のリストで表示する。
 * インプット画面の本文ハイライト UI とは異なり、ResultScreen / HistoryDetail では
 * 本文が手元に無いため、リスト形式で要点だけ見せる。
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
        {judgment.corrections.length > 0 ? (
          <YStack gap="$3" testID="judgment-corrections">
            <SizableText fontWeight="700">気になった箇所</SizableText>
            {judgment.corrections.map((correction, index) => (
              <YStack key={index} gap="$1">
                <SizableText color="$red10" fontWeight="700">
                  該当: {correction.target_text}
                </SizableText>
                <SizableText fontWeight="700">正解: {correction.correct_text}</SizableText>
                <Paragraph>{correction.explanation}</Paragraph>
              </YStack>
            ))}
          </YStack>
        ) : null}
      </YStack>
    </Card>
  );
}
