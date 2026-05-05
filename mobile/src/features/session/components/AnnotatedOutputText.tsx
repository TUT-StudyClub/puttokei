/**
 * アウトプット本文を表示し、判定の誤り指摘に対応する部分を赤色下線付きで表示する。
 * 赤い部分をタップすると onSelect(correctionIndex) が呼ばれる。
 *
 * ハイライトの表示のみを担当し、正解 / 解説のポップオーバーは呼び出し側で描画する。
 */
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { buildOutputSegments, type OutputSegment } from '@/features/session/lib/outputAnnotation';
import type { JudgmentCorrection } from '@/features/session/types';

type AnnotatedOutputTextProps = {
  content: string;
  corrections: readonly JudgmentCorrection[];
  selectedCorrectionIndex: number | null;
  onSelectCorrection: (correctionIndex: number, pageX?: number, pageY?: number) => void;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
};

const HIGHLIGHT_COLOR = '#D92D20';

export function AnnotatedOutputText({
  content,
  corrections,
  selectedCorrectionIndex,
  onSelectCorrection,
  textStyle,
  testID,
}: AnnotatedOutputTextProps) {
  const segments = buildOutputSegments(content, corrections);

  return (
    <Text style={textStyle} testID={testID}>
      {segments.map((segment, index) =>
        renderSegment(segment, index, selectedCorrectionIndex, onSelectCorrection),
      )}
    </Text>
  );
}

function renderSegment(
  segment: OutputSegment,
  index: number,
  selectedCorrectionIndex: number | null,
  onSelectCorrection: (correctionIndex: number, pageX?: number, pageY?: number) => void,
) {
  if (segment.type === 'plain') {
    return <Text key={index}>{segment.text}</Text>;
  }
  const selected = selectedCorrectionIndex === segment.correctionIndex;
  return (
    <Text
      key={index}
      accessibilityRole="button"
      onPress={(event) =>
        onSelectCorrection(
          segment.correctionIndex,
          event.nativeEvent.pageX,
          event.nativeEvent.pageY,
        )
      }
      style={{
        color: HIGHLIGHT_COLOR,
        textDecorationLine: 'underline',
        fontWeight: selected ? '700' : '500',
      }}
      testID={`correction-highlight-${segment.correctionIndex}`}
    >
      {segment.text}
    </Text>
  );
}
