import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { SizableText } from 'tamagui';

// タイマーのプリセット値。backend の許容範囲 (1〜120 分、セッション作成 / 設定保存で共通)
// に収めた代表値を並べる。
const MINUTE_OPTIONS = [1, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120] as const;

const NOTIFICATION_OPTIONS = [
  { value: true, label: 'あり' },
  { value: false, label: 'なし' },
] as const;

// backend の UserSettings に language フィールドが無いため、当面は画面内ローカル状態で扱う。
export const LANGUAGE_OPTIONS = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
] as const;

export type LanguageValue = (typeof LANGUAGE_OPTIONS)[number]['value'];
export type TimerField = 'input_minutes' | 'output_minutes' | 'break_minutes';

export type PickerState =
  | { kind: 'minutes'; field: TimerField; title: string; current: number }
  | { kind: 'notification'; current: boolean }
  | { kind: 'language'; current: LanguageValue }
  | null;

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <SizableText style={styles.sectionTitle}>{title}</SizableText>
      {children}
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function RowSeparator() {
  return <View style={styles.rowSeparator} />;
}

type ValueRowProps = {
  label: string;
  value: string;
  onPress?: () => void;
  testID?: string;
  isLast?: boolean;
};

export function ValueRow({ label, value, onPress, testID, isLast }: ValueRowProps) {
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

export function ActionRow({
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

type PickerModalProps = {
  state: PickerState;
  onClose: () => void;
  onSelectMinutes: (field: TimerField, value: number) => void;
  onSelectNotification: (value: boolean) => void;
  onSelectLanguage: (value: LanguageValue) => void;
};

export function PickerModal({
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

export function ChevronLeftIcon({
  color = '#1F2937',
  size = 22,
}: {
  color?: string;
  size?: number;
}) {
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

const styles = StyleSheet.create({
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
