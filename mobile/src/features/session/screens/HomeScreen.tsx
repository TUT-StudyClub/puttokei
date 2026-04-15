/**
 * ホーム画面。subject / topic / 時間設定を入力してセッションを開始する。
 *
 * デフォルト時間（おすすめプリセット）は `config.ts` の DEFAULT_TIMER から取得する。
 * 将来 user_settings API（Epic #5 / #6）が実装されたら同フックで取得した値で置き換える。
 *
 * 送信成功時は `useCreateSession` 内で `/session/{id}/input` に push 遷移する。
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, H2, Input, Paragraph, SizableText, Spinner, TextArea, YStack } from 'tamagui';
import { z } from 'zod';

import { TimerCustomFields } from '@/features/session/components/TimerCustomFields';
import { TimerPresetSelector } from '@/features/session/components/TimerPresetSelector';
import {
  DEFAULT_TIMER,
  TIMER_MAX,
  TIMER_MIN,
  TIMER_PRESET_KEYS,
  type TimerPresetKey,
} from '@/features/session/config';
import { useCreateSession } from '@/features/session/hooks/useCreateSession';

const schema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, '科目を入力してください')
    .max(50, '科目は 50 文字以内で入力してください'),
  topic: z
    .string()
    .trim()
    .min(1, 'トピックを入力してください')
    .max(200, 'トピックは 200 文字以内で入力してください'),
  preset: z.enum(TIMER_PRESET_KEYS),
  input_minutes: z
    .number({ invalid_type_error: 'インプット時間を入力してください' })
    .int('整数で入力してください')
    .min(TIMER_MIN, `${TIMER_MIN} 分以上にしてください`)
    .max(TIMER_MAX, `${TIMER_MAX} 分以下にしてください`),
  output_minutes: z
    .number({ invalid_type_error: 'アウトプット時間を入力してください' })
    .int('整数で入力してください')
    .min(TIMER_MIN, `${TIMER_MIN} 分以上にしてください`)
    .max(TIMER_MAX, `${TIMER_MAX} 分以下にしてください`),
  break_minutes: z
    .number({ invalid_type_error: '休憩時間を入力してください' })
    .int('整数で入力してください')
    .min(TIMER_MIN, `${TIMER_MIN} 分以上にしてください`)
    .max(TIMER_MAX, `${TIMER_MAX} 分以下にしてください`),
});

type FormValues = z.infer<typeof schema>;

export function HomeScreen() {
  const createSession = useCreateSession();
  const previousPresetRef = useRef<TimerPresetKey | null>(null);
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      subject: '',
      topic: '',
      preset: 'recommended',
      ...DEFAULT_TIMER,
    },
  });

  const preset: TimerPresetKey = watch('preset');

  useEffect(() => {
    const previousPreset = previousPresetRef.current;
    previousPresetRef.current = preset;

    if (preset === 'recommended' && previousPreset === 'custom') {
      setValue('input_minutes', DEFAULT_TIMER.input_minutes, { shouldValidate: true });
      setValue('output_minutes', DEFAULT_TIMER.output_minutes, { shouldValidate: true });
      setValue('break_minutes', DEFAULT_TIMER.break_minutes, { shouldValidate: true });
    }
  }, [preset, setValue]);

  const onSubmit = handleSubmit((values) => {
    createSession.mutate({
      subject: values.subject,
      topic: values.topic,
      input_minutes: values.input_minutes,
      output_minutes: values.output_minutes,
      break_minutes: values.break_minutes,
    });
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <YStack flex={1} padding="$4" gap="$4">
          <YStack gap="$2">
            <H2>セッションを開始</H2>
            <Paragraph theme="alt2">
              科目とトピック、時間設定を入力して学習サイクルを始めましょう。
            </Paragraph>
          </YStack>

          <YStack gap="$1">
            <SizableText size="$3">科目</SizableText>
            <Controller
              control={control}
              name="subject"
              render={({ field: { onChange, value } }) => (
                <Input
                  testID="home-subject-input"
                  placeholder="例: 英語"
                  value={value}
                  onChangeText={onChange}
                  maxLength={50}
                />
              )}
            />
            {errors.subject ? (
              <SizableText color="$red10" size="$2">
                {errors.subject.message}
              </SizableText>
            ) : null}
          </YStack>

          <YStack gap="$1">
            <SizableText size="$3">トピック</SizableText>
            <Controller
              control={control}
              name="topic"
              render={({ field: { onChange, value } }) => (
                <TextArea
                  testID="home-topic-input"
                  placeholder="例: 関係代名詞 (who / which) の使い分け"
                  value={value}
                  onChangeText={onChange}
                  maxLength={200}
                  minHeight={88}
                />
              )}
            />
            {errors.topic ? (
              <SizableText color="$red10" size="$2">
                {errors.topic.message}
              </SizableText>
            ) : null}
          </YStack>

          <YStack gap="$2">
            <SizableText size="$3">時間設定</SizableText>
            <Controller
              control={control}
              name="preset"
              render={({ field: { onChange, value } }) => (
                <TimerPresetSelector value={value} onChange={onChange} />
              )}
            />
          </YStack>

          {preset === 'custom' ? <TimerCustomFields control={control} errors={errors} /> : null}

          {createSession.error ? (
            <SizableText color="$red10" size="$3">
              セッションの開始に失敗しました。通信環境を確認してもう一度お試しください。
            </SizableText>
          ) : null}

          <Button
            onPress={onSubmit}
            disabled={createSession.isPending}
            themeInverse
            testID="home-start-button"
          >
            {createSession.isPending ? <Spinner /> : '開始する'}
          </Button>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
