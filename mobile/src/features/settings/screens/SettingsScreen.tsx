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
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { SizableText, Spinner } from 'tamagui';

import { useDeleteAccount } from '@/features/settings/hooks/useDeleteAccount';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useUpdateSettings } from '@/features/settings/hooks/useUpdateSettings';
import { isApiError } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/authStore';
import type { UpdateUserSettingsInput } from '@/shared/types/userSettings';

// タイマーのプリセット値。backend の許容範囲 (1〜180 分) に収めた代表値を並べる。
const MINUTE_OPTIONS = [1, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180] as const;

const NOTIFICATION_OPTIONS = [
  { value: true, label: 'あり' },
  { value: false, label: 'なし' },
] as const;

// backend の UserSettings に language フィールドが無いため、当面は画面内ローカル状態で扱う。
// 実際の i18n は未実装で、選択値は UI 表示のみに反映する。
const LANGUAGE_OPTIONS = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
] as const;
type LanguageValue = (typeof LANGUAGE_OPTIONS)[number]['value'];

type TimerField = 'input_minutes' | 'output_minutes' | 'break_minutes';

type PickerState =
  | { kind: 'minutes'; field: TimerField; title: string; current: number }
  | { kind: 'notification'; current: boolean }
  | { kind: 'language'; current: LanguageValue }
  | null;

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
    Alert.alert(
      'ログアウトしますか？',
      '再度ご利用いただくにはサインインが必要です。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログアウトする',
          style: 'destructive',
          onPress: () => {
            clearAuth();
            router.replace('/(auth)/sign-in');
          },
        },
      ],
    );
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

// --- Section / Card / Row ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <SizableText style={styles.sectionTitle}>{title}</SizableText>
      {children}
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function RowSeparator() {
  return <View style={styles.rowSeparator} />;
}

type ValueRowProps = {
  label: string;
  value: string;
  onPress?: () => void;
  testID?: string;
  isLast?: boolean;
};

function ValueRow({ label, value, onPress, testID, isLast }: ValueRowProps) {
  const content = (
    <View style={[styles.row, isLast ? styles.rowLast : null]}>
      <SizableText style={styles.rowLabel}>{label}</SizableText>
      <View style={styles.rowTrailing}>
        <SizableText style={styles.rowValue}>{value}</SizableText>
        {onPress ? <ChevronDownIcon /> : null}
      </View>
    </View>
  );

  if (!onPress) {
    return (
      <View testID={testID} accessibilityRole="text">
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.rowPressed : null]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

type ActionRowProps = {
  label: string;
  trailingText?: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
  isLast?: boolean;
};

function ActionRow({
  label,
  trailingText,
  destructive,
  disabled,
  onPress,
  testID,
  isLast,
}: ActionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        pressed ? styles.rowPressed : null,
        disabled ? styles.rowDisabled : null,
      ]}
      testID={testID}
    >
      <View style={[styles.row, isLast ? styles.rowLast : null]}>
        <SizableText style={[styles.rowLabel, destructive ? styles.rowLabelDestructive : null]}>
          {label}
        </SizableText>
        {trailingText ? (
          <SizableText style={styles.rowTrailingAction}>{trailingText}</SizableText>
        ) : null}
      </View>
    </Pressable>
  );
}

// --- Picker Modal ---

type PickerModalProps = {
  state: PickerState;
  onClose: () => void;
  onSelectMinutes: (field: TimerField, value: number) => void;
  onSelectNotification: (value: boolean) => void;
  onSelectLanguage: (value: LanguageValue) => void;
};

function PickerModal({
  state,
  onClose,
  onSelectMinutes,
  onSelectNotification,
  onSelectLanguage,
}: PickerModalProps) {
  return (
    <Modal
      visible={state !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID="settings-picker-modal"
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose} accessibilityLabel="閉じる">
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />
          {state?.kind === 'minutes' ? (
            <>
              <SizableText style={styles.modalTitle}>{state.title}</SizableText>
              <ScrollView
                style={styles.modalList}
                contentContainerStyle={styles.modalListContent}
                showsVerticalScrollIndicator={false}
              >
                {MINUTE_OPTIONS.map((value) => {
                  const selected = value === state.current;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => onSelectMinutes(state.field, value)}
                      style={({ pressed }) => [
                        styles.modalOption,
                        pressed ? styles.modalOptionPressed : null,
                      ]}
                      testID={`settings-picker-option-${value}`}
                    >
                      <SizableText
                        style={[
                          styles.modalOptionLabel,
                          selected ? styles.modalOptionLabelSelected : null,
                        ]}
                      >
                        {`${value}分`}
                      </SizableText>
                      {selected ? <CheckIcon /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {state?.kind === 'notification' ? (
            <>
              <SizableText style={styles.modalTitle}>通知</SizableText>
              <View style={styles.modalList}>
                {NOTIFICATION_OPTIONS.map((opt) => {
                  const selected = opt.value === state.current;
                  return (
                    <Pressable
                      key={String(opt.value)}
                      onPress={() => onSelectNotification(opt.value)}
                      style={({ pressed }) => [
                        styles.modalOption,
                        pressed ? styles.modalOptionPressed : null,
                      ]}
                      testID={`settings-picker-notification-${opt.value ? 'on' : 'off'}`}
                    >
                      <SizableText
                        style={[
                          styles.modalOptionLabel,
                          selected ? styles.modalOptionLabelSelected : null,
                        ]}
                      >
                        {opt.label}
                      </SizableText>
                      {selected ? <CheckIcon /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {state?.kind === 'language' ? (
            <>
              <SizableText style={styles.modalTitle}>言語</SizableText>
              <View style={styles.modalList}>
                {LANGUAGE_OPTIONS.map((opt) => {
                  const selected = opt.value === state.current;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => onSelectLanguage(opt.value)}
                      style={({ pressed }) => [
                        styles.modalOption,
                        pressed ? styles.modalOptionPressed : null,
                      ]}
                      testID={`settings-picker-language-${opt.value}`}
                    >
                      <SizableText
                        style={[
                          styles.modalOptionLabel,
                          selected ? styles.modalOptionLabelSelected : null,
                        ]}
                      >
                        {opt.label}
                      </SizableText>
                      {selected ? <CheckIcon /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// --- Icons ---

function ChevronLeftIcon({ color = '#1F2937', size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 5 L7 12 L15 19"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronDownIcon({ color = '#9CA3AF', size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 9 L12 16 L19 9"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckIcon({ color = '#4B5CFF', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5 L10 17.5 L19 7"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
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
  section: {
    marginTop: 24,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: '#F3F4F6',
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowSeparator: {
    height: 0,
  },
  rowLabel: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  rowLabelDestructive: {
    color: '#DC2626',
  },
  rowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: 15,
    color: '#6B7280',
  },
  rowTrailingAction: {
    fontSize: 14,
    color: '#6B7280',
  },
  errorText: {
    marginTop: 16,
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    paddingBottom: 24,
    paddingHorizontal: 16,
    maxHeight: '70%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalList: {
    flexGrow: 0,
  },
  modalListContent: {
    paddingBottom: 8,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
  },
  modalOptionPressed: {
    backgroundColor: '#F3F4F6',
  },
  modalOptionLabel: {
    fontSize: 16,
    color: '#111827',
  },
  modalOptionLabelSelected: {
    color: '#4B5CFF',
    fontWeight: '700',
  },
});
