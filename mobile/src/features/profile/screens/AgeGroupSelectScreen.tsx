/**
 * 初回オンボーディングの age_group 選択画面。
 *
 * 要件書 5.1「ユーザ登録の際の年齢を反映させる」に対応する年齢区分を収集する。
 * 選択必須、未選択のまま送信不可。送信成功で tabs（ホーム）に置き換え遷移する。
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Button, H2, Paragraph, RadioGroup, SizableText, Spinner, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { useUpdateProfile } from '@/features/profile/hooks/useUpdateProfile';
import { AGE_GROUP_LABELS, AGE_GROUPS, type AgeGroup } from '@/shared/types/user';

const schema = z.object({
  age_group: z.enum(AGE_GROUPS, { required_error: '年代を選択してください' }),
});

type FormValues = z.infer<typeof schema>;

export function AgeGroupSelectScreen() {
  const router = useRouter();
  const updateProfile = useUpdateProfile();
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const onSubmit = handleSubmit(async (values) => {
    await updateProfile.mutateAsync({ age_group: values.age_group });
    router.replace('/(tabs)');
  });

  return (
    <YStack flex={1} padding="$4" gap="$4" justifyContent="center">
      <YStack gap="$2">
        <H2>年代を教えてください</H2>
        <Paragraph theme="alt2">
          学習アドバイスを分かりやすく届けるために、年代区分を入力していただきます。
        </Paragraph>
      </YStack>

      <Controller
        control={control}
        name="age_group"
        render={({ field: { onChange, value } }) => (
          <RadioGroup value={value} onValueChange={(v) => onChange(v as AgeGroup)}>
            <YStack gap="$2">
              {AGE_GROUPS.map((group) => (
                <XStack key={group} alignItems="center" gap="$3">
                  <RadioGroup.Item
                    value={group}
                    id={`age-group-${group}`}
                    testID={`age-group-${group}`}
                    size="$4"
                  >
                    <RadioGroup.Indicator />
                  </RadioGroup.Item>
                  <SizableText htmlFor={`age-group-${group}`} size="$5">
                    {AGE_GROUP_LABELS[group]}
                  </SizableText>
                </XStack>
              ))}
            </YStack>
          </RadioGroup>
        )}
      />

      {errors.age_group ? (
        <SizableText color="$red10" size="$3">
          {errors.age_group.message}
        </SizableText>
      ) : null}

      {updateProfile.error ? (
        <SizableText color="$red10" size="$3">
          保存に失敗しました。通信環境を確認してもう一度お試しください。
        </SizableText>
      ) : null}

      <Button
        onPress={onSubmit}
        disabled={!isValid || updateProfile.isPending}
        themeInverse
        testID="age-group-submit"
      >
        {updateProfile.isPending ? <Spinner /> : '次へ'}
      </Button>
    </YStack>
  );
}
