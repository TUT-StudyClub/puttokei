/**
 * 日 / 週 / 月の期間切替セグメント。
 *
 * Tamagui の Tabs / ToggleGroup は native での挙動が不安定なため、
 * XStack + Button を 3 つ並べて SegmentedButtons 相当を自作する。
 */
import { Button, XStack } from 'tamagui';

import type { Period } from '@/features/stats/types';

type PeriodOption = { value: Period; label: string; testID: string };

const OPTIONS: PeriodOption[] = [
  { value: 'daily', label: '日', testID: 'stats-period-daily' },
  { value: 'weekly', label: '週', testID: 'stats-period-weekly' },
  { value: 'monthly', label: '月', testID: 'stats-period-monthly' },
];

type Props = {
  value: Period;
  onChange: (period: Period) => void;
};

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <XStack gap="$2" testID="stats-period-selector">
      {OPTIONS.map((option) => {
        const isSelected = option.value === value;
        return (
          <Button
            key={option.value}
            flex={1}
            size="$3"
            themeInverse={isSelected}
            onPress={() => onChange(option.value)}
            testID={option.testID}
            accessibilityState={{ selected: isSelected }}
          >
            {option.label}
          </Button>
        );
      })}
    </XStack>
  );
}
