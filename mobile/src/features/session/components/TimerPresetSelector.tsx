/**
 * セッション開始フォーム用のプリセット選択コンポーネント。
 * RadioGroup で「おすすめ」と「カスタム」を選ぶ。
 */
import { RadioGroup, SizableText, XStack, YStack } from 'tamagui';

import { TIMER_PRESET_KEYS, TIMER_PRESET_LABELS, type TimerPresetKey } from '@/features/session/config';

type Props = {
  value: TimerPresetKey;
  onChange: (key: TimerPresetKey) => void;
};

export function TimerPresetSelector({ value, onChange }: Props) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as TimerPresetKey)}>
      <YStack gap="$2">
        {TIMER_PRESET_KEYS.map((key) => (
          <XStack key={key} alignItems="center" gap="$3">
            <RadioGroup.Item
              value={key}
              id={`home-preset-${key}`}
              testID={`home-preset-${key}`}
              size="$4"
            >
              <RadioGroup.Indicator />
            </RadioGroup.Item>
            <SizableText htmlFor={`home-preset-${key}`} size="$4">
              {TIMER_PRESET_LABELS[key]}
            </SizableText>
          </XStack>
        ))}
      </YStack>
    </RadioGroup>
  );
}
