/**
 * 提出済みの画像アウトプットを表示し、判定の bbox 付き誤り指摘を
 * 赤い下線オーバーレイとして重ねる。
 *
 * 赤線をタップすると onSelectCorrection(correctionIndex) が呼ばれる。
 * 正解 / 解説の popover 表示は呼び出し側で描画する（AnnotatedOutputText と同じ責務分担）。
 *
 * 画像は `resizeMode='contain'` で描画される前提で、コンテナ幅と画像のアスペクト比から
 * 実描画領域 (letterbox を除いた範囲) を算出して bbox 座標を絶対位置に変換する。
 */
import { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { JudgmentCorrection } from '@/features/session/types';

type AnnotatedOutputImageProps = {
  imageUrl: string;
  corrections: readonly JudgmentCorrection[];
  selectedCorrectionIndex: number | null;
  onSelectCorrection: (correctionIndex: number) => void;
  containerStyle?: StyleProp<ViewStyle>;
  imageHeight?: number;
  testID?: string;
};

const HIGHLIGHT_COLOR = '#D92D20';
const UNDERLINE_THICKNESS = 3;
const TAP_PADDING = 6;

export function AnnotatedOutputImage({
  imageUrl,
  corrections,
  selectedCorrectionIndex,
  onSelectCorrection,
  containerStyle,
  imageHeight = 320,
  testID,
}: AnnotatedOutputImageProps) {
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

  const handleImageLoad = useCallback(
    (event: { nativeEvent: { source: { width: number; height: number } } }) => {
      const { width, height } = event.nativeEvent.source;
      if (width > 0 && height > 0) {
        setNaturalSize({ width, height });
      }
    },
    [],
  );

  const renderArea = computeRenderArea(containerSize, naturalSize);

  return (
    <View
      onLayout={handleLayout}
      style={[{ width: '100%', height: imageHeight }, containerStyle]}
      testID={testID}
    >
      <Image
        accessibilityLabel="提出した学習ノート画像"
        resizeMode="contain"
        source={{ uri: imageUrl }}
        style={{ width: '100%', height: '100%' }}
        onLoad={handleImageLoad}
      />
      {renderArea
        ? corrections.map((correction, index) => {
            const bbox = correction.bbox;
            if (!bbox) return null;
            const left = renderArea.offsetX + bbox.x * renderArea.width;
            const top = renderArea.offsetY + bbox.y * renderArea.height;
            const width = Math.max(bbox.width * renderArea.width, 4);
            const height = Math.max(bbox.height * renderArea.height, UNDERLINE_THICKNESS);
            const selected = selectedCorrectionIndex === index;
            return (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={`誤り箇所 ${index + 1}`}
                onPress={() => onSelectCorrection(index)}
                hitSlop={TAP_PADDING}
                style={{
                  position: 'absolute',
                  left: left - TAP_PADDING,
                  top: top - TAP_PADDING,
                  width: width + TAP_PADDING * 2,
                  height: height + TAP_PADDING * 2,
                  paddingTop: TAP_PADDING,
                  paddingLeft: TAP_PADDING,
                }}
                testID={`correction-bbox-${index}`}
              >
                <View
                  style={{
                    width,
                    height,
                    borderBottomColor: HIGHLIGHT_COLOR,
                    borderBottomWidth: selected ? UNDERLINE_THICKNESS + 1 : UNDERLINE_THICKNESS,
                    backgroundColor: selected ? 'rgba(217, 45, 32, 0.15)' : 'transparent',
                  }}
                />
              </Pressable>
            );
          })
        : null}
    </View>
  );
}

type RenderArea = {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

/**
 * resizeMode='contain' の Image が container の中で実際にどの領域を占めるかを求める。
 * letterbox（黒帯）の余白分を offsetX / offsetY に詰める。
 */
function computeRenderArea(
  container: { width: number; height: number } | null,
  natural: { width: number; height: number } | null,
): RenderArea | null {
  if (!container || !natural) return null;
  if (container.width === 0 || container.height === 0) return null;
  if (natural.width === 0 || natural.height === 0) return null;

  const containerRatio = container.width / container.height;
  const naturalRatio = natural.width / natural.height;

  if (naturalRatio > containerRatio) {
    // 画像が container より横長 → 上下に letterbox
    const renderedHeight = container.width / naturalRatio;
    return {
      offsetX: 0,
      offsetY: (container.height - renderedHeight) / 2,
      width: container.width,
      height: renderedHeight,
    };
  }
  // 画像が container より縦長 → 左右に letterbox
  const renderedWidth = container.height * naturalRatio;
  return {
    offsetX: (container.width - renderedWidth) / 2,
    offsetY: 0,
    width: renderedWidth,
    height: container.height,
  };
}
