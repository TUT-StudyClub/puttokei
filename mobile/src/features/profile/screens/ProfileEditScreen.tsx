/**
 * プロフィール編集画面。
 *
 * 設定画面（SettingsScreen）から遷移し、display_name と age_group を変更できる。
 * 既存の useProfile / useUpdateProfile を再利用し、保存成功後は router.back() で
 * 設定画面に戻る。
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Button,
  H2,
  Input,
  Paragraph,
  RadioGroup,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from 'tamagui';
import { z } from 'zod';

import { useProfile } from '@/features/profile/hooks/useProfile';
import { useUpdateProfile } from '@/features/profile/hooks/useUpdateProfile';
import { isApiError } from '@/shared/lib/api';
import { AGE_GROUP_LABELS, AGE_GROUPS, type AgeGroup } from '@/shared/types/user';

const schema = z.object({
  display_name: z.string().trim().max(50, '50 文字以内で入力してください'),
  age_group: z.enum(AGE_GROUPS, { required_error: '年代を選択してください' }),
});

type FormValues = z.infer<typeof schema>;

const DEFAULT_AGE_GROUP: AgeGroup = '20s';

export function ProfileEditScreen() {
  const router = useRouter();
  const profileQuery = useProfile();
  const updateProfile = useUpdateProfile();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { display_name: '', age_group: DEFAULT_AGE_GROUP },
    mode: 'onChange',
  });

  useEffect(() => {
    const profile = profileQuery.data;
    if (profile === undefined) return;
    reset({
      display_name: profile.display_name ?? '',
      age_group: profile.age_group ?? DEFAULT_AGE_GROUP,
    });
  }, [profileQuery.data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await updateProfile.mutateAsync({
      // 空文字は null として送り、display_name 未設定状態を許容する。
      display_name: values.display_name === '' ? null : values.display_name,
      age_group: values.age_group,
    });
    router.back();
  });

  const isInitialLoading = profileQuery.isLoading || profileQuery.data === undefined;
  const errorMessage = resolveErrorMessage(updateProfile.error);

  if (isInitialLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
        <Spinner />
      </YStack>
    );
  }

  return (
    <YStack flex={1} padding="$4" gap="$4" testID="profile-edit-root">
      <YStack gap="$2">
        <H2>プロフィール編集</H2>
        <Paragraph theme="alt2">表示名と年代を変更できます。</Paragraph>
      </YStack>

      <YStack gap="$2">
        <SizableText size="$3">表示名</SizableText>
        <Controller
          control={control}
          name="display_name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="（任意）"
              testID="profile-display-name"
            />
          )}
        />
        {errors.display_name ? (
          <SizableText color="$red10" size="$2">
            {errors.display_name.message}
          </SizableText>
        ) : null}
      </YStack>

      <YStack gap="$2">
        <SizableText size="$3">年代</SizableText>
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
                      id={`profile-age-group-${group}`}
                      testID={`profile-age-group-${group}`}
                      size="$4"
                    >
                      <RadioGroup.Indicator />
                    </RadioGroup.Item>
                    <SizableText htmlFor={`profile-age-group-${group}`} size="$4">
                      {AGE_GROUP_LABELS[group]}
                    </SizableText>
                  </XStack>
                ))}
              </YStack>
            </RadioGroup>
          )}
        />
        {errors.age_group ? (
          <SizableText color="$red10" size="$2">
            {errors.age_group.message}
          </SizableText>
        ) : null}
      </YStack>

      {errorMessage ? (
        <SizableText color="$red10" size="$3" testID="profile-edit-error">
          {errorMessage}
        </SizableText>
      ) : null}

      <Button
        onPress={onSubmit}
        disabled={!isDirty || !isValid || updateProfile.isPending}
        themeInverse
        testID="profile-edit-save"
      >
        {updateProfile.isPending ? <Spinner /> : '保存'}
      </Button>
    </YStack>
  );
}

function resolveErrorMessage(error: Error | null | undefined): string | null {
  if (!error) return null;
  if (isApiError(error)) {
    return error.problem?.detail ?? error.problem?.title ?? '保存に失敗しました。';
  }
  return '通信に失敗しました。時間をおいて再度お試しください。';
}
