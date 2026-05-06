/**
 * アウトプット本文を表示し、判定の誤り指摘に対応する部分を赤色下線付きで表示する。
 * 赤い部分をタップすると onSelect(correctionIndex) が呼ばれる。
 *
 * ハイライトの表示のみを担当し、正解 / 解説のポップオーバーは呼び出し側で描画する。
 */
import { useRef } from 'react';
import {
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
} from 'react-native';

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

type CorrectionSegment = Extract<OutputSegment, { type: 'correction' }>;

type CorrectionHighlightProps = {
  segment: CorrectionSegment;
  selectedCorrectionIndex: number | null;
  onSelectCorrection: (correctionIndex: number, pageX?: number, pageY?: number) => void;
  textStyle?: StyleProp<TextStyle>;
};

function CorrectionHighlight({
  segment,
  selectedCorrectionIndex,
  onSelectCorrection,
  textStyle,
}: CorrectionHighlightProps) {
  const ref = useRef<Text>(null);
  const selected = selectedCorrectionIndex === segment.correctionIndex;

  const handlePress = (event: GestureResponderEvent) => {
    const tapPageX = event?.nativeEvent?.pageX;
    const tapPageY = event?.nativeEvent?.pageY;

    onSelectCorrection(segment.correctionIndex);

    if (tapPageX !== undefined && tapPageY !== undefined) {
      onSelectCorrection(segment.correctionIndex, tapPageX, tapPageY);
    }

    (ref.current as unknown as { measureInWindow?: Function } | null)?.measureInWindow?.(
      (x: number, _y: number, w: number, _h: number) => {
        if (w > 0 && tapPageY !== undefined) {
          onSelectCorrection(segment.correctionIndex, x + w / 2, tapPageY);
        }
      },
    );
  };

  return (
    <Text
      ref={ref}
      accessibilityRole="button"
      onPress={handlePress}
      style={[
        textStyle,
        {
          color: HIGHLIGHT_COLOR,
          textDecorationLine: 'underline',
          fontWeight: selected ? '700' : '500',
        },
      ]}
      testID={`correction-highlight-${segment.correctionIndex}`}
    >
      {segment.text}
    </Text>
  );
}

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
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }} testID={testID}>
      {segments.map((segment, index) => {
        if (segment.type === 'plain') {
          return (
            <Text key={index} style={textStyle}>
              {segment.text}
            </Text>
          );
        }
        return (
          <CorrectionHighlight
            key={index}
            segment={segment}
            selectedCorrectionIndex={selectedCorrectionIndex}
            onSelectCorrection={onSelectCorrection}
            textStyle={textStyle}
          />
        );
      })}
    </View>
  );
}
