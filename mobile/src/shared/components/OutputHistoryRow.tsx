import { Pressable, StyleSheet, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { SizableText } from 'tamagui';

import type { OutputReviewItem } from '@/features/session/types';

const ROW_BORDER_COLOR = '#D0D0D0';
const ICON_COLOR = '#2F2F2F';
const TEXT_COLOR = '#111111';
const CYCLE_COLOR = '#6B6B6B';

export const OUTPUT_HISTORY_ROW_HEIGHT = 40;

export function buildOutputHistoryPreview(content: string | null | undefined): string {
  if (!content) return '';
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 15) return normalized;
  return `${normalized.slice(0, 15)}...`;
}

function PencilIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 16.7 V20 H7.3 L18.6 8.7 L15.3 5.4 L4 16.7 Z"
        stroke={ICON_COLOR}
        strokeWidth={2.2}
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M14.2 6.5 L17.5 9.8" stroke={ICON_COLOR} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

type Props = {
  item: OutputReviewItem;
  onPress?: (item: OutputReviewItem) => void;
  isLast?: boolean;
  testID?: string;
};

/**
 * セッション・統計の両画面で共有するアウトプット履歴の 1 行。
 * インプット画面の「今日のアウトプット」と統計画面の「アウトプット履歴」の見た目を揃える。
 */
export function OutputHistoryRow({ item, onPress, isLast = false, testID }: Props) {
  const isPressable = onPress !== undefined;
  return (
    <Pressable
      accessibilityRole={isPressable ? 'button' : undefined}
      disabled={!isPressable}
      onPress={() => onPress?.(item)}
      style={({ pressed }) => [
        styles.row,
        !isLast ? styles.rowBorder : null,
        pressed && isPressable ? styles.rowPressed : null,
      ]}
      testID={testID}
    >
      <View style={styles.icon}>
        <PencilIcon />
      </View>
      <SizableText style={styles.text} numberOfLines={1}>
        {item.output.kind === 'image'
          ? '画像で提出したアウトプット'
          : buildOutputHistoryPreview(item.output.content)}
      </SizableText>
      <SizableText style={styles.cycle}>サイクル{item.cycle_index}</SizableText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: OUTPUT_HISTORY_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ROW_BORDER_COLOR,
  },
  rowPressed: {
    opacity: 0.72,
  },
  icon: {
    width: 20,
    alignItems: 'center',
  },
  text: {
    flex: 1,
    color: TEXT_COLOR,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  cycle: {
    color: CYCLE_COLOR,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
});
