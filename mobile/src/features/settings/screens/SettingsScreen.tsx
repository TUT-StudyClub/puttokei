/**
 * 設定画面 (S-012)。ホーム右上の設定アイコンから遷移し、
 * タイマー設定 / システム設定 / 個人の情報 をカード UI で提供する。
 *
 * タイマー時間と通知は「行タップ → モーダルから選択」で即 PATCH する。
 * 言語は backend 未対応のため当面はローカルステートで保持する。
 * ログアウト / アカウント削除はいずれも Alert.alert の確認ダイアログを挟む。
 */
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { SizableText, Spinner } from 'tamagui';

import {
  ActionRow,
  Card,
  ChevronLeftIcon,
  LANGUAGE_OPTIONS,
  type LanguageValue,
  PickerModal,
  type PickerState,
  RowSeparator,
  Section,
  type TimerField,
  ValueRow,
} from '@/features/settings/components/SettingsRows';
import { useDeleteAccount } from '@/features/settings/hooks/useDeleteAccount';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useUpdateSettings } from '@/features/settings/hooks/useUpdateSettings';
import { isApiError } from '@/shared/lib/api';
import { APP_ROUTES } from '@/shared/lib/routes';
import { useAuthStore } from '@/shared/stores/authStore';
import type { UpdateUserSettingsInput } from '@/shared/types/userSettings';

export function SettingsScreen() {
  const router = useRouter();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const deleteAccount = useDeleteAccount();
  const clearAuth = useAuthStore((s) => s.clear);
  const [picker, setPicker] = useState<PickerState>(null);
  const [language, setLanguage] = useState<LanguageValue>('ja');

  const settings = settingsQuery.data;
  const hasSettings = settings !== undefined;
  // 初期取得中 (まだ一度も成功していない) はスピナー、失敗したらエラービュー、成功したら中身を出す。
  // settingsQuery.isError を見ないと、GET が 500 などで落ちたときにずっとスピナーのままになる。
  const showLoading = !hasSettings && !settingsQuery.isError;
  const showError = !hasSettings && settingsQuery.isError;
  const errorMessage = resolveErrorMessage(updateSettings.error ?? deleteAccount.error);

  const onSelectMinutes = (field: TimerField, value: number) => {
    setPicker(null);
    if (settings && settings[field] === value) return;
    const patch: UpdateUserSettingsInput = { [field]: value };
    updateSettings.mutate(patch);
  };

  const onSelectNotification = (value: boolean) => {
    setPicker(null);
    if (settings && settings.notification_enabled === value) return;
    updateSettings.mutate({ notification_enabled: value });
  };

  const onSelectLanguage = (value: LanguageValue) => {
    setPicker(null);
    setLanguage(value);
  };

  const onPressLogout = () => {
    Alert.alert('ログアウトしますか？', '再度ご利用いただくにはサインインが必要です。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウトする',
        style: 'destructive',
        onPress: () => {
          clearAuth();
          router.replace(APP_ROUTES.authSignIn);
        },
      },
    ]);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="戻る"
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backButton, pressed ? styles.headerButtonPressed : null]}
          testID="settings-back-button"
        >
          <ChevronLeftIcon />
        </Pressable>
        <SizableText style={styles.headerTitle}>設定</SizableText>
        <View style={styles.headerRightSpacer} />
      </View>

      {showLoading ? (
        <View style={styles.loadingContainer} testID="settings-loading">
          <Spinner />
        </View>
      ) : showError ? (
        <View style={styles.errorContainer} testID="settings-fetch-error">
          <SizableText style={styles.errorMessage}>
            {resolveErrorMessage(settingsQuery.error) ??
              '設定の取得に失敗しました。通信環境を確認してもう一度お試しください。'}
          </SizableText>
          <Pressable
            accessibilityRole="button"
            onPress={() => void settingsQuery.refetch()}
            disabled={settingsQuery.isFetching}
            style={({ pressed }) => [
              styles.retryButton,
              pressed ? styles.retryButtonPressed : null,
              settingsQuery.isFetching ? styles.retryButtonDisabled : null,
            ]}
            testID="settings-retry"
          >
            {settingsQuery.isFetching ? (
              <Spinner color="#FFFFFF" />
            ) : (
              <SizableText style={styles.retryButtonText}>再取得する</SizableText>
            )}
          </Pressable>
        </View>
      ) : settings ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          testID="settings-root"
          showsVerticalScrollIndicator={false}
        >
          <Section title="タイマー設定">
            <Card>
              <ValueRow
                label="インプット時間"
                value={`${settings.input_minutes}分`}
                onPress={() =>
                  setPicker({
                    kind: 'minutes',
                    field: 'input_minutes',
                    title: 'インプット時間',
                    current: settings.input_minutes,
                  })
                }
                testID="settings-row-input-minutes"
              />
              <RowSeparator />
              <ValueRow
                label="アウトプット時間"
                value={`${settings.output_minutes}分`}
                onPress={() =>
                  setPicker({
                    kind: 'minutes',
                    field: 'output_minutes',
                    title: 'アウトプット時間',
                    current: settings.output_minutes,
                  })
                }
                testID="settings-row-output-minutes"
              />
              <RowSeparator />
              <ValueRow
                label="休憩時間"
                value={`${settings.break_minutes}分`}
                onPress={() =>
                  setPicker({
                    kind: 'minutes',
                    field: 'break_minutes',
                    title: '休憩時間',
                    current: settings.break_minutes,
                  })
                }
                testID="settings-row-break-minutes"
                isLast
              />
            </Card>
          </Section>

          <Section title="システム設定">
            <Card>
              <ValueRow
                label="通知"
                value={settings.notification_enabled ? 'あり' : 'なし'}
                onPress={() =>
                  setPicker({
                    kind: 'notification',
                    current: settings.notification_enabled,
                  })
                }
                testID="settings-row-notification"
              />
              <RowSeparator />
              <ValueRow
                label="言語"
                value={LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? '日本語'}
                onPress={() => setPicker({ kind: 'language', current: language })}
                testID="settings-row-language"
                isLast
              />
            </Card>
          </Section>

          <Section title="個人の情報">
            <Card>
              <ActionRow label="ログアウト" onPress={onPressLogout} testID="settings-logout" />
              <RowSeparator />
              <ActionRow
                label="アカウント削除"
                destructive
                disabled={deleteAccount.isPending}
                onPress={onPressDelete}
                testID="settings-delete-account"
                isLast
              />
            </Card>
          </Section>

          {errorMessage ? (
            <SizableText style={styles.errorText} testID="settings-error">
              {errorMessage}
            </SizableText>
          ) : null}
        </ScrollView>
      ) : null}

      <PickerModal
        state={picker}
        onClose={() => setPicker(null)}
        onSelectMinutes={onSelectMinutes}
        onSelectNotification={onSelectNotification}
        onSelectLanguage={onSelectLanguage}
      />
    </SafeAreaView>
  );
}

function resolveErrorMessage(error: Error | null | undefined): string | null {
  if (!error) return null;
  if (isApiError(error)) {
    return error.problem?.detail ?? error.problem?.title ?? '保存に失敗しました。';
  }
  return '通信に失敗しました。時間をおいて再度お試しください。';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonPressed: {
    opacity: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerRightSpacer: {
    width: 32,
    height: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  errorMessage: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#4B5CFF',
  },
  retryButtonPressed: {
    opacity: 0.85,
  },
  retryButtonDisabled: {
    opacity: 0.6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  errorText: {
    marginTop: 16,
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
  },
});
