/**
 * カスタムタイマー入力欄。
 * input_minutes / output_minutes / break_minutes をそれぞれ数値入力で受け取る。
 */
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { Input, SizableText, YStack } from 'tamagui';

type FormShape = {
  input_minutes: number;
  output_minutes: number;
  break_minutes: number;
};

type Props<T extends FormShape> = {
  control: Control<T>;
  errors: FieldErrors<T>;
};

const FIELDS: { name: keyof FormShape; label: string; testID: string }[] = [
  { name: 'input_minutes', label: 'インプット (分)', testID: 'home-input-minutes' },
  { name: 'output_minutes', label: 'アウトプット (分)', testID: 'home-output-minutes' },
  { name: 'break_minutes', label: '休憩 (分)', testID: 'home-break-minutes' },
];

export function TimerCustomFields<T extends FormShape>({ control, errors }: Props<T>) {
  return (
    <YStack gap="$3">
      {FIELDS.map((field) => (
        <YStack key={field.name} gap="$1">
          <SizableText size="$3">{field.label}</SizableText>
          <Controller
            control={control}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            name={field.name as any}
            render={({ field: { onChange, value } }) => (
              <Input
                testID={field.testID}
                keyboardType="number-pad"
                value={Number.isFinite(value) ? String(value) : ''}
                onChangeText={(text) => {
                  if (text === '') {
                    onChange(Number.NaN);
                  } else {
                    onChange(Number(text));
                  }
                }}
              />
            )}
          />
          {errors[field.name] ? (
            <SizableText color="$red10" size="$2">
              {String(errors[field.name]?.message ?? '値が不正です')}
            </SizableText>
          ) : null}
        </YStack>
      ))}
    </YStack>
  );
}
