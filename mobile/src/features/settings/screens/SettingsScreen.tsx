/**
 * 設定画面。要件書 3.2.6 のうち、
 * - タイマー時間（input/output/break_minutes）の編集と保存
 * - 通知トグル（notification_enabled）の即時保存
 * - プロフィール編集 / ログアウト / アカウント削除への導線
 * を提供する。
 *
 * タイマーは保存ボタン押下で PATCH。通知は Switch を切り替えた瞬間に PATCH する。
 * アカウント削除は React Native の Alert.alert を確認ダイアログとして利用し、確定後に
 * useDeleteAccount → AuthGate のリダイレクトで /(auth)/sign-in に戻す。
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import {
  Button,
  H2,
  Input,
  Paragraph,
  Separator,
  SizableText,
  Spinner,
  Switch,
  XStack,
  YStack,
} from 'tamagui';

import { useDeleteAccount } from '@/features/settings/hooks/useDeleteAccount';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useUpdateSettings } from '@/features/settings/hooks/useUpdateSettings';
import {
  type TimerFormParsed,
  type TimerFormValues,
  timerFormSchema,
} from '@/features/settings/lib/userSettingsSchema';
import { isApiError } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/authStore';

const DEFAULT_FORM: TimerFormValues = {
  input_minutes: '20',
  output_minutes: '5',
  break_minutes: '5',
};

export function SettingsScreen() {
  const router = useRouter();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const deleteAccount = useDeleteAccount();
  const clearAuth = useAuthStore((s) => s.clear);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid },
  } = useForm<TimerFormValues, unknown, TimerFormParsed>({
    resolver: zodResolver(timerFormSchema),
    defaultValues: DEFAULT_FORM,
    mode: 'onChange',
  });

  // 取得した最新値でフォームの defaultValues を上書きする。
  // reset で isDirty が false に戻るので、保存ボタンの活性化が変更時のみになる。
  useEffect(() => {
    const data = settingsQuery.data;
    if (data === undefined) return;
    reset({
      input_minutes: String(data.input_minutes),
      output_minutes: String(data.output_minutes),
      break_minutes: String(data.break_minutes),
    });
  }, [settingsQuery.data, reset]);

  const onSaveTimer = handleSubmit(async (parsed) => {
    await updateSettings.mutateAsync({
      input_minutes: parsed.input_minutes,
      output_minutes: parsed.output_minutes,
      break_minutes: parsed.break_minutes,
    });
  });

  const onToggleNotification = (next: boolean) => {
    updateSettings.mutate({ notification_enabled: next });
  };

  const onPressLogout = () => {
    clearAuth();
    router.replace('/(auth)/sign-in');
  };

  const onPressDelete = () => {
    Alert.alert(
      'アカウントを削除しますか？',
      'タイマー設定や学習履歴を含むすべてのデータが削除されます。この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            // mutateAsync の例外は onError 経由でエラー表示に流すため、ここでは握り潰す。
            void deleteAccount.mutateAsync();
          },
        },
      ],
    );
  };

  const isInitialLoading = settingsQuery.isLoading || settingsQuery.data === undefined;
  const notificationEnabled = settingsQuery.data?.notification_enabled ?? true;
  const errorMessage = resolveErrorMessage(updateSettings.error ?? deleteAccount.error);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <YStack padding="$4" gap="$5" testID="settings-root">
        <H2>設定</H2>

        {isInitialLoading ? (
          <YStack alignItems="center" padding="$4">
            <Spinner />
          </YStack>
        ) : (
          <>
            <YStack gap="$3" testID="settings-timer-section">
              <H2 size="$6">タイマー設定 (分)</H2>
              <Paragraph theme="alt2" size="$2">
                1 〜 180 分の範囲で指定できます。
              </Paragraph>

              <YStack gap="$2">
                <SizableText size="$3">インプット時間</SizableText>
                <Controller
                  control={control}
                  name="input_minutes"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      keyboardType="number-pad"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      testID="settings-input-minutes"
                    />
                  )}
                />
                {errors.input_minutes ? (
                  <SizableText color="$red10" size="$2">
                    {errors.input_minutes.message}
                  </SizableText>
                ) : null}
              </YStack>

              <YStack gap="$2">
                <SizableText size="$3">アウトプット時間</SizableText>
                <Controller
                  control={control}
                  name="output_minutes"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      keyboardType="number-pad"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      testID="settings-output-minutes"
                    />
                  )}
                />
                {errors.output_minutes ? (
                  <SizableText color="$red10" size="$2">
                    {errors.output_minutes.message}
                  </SizableText>
                ) : null}
              </YStack>

              <YStack gap="$2">
                <SizableText size="$3">休憩時間</SizableText>
                <Controller
                  control={control}
                  name="break_minutes"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      keyboardType="number-pad"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      testID="settings-break-minutes"
                    />
                  )}
                />
                {errors.break_minutes ? (
                  <SizableText color="$red10" size="$2">
                    {errors.break_minutes.message}
                  </SizableText>
                ) : null}
              </YStack>

              <Button
                onPress={onSaveTimer}
                disabled={!isDirty || !isValid || updateSettings.isPending}
                themeInverse
                testID="settings-timer-save"
              >
                {updateSettings.isPending ? <Spinner /> : '保存'}
              </Button>
            </YStack>

            <Separator />

            <YStack gap="$3" testID="settings-notification-section">
              <H2 size="$6">通知</H2>
              <XStack alignItems="center" justifyContent="space-between">
                <SizableText>リマインダー通知</SizableText>
                <Switch
                  checked={notificationEnabled}
                  onCheckedChange={onToggleNotification}
                  testID="settings-notification-switch"
                >
                  <Switch.Thumb animation="quick" />
                </Switch>
              </XStack>
            </YStack>

            <Separator />

            <YStack gap="$3">
              <H2 size="$6">プロフィール</H2>
              <Pressable
                onPress={() => router.push('/profile/edit')}
                testID="settings-nav-profile-edit"
              >
                <XStack
                  paddingVertical="$3"
                  paddingHorizontal="$3"
                  borderRadius="$3"
                  backgroundColor="$backgroundHover"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <SizableText>プロフィール編集</SizableText>
                  <SizableText theme="alt2">›</SizableText>
                </XStack>
              </Pressable>
            </YStack>

            <Separator />

            <YStack gap="$3">
              <H2 size="$6">アカウント</H2>
              <Button onPress={onPressLogout} testID="settings-logout">
                ログアウト
              </Button>
              <Button
                onPress={onPressDelete}
                theme="red"
                disabled={deleteAccount.isPending}
                testID="settings-delete-account"
              >
                {deleteAccount.isPending ? <Spinner /> : 'アカウントを削除'}
              </Button>
            </YStack>

            {errorMessage ? (
              <SizableText color="$red10" size="$3" testID="settings-error">
                {errorMessage}
              </SizableText>
            ) : null}
          </>
        )}
      </YStack>
    </ScrollView>
  );
}

function resolveErrorMessage(error: Error | null | undefined): string | null {
  if (!error) return null;
  if (isApiError(error)) {
    return error.problem?.detail ?? error.problem?.title ?? '保存に失敗しました。';
  }
  return '通信に失敗しました。時間をおいて再度お試しください。';
}
