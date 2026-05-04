import { Pressable, StyleSheet, View } from 'react-native';
import { Circle, Path, Rect, Svg } from 'react-native-svg';
import { SizableText } from 'tamagui';

import type { OutputReviewItem } from '@/features/session/types';

const ICON_COLOR = '#2F2F2F';

export const OUTPUT_HISTORY_ROW_HEIGHT = 27;

export function buildOutputHistoryPreview(content: string | null | undefined): string {
  if (!content) return '';
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 15) return normalized;
  return `${normalized.slice(0, 15)}...`;
}

function PencilIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M10.6973 4.25391C11.056 4.13455 11.444 4.13455 11.8027 4.25391C12.0441 4.33428 12.2342 4.46901 12.3945 4.60547C12.5484 4.7364 12.7189 4.90834 12.9053 5.09473C13.0917 5.28111 13.2636 5.45161 13.3945 5.60547C13.531 5.76581 13.6657 5.95586 13.7461 6.19727C13.8655 6.55596 13.8655 6.94404 13.7461 7.30273C13.6657 7.54414 13.531 7.73418 13.3945 7.89453C13.2636 8.04839 13.0917 8.21889 12.9053 8.40527L7.67188 13.6387C7.50541 13.8051 7.32789 13.9914 7.10059 14.1201C6.87333 14.2487 6.62283 14.3052 6.39453 14.3623L4.77637 14.7656L4.77344 14.7676L4.74023 14.7754C4.58421 14.8144 4.38429 14.867 4.21289 14.8838C4.03218 14.9015 3.67581 14.9024 3.38672 14.6133C3.09762 14.3242 3.09853 13.9678 3.11621 13.7871C3.13298 13.6157 3.1856 13.4158 3.22461 13.2598L3.6377 11.6055C3.69477 11.3772 3.75131 11.1267 3.87988 10.8994C4.00858 10.6721 4.19486 10.4946 4.36133 10.3281L9.59473 5.09473C9.78111 4.90834 9.95161 4.7364 10.1055 4.60547C10.2658 4.46901 10.4559 4.33428 10.6973 4.25391Z"
        stroke={ICON_COLOR}
        strokeWidth={1.5}
      />
      <Path
        d="M9.375 5.625L11.625 4.125L13.875 6.375L12.375 8.625L9.375 5.625Z"
        fill={ICON_COLOR}
      />
    </Svg>
  );
}

function PicIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M2.25 6.25C2.25 4.04086 4.04086 2.25 6.25 2.25H11.75C13.9591 2.25 15.75 4.04086 15.75 6.25V11.75C15.75 13.9591 13.9591 15.75 11.75 15.75H6.25C4.04086 15.75 2.25 13.9591 2.25 11.75V6.25Z"
        stroke={ICON_COLOR}
        strokeWidth={1.5}
      />
      <Path
        d="M2.25 11.25L3.9305 9.5695C4.81282 8.68718 6.2788 8.81935 6.98908 9.84526L7.76644 10.9681C8.43112 11.9281 9.77349 12.117 10.6773 11.3776L11.7241 10.521C12.5194 9.87039 13.6783 9.92821 14.4048 10.6548L15.75 12"
        stroke={ICON_COLOR}
        strokeWidth={1.5}
      />
      <Circle cx={12} cy={6} r={1.5} fill={ICON_COLOR} />
    </Svg>
  );
}

function MicIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Rect
        x={6.75}
        y={2.25}
        width={4.5}
        height={8.25}
        rx={2.25}
        stroke={ICON_COLOR}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M3.75 8.25C3.75 9.64239 4.30312 10.9777 5.28769 11.9623C6.27226 12.9469 7.60761 13.5 9 13.5C10.3924 13.5 11.7277 12.9469 12.7123 11.9623C13.6969 10.9777 14.25 9.64239 14.25 8.25"
        stroke={ICON_COLOR}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 15.75V14.25"
        stroke={ICON_COLOR}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
      style={({ pressed }) => [pressed && isPressable ? styles.rowPressed : null]}
      testID={testID}
    >
      <View style={styles.row}>
        <View style={styles.icon}>
          {item.output.kind === 'image' ? (
            <PicIcon />
          ) : (item.output.kind as string) === 'voice' ? (
            <MicIcon />
          ) : (
            <PencilIcon />
          )}
        </View>
        <SizableText style={styles.text} numberOfLines={1}>
          {item.output.kind === 'image'
            ? '画像で提出したアウトプット'
            : buildOutputHistoryPreview(item.output.content)}
        </SizableText>
        <SizableText style={styles.cycle} numberOfLines={1}>
          サイクル{item.cycle_index}
        </SizableText>
      </View>
      {!isLast && <View style={styles.rowDivider} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  rowDivider: {
    height: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#CDCDCD',
    alignSelf: 'stretch',
  },
  rowPressed: {
    opacity: 0.72,
  },
  icon: {
    width: 18,
    height: 18,
    alignItems: 'center',
  },
  text: {
    flex: 1,
    color: '#000000',
    fontFamily: 'HiraginoSans-W4',
    fontSize: 10,
    lineHeight: 18,
  },
  cycle: {
    maxWidth: 65,
    color: '#676767',
    fontFamily: 'HiraginoSans-W4',
    fontSize: 10,
    lineHeight: 18,
    textAlign: 'right',
  },
});
