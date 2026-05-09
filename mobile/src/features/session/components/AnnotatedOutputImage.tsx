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
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
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
  onSelectCorrection: (correctionIndex: number, pageX?: number, pageY?: number) => void;
  containerStyle?: StyleProp<ViewStyle>;
  imageHeight?: number;
  autoHeight?: boolean;
  autoSelectIndex?: number | null;
  onAutoSelect?: (index: number, relBboxCenterX: number, relBboxBottomY: number) => void;
  testID?: string;
};

const HIGHLIGHT_COLOR = '#D92D20';
const HIGHLIGHT_BG_SELECTED = 'rgba(217, 45, 32, 0.15)';
const UNDERLINE_THICKNESS = 3;
const UNDERLINE_THICKNESS_SELECTED = UNDERLINE_THICKNESS + 1;
const TAP_PADDING = 6;

export function AnnotatedOutputImage({
  imageUrl,
  corrections,
  selectedCorrectionIndex,
  onSelectCorrection,
  containerStyle,
  imageHeight = 320,
  autoHeight = false,
  autoSelectIndex,
  onAutoSelect,
  testID,
}: AnnotatedOutputImageProps) {
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const containerRef = useRef<View>(null);
  const autoSelectFiredRef = useRef(false);

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

  // Android では <Image onLoad> の event.source に寸法が含まれないことがあるため、
  // imageUrl が変わった時に Image.getSize を非同期で呼び、natural size を補完取得する。
  // onLoad が先に setNaturalSize した場合は二重設定になるが値は同じなので無害。
  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    Image.getSize(
      imageUrl,
      (width, height) => {
        if (cancelled) return;
        if (width > 0 && height > 0) {
          setNaturalSize((current) => current ?? { width, height });
        }
      },
      () => {
        // 取得失敗は onLoad のフォールバックに任せる。
      },
    );
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const renderArea = computeRenderArea(containerSize, naturalSize);

  useEffect(() => {
    autoSelectFiredRef.current = false;
  }, [autoSelectIndex]);

  useEffect(() => {
    if (autoSelectIndex == null || !renderArea) return;

    const bbox = corrections[autoSelectIndex]?.bbox;
    if (!bbox) {
      if (!autoSelectFiredRef.current) {
        autoSelectFiredRef.current = true;
        onSelectCorrection(autoSelectIndex);
      }
      return;
    }

    const bboxCenterX = renderArea.offsetX + (bbox.x + bbox.width / 2) * renderArea.width;
    const bboxBottomY = renderArea.offsetY + (bbox.y + bbox.height) * renderArea.height;

    if (onAutoSelect) {
      if (!autoSelectFiredRef.current) {
        autoSelectFiredRef.current = true;
        onAutoSelect(autoSelectIndex, bboxCenterX, bboxBottomY);
      }
      return;
    }

    const timerId = setTimeout(() => {
      if (autoSelectFiredRef.current) return;
      autoSelectFiredRef.current = true;
      const container = containerRef.current;
      if (container) {
        container.measureInWindow((screenX, screenY) => {
          onSelectCorrection(autoSelectIndex, screenX + bboxCenterX, screenY + bboxBottomY);
        });
      }
    }, 400);
    return () => clearTimeout(timerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectIndex, renderArea]);

  const displayHeight =
    autoHeight && naturalSize && containerSize
      ? Math.round((containerSize.width / naturalSize.width) * naturalSize.height)
      : imageHeight;

  return (
    <View
      ref={containerRef}
      onLayout={handleLayout}
      style={[styles.container, { height: displayHeight }, containerStyle]}
      testID={testID}
    >
      <Image
        accessibilityLabel="提出した学習ノート画像"
        resizeMode="contain"
        source={{ uri: imageUrl }}
        style={styles.image}
        onLoad={handleImageLoad}
      />
      {renderArea
        ? corrections.map((correction, index) => {
            const bbox = correction.bbox;
            if (!bbox) return null;
            const left = renderArea.offsetX + bbox.x * renderArea.width;
            const top = renderArea.offsetY + bbox.y * renderArea.height;
            const width = Math.max(bbox.width * renderArea.width, 4);
            const maxBottom = renderArea.offsetY + renderArea.height - UNDERLINE_THICKNESS;
            const height = Math.max(
              Math.min(bbox.height * renderArea.height, maxBottom - top),
              UNDERLINE_THICKNESS,
            );
            const selected = selectedCorrectionIndex === index;
            return (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={`誤り箇所 ${index + 1}`}
                onPress={(event) => {
                  onSelectCorrection(index);
                  onSelectCorrection(index, event.nativeEvent.pageX, event.nativeEvent.pageY);
                }}
                hitSlop={TAP_PADDING}
                style={[
                  styles.tapArea,
                  {
                    left: left - TAP_PADDING,
                    top: top - TAP_PADDING,
                    width: width + TAP_PADDING * 2,
                    height: height + TAP_PADDING * 2,
                  },
                ]}
                testID={`correction-bbox-${index}`}
              >
                <View
                  style={[
                    selected ? styles.underlineSelected : styles.underline,
                    { width, height },
                  ]}
                />
              </Pressable>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  tapArea: {
    position: 'absolute',
    paddingTop: TAP_PADDING,
    paddingLeft: TAP_PADDING,
  },
  underline: {
    borderBottomColor: HIGHLIGHT_COLOR,
    borderBottomWidth: UNDERLINE_THICKNESS,
    backgroundColor: 'transparent',
  },
  underlineSelected: {
    borderBottomColor: HIGHLIGHT_COLOR,
    borderBottomWidth: UNDERLINE_THICKNESS_SELECTED,
    backgroundColor: HIGHLIGHT_BG_SELECTED,
  },
});

type RenderArea = {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

/**
 * resizeMode='contain' の Image が container の中で実際にどの領域を占めるかを求める。
 * letterbox（黒帯）の余白分を offsetX / offsetY に詰める。
 *
 * テストから直接呼べるよう export している（純粋関数なので component を render
 * しなくても挙動を確認できる）。
 */
export function computeRenderArea(
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
