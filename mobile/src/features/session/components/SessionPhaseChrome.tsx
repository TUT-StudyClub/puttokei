import { Fragment, useEffect, useMemo, useState } from 'react';
import type { LayoutChangeEvent, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Animated as RNAnimated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Circle, ClipPath, Defs, G, Path, Rect, Svg, SvgXml } from 'react-native-svg';
import { SizableText } from 'tamagui';

import { formatMmSs, useSmoothRemainingSeconds } from '@/features/session/hooks/useTimer';
import { LOOP_COUNT_MAX } from '@/shared/stores/loopStore';
import { useTimerStore } from '@/shared/stores/timerStore';

export const SESSION_PHASES = ['input', 'output', 'break'] as const;
export type SessionPhase = (typeof SESSION_PHASES)[number];

export const SESSION_PHASE_LABELS: Record<SessionPhase, string> = {
  input: 'インプット',
  output: 'アウトプット',
  break: '休憩',
};

const TEXT_ACTIVE = '#2F2F2F';
const DOT_INACTIVE = '#D9D9D9';
const BORDER_COLOR = '#E5E7EB';
const CYCLE_LABEL_HOME_COLOR = '#9D9D9D';
const SETTINGS_ICON_ASSET = require('../../../../assets/images/icons/icon_setting.png');
export const HOURGLASS_BADGE_ACTIVE_SCALE = 1.45;

/**
 * 砂時計バッジのアセットバリアント。
 *
 * - `gray`: ホーム画面と未着手サイクル用のグレー砂時計 (viewBox 0 0 18 31)。
 * - `blue`: 進行中サイクル用の青枠砂時計 (viewBox 0 0 24 41)。砂の overlay を流し込む。
 * - `purple`: 完了済みサイクル用の紫サイクル完了砂時計 (viewBox 0 0 24 41)。
 *
 * SVG ファイルごとに viewBox や砂を流し込む内部形状の座標が異なるため、座標定数と
 * クリップパスを variant ごとに保持する。
 */
export type HourglassBadgeVariant = 'gray' | 'blue' | 'purple';

type HourglassVariantConfig = {
  asset: number;
  baseWidth: number;
  baseHeight: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
  sandTop: number;
  sandNeckY: number;
  sandBottomTop: number;
  sandBottom: number;
  sandX: number;
  sandWidth: number;
  streamX: number;
  streamY: number;
  streamWidth: number;
  streamHeight: number;
  funnelDepthMax: number;
  moundPeakMax: number;
  upperClipId: string;
  lowerClipId: string;
  upperClipPath: string;
  lowerClipPath: string;
  fallbackOuterPath: string;
  fallbackInnerPath: string;
  fallbackOuterColor: string;
  fallbackInnerColor: string;
};

const HOURGLASS_GRAY_CONFIG: HourglassVariantConfig = {
  asset: require('../../../../assets/images/icons/hourglass_gray.svg'),
  baseWidth: 18,
  baseHeight: 31,
  viewBoxWidth: 18,
  viewBoxHeight: 31,
  sandTop: 3.61,
  sandNeckY: 14.25,
  sandBottomTop: 16.75,
  sandBottom: 27.38,
  sandX: 3.3,
  sandWidth: 11.1,
  // 砂粒が落下する縦の筋の位置。砂時計のくびれを通って下部に落ちる範囲。
  streamX: 8.69,
  streamY: 13.4,
  streamWidth: 0.32,
  streamHeight: 5.6,
  // 上部の砂表面が中央に向かって凹む深さ（漏斗状）。残量が少なくなったら自動で縮める。
  funnelDepthMax: 1.6,
  // 下部の砂が中央に向かって盛り上がる山の高さ。
  moundPeakMax: 2.0,
  upperClipId: 'hourglassBadgeGrayUpperSandClip',
  lowerClipId: 'hourglassBadgeGrayLowerSandClip',
  upperClipPath:
    'M3.55 7.53 C3.55 5.37 5.92 3.61 8.83 3.61 C11.75 3.61 14.11 5.37 14.11 7.53 C14.11 8.24 13.84 8.95 13.27 9.63 L10.88 12.92 C9.76 14.46 7.9 14.46 6.78 12.92 L4.33 9.57 C3.82 8.94 3.55 8.24 3.55 7.53 Z',
  lowerClipPath:
    'M6.78 18.07 C7.9 16.53 9.76 16.53 10.88 18.07 L13.33 21.43 C13.84 22.05 14.11 22.75 14.11 23.47 C14.11 25.63 11.74 27.38 8.83 27.38 C5.92 27.38 3.55 25.63 3.55 23.47 C3.55 22.75 3.82 22.04 4.39 21.36 Z',
  fallbackOuterPath:
    'M0 1.38V3.08C0 3.85 0.63 4.46 1.41 4.46C1.65 4.46 1.79 4.64 1.8 4.87L1.73 5.11C1.28 5.83 1.02 6.66 1.02 7.53C1.02 8.74 1.52 9.85 2.35 10.76L4.51 13.46C4.99 14.06 5.22 14.78 5.22 15.5C5.22 16.22 4.99 16.94 4.51 17.54L2.33 20.27C1.52 21.15 1.02 22.26 1.02 23.47C1.02 24.34 1.28 25.17 1.73 25.89L1.8 26.13C1.79 26.36 1.65 26.53 1.41 26.54C0.63 26.54 0 27.16 0 27.92V29.62C0 30.38 0.63 31 1.41 31H16.26C17.04 31 17.66 30.38 17.66 29.62V27.92C17.66 27.15 17.03 26.54 16.26 26.54C16.01 26.54 15.87 26.36 15.86 26.13L15.93 25.89C16.38 25.17 16.65 24.34 16.64 23.47C16.64 22.26 16.14 21.15 15.31 20.24L13.16 17.54C12.68 16.94 12.44 16.22 12.44 15.5C12.44 14.78 12.68 14.06 13.16 13.46L15.33 10.73C16.14 9.85 16.64 8.74 16.64 7.53C16.64 6.66 16.38 5.83 15.93 5.11L15.86 4.87C15.87 4.64 16.01 4.47 16.26 4.46C17.04 4.46 17.66 3.84 17.66 3.08V1.38C17.66 0.62 17.03 0 16.26 0H1.41C0.63 0 0 0.62 0 1.38Z',
  fallbackInnerPath:
    'M8.83 3.61C5.92 3.61 3.55 5.37 3.55 7.53C3.55 8.24 3.82 8.94 4.33 9.57L6.78 12.92C7.9 14.46 7.9 16.53 6.78 18.07L4.39 21.36C3.82 22.04 3.55 22.75 3.55 23.47C3.55 25.63 5.92 27.38 8.83 27.38C11.74 27.38 14.11 25.63 14.11 23.47C14.11 22.75 13.84 22.05 13.33 21.43L10.88 18.07C9.76 16.53 9.76 14.46 10.88 12.92L13.27 9.63C13.84 8.95 14.11 8.24 14.11 7.53C14.11 5.37 11.75 3.61 8.83 3.61Z',
  fallbackOuterColor: '#CDCDCD',
  fallbackInnerColor: '#EFEFEF',
};

const HOURGLASS_BLUE_CONFIG: HourglassVariantConfig = {
  asset: require('../../../../assets/images/icons/hourglass_blue.svg'),
  baseWidth: 24,
  baseHeight: 41,
  viewBoxWidth: 24,
  viewBoxHeight: 41,
  // 以下は blue svg の inner path から実測した座標値。
  sandTop: 4.7746,
  sandNeckY: 18.85,
  sandBottomTop: 22.16,
  sandBottom: 36.2147,
  sandX: 4.4,
  sandWidth: 14.8,
  // 中心 X = 12 (svg 中央)。Y はくびれ近傍 (NECK_Y より少し上 〜 BOTTOM_TOP より少し下)。
  streamX: 11.585,
  streamY: 17.73,
  streamWidth: 0.43,
  streamHeight: 7.41,
  funnelDepthMax: 2.12,
  moundPeakMax: 2.65,
  upperClipId: 'hourglassBadgeBlueUpperSandClip',
  lowerClipId: 'hourglassBadgeBlueLowerSandClip',
  upperClipPath:
    'M4.6978 9.95422 C4.6978 7.09797 7.82972 4.7746 11.6823 4.7746 C15.5349 4.7746 18.6668 7.09797 18.6668 9.95422 C18.6668 10.9027 18.3038 11.8353 17.556 12.7412 L14.3916 17.0842 C12.9069 19.1251 10.4523 19.1251 8.96761 17.0842 L5.73274 12.6506 C5.05542 11.83 4.6978 10.8974 4.6978 9.95422 Z',
  lowerClipPath:
    'M8.96761 23.9051 C10.4523 21.8641 12.9069 21.8641 14.3916 23.9051 L17.6264 28.3387 C18.3038 29.1593 18.6614 30.0919 18.6614 31.0351 C18.6614 33.8913 15.5295 36.2147 11.6769 36.2147 C7.8243 36.2147 4.69238 33.8913 4.69238 31.0351 C4.69238 30.0865 5.05542 29.154 5.80318 28.2481 Z',
  fallbackOuterPath:
    'M0 1.82779V4.07655C0 5.08903 0.834455 5.90434 1.85856 5.90434C2.18367 5.90434 2.37332 6.13881 2.38416 6.43722L2.29204 6.75695C1.69058 7.71614 1.3438 8.80855 1.34922 9.95425C1.34922 11.5529 2.0157 13.029 3.11024 14.228L3.08315 14.196L5.96039 17.8036C6.59436 18.5976 6.90864 19.5461 6.90864 20.5C6.90864 21.4539 6.59436 22.4024 5.96039 23.1964L3.08315 26.804L3.11024 26.772C2.0157 27.971 1.34922 29.4471 1.34922 31.0457C1.34922 32.1914 1.696 33.2839 2.29204 34.243L2.38416 34.5628C2.37332 34.8612 2.18367 35.0903 1.85856 35.0957C0.829036 35.0957 0 35.9163 0 36.9234V39.1722C0 40.1847 0.834455 41 1.85856 41H21.5008C22.5303 41 23.3593 40.1794 23.3593 39.1722V36.9234C23.3593 35.911 22.5249 35.0957 21.5008 35.0957C21.1756 35.0957 20.986 34.8612 20.9752 34.5628L21.0673 34.243C21.6687 33.2839 22.0155 32.1914 22.0101 31.0457C22.0101 29.4471 21.3436 27.971 20.2491 26.772L20.2762 26.804L17.3989 23.1964C16.765 22.4024 16.4507 21.4539 16.4507 20.5C16.4507 19.5461 16.765 18.5976 17.3989 17.8036L20.2762 14.196L20.2491 14.228C21.3436 13.029 22.0101 11.5529 22.0101 9.95425C22.0101 8.80855 21.6633 7.71614 21.0673 6.75695L20.9752 6.43722C20.986 6.13881 21.1756 5.90967 21.5008 5.90434C22.5303 5.90434 23.3593 5.0837 23.3593 4.07655V1.82779C23.3593 0.815311 22.5249 0 21.5008 0H1.85856C0.834455 0 0 0.820639 0 1.82779Z',
  fallbackInnerPath:
    'M11.6823 4.7746C7.82972 4.7746 4.6978 7.09797 4.6978 9.95422C4.6978 10.8974 5.05542 11.83 5.73274 12.6506L8.96761 17.0842C10.4523 19.1251 10.4523 21.8641 8.96761 23.9051L5.80318 28.2481C5.05542 29.154 4.69238 30.0865 4.69238 31.0351C4.69238 33.8913 7.8243 36.2147 11.6769 36.2147C15.5295 36.2147 18.6614 33.8913 18.6614 31.0351C18.6614 30.0919 18.3038 29.1593 17.6264 28.3387L14.3916 23.9051C12.9069 21.8641 12.9069 19.1251 14.3916 17.0842L17.556 12.7412C18.3038 11.8353 18.6668 10.9027 18.6668 9.95422C18.6668 7.09797 15.5349 4.7746 11.6823 4.7746Z',
  fallbackOuterColor: '#475FFF',
  fallbackInnerColor: '#EFEFEF',
};

// purple variant は「完了済みサイクル」を示す。SVG 自体に砂が溜まった様子が描き込まれて
// いるため動的な砂 overlay は使わないが、blue と同じ viewBox / 内部座標を持つので
// 砂関連の座標は blue を流用する。
const HOURGLASS_PURPLE_CONFIG: HourglassVariantConfig = {
  ...HOURGLASS_BLUE_CONFIG,
  asset: require('../../../../assets/images/icons/hourglass_purple.svg'),
  upperClipId: 'hourglassBadgePurpleUpperSandClip',
  lowerClipId: 'hourglassBadgePurpleLowerSandClip',
  fallbackInnerColor: '#BA64E8',
};

export const HOURGLASS_VARIANTS: Record<HourglassBadgeVariant, HourglassVariantConfig> = {
  gray: HOURGLASS_GRAY_CONFIG,
  blue: HOURGLASS_BLUE_CONFIG,
  purple: HOURGLASS_PURPLE_CONFIG,
};

const DEFAULT_HOURGLASS_VARIANT: HourglassBadgeVariant = 'gray';
type FallingParticleConfig = {
  cx: number;
  r: number;
  phase: number;
  durationMs: number;
  accent: boolean;
};

// 砂粒のアニメーション設定。各粒子が異なる速度・位相で落下する。
const HOURGLASS_FALLING_PARTICLES: readonly FallingParticleConfig[] = [
  { cx: 8.78, r: 0.3, phase: 0.0, durationMs: 720, accent: false },
  { cx: 9.0, r: 0.22, phase: 0.18, durationMs: 640, accent: true },
  { cx: 8.66, r: 0.34, phase: 0.34, durationMs: 880, accent: false },
  { cx: 8.92, r: 0.2, phase: 0.46, durationMs: 700, accent: true },
  { cx: 8.84, r: 0.28, phase: 0.58, durationMs: 760, accent: false },
  { cx: 9.05, r: 0.18, phase: 0.7, durationMs: 620, accent: true },
  { cx: 8.72, r: 0.32, phase: 0.82, durationMs: 820, accent: false },
  { cx: 8.96, r: 0.24, phase: 0.92, durationMs: 680, accent: true },
];
const HOURGLASS_FALLING_CLIP_ID = 'hourglassBadgeFallingClip';

const SVG_CSS_ATTRIBUTE_NAMES: Record<string, string> = {
  'mask-type': 'maskType',
};

const SVG_UNSUPPORTED_CSS_PROPERTIES = new Set(['mix-blend-mode']);

function cssPropertyToSvgAttribute(property: string) {
  return (
    SVG_CSS_ATTRIBUTE_NAMES[property] ??
    property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
  );
}

function inlineSvgStyleAttributes(xml: string) {
  return xml.replace(/\sstyle="([^"]*)"/g, (_styleAttribute: string, declarations: string) => {
    const attributes = declarations
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separatorIndex = declaration.indexOf(':');
        if (separatorIndex === -1) return null;

        const property = declaration.slice(0, separatorIndex).trim();
        const value = declaration.slice(separatorIndex + 1).trim();
        if (!property || !value || SVG_UNSUPPORTED_CSS_PROPERTIES.has(property)) return null;

        return `${cssPropertyToSvgAttribute(property)}="${value}"`;
      })
      .filter((attribute): attribute is string => attribute !== null);

    return attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
  });
}

function clampSandProgress(progress: number) {
  return Math.min(1, Math.max(0, progress));
}

function formatSvgNumber(value: number) {
  // SVG path の d 属性で扱いやすいよう、不要な末尾 0 を落として小数 3 桁までに丸める。
  return Number.parseFloat(value.toFixed(3)).toString();
}

/**
 * 砂時計に積み上げる 1 層分の砂の指定。
 *
 * 上部の漏斗には配列順（=下から上）で層が積まれ、最上層だけが漏斗状の凹みを持つ。
 * 下部山型は `activeLayerIndex` の層の色のみで描画され、高さは当該層の duration 比率を上限とする。
 */
export type HourglassSandLayer = {
  /** 砂粒の色（例: '#4B5CFF'） */
  color: string;
  /** 当該層の高さの重み。配列内の他の `weight` との比で正規化される（通常は phase の duration を渡す）。 */
  weight: number;
  /** 残量比率。1 で満タン、0 で空。active 以外の層は 1 を渡す想定。 */
  progress: number;
  /** 砂粒の不透明度。未指定は 1.0。 */
  opacity?: number;
  /** デバッグ用ラベル。任意。 */
  label?: 'input' | 'output' | 'break' | string;
};

type HourglassUpperLayerShape = {
  color: string;
  opacity: number;
  upperPath: string;
  isTopLayer: boolean;
};

type HourglassLowerLayerShape = {
  color: string;
  opacity: number;
  path: string;
  isTopMound: boolean;
};

type HourglassSandLayerShapes = {
  upperLayers: HourglassUpperLayerShape[];
  // 下部の積層は配列順 (=底から上) に並ぶ。最後の高さ > 0 の層が中央山型を持つ。
  lowerLayers: HourglassLowerLayerShape[];
  // 落下ストリームの色源 (active 層の色)。active 層が無い・空のときは空文字。
  streamColor: string;
  streamOpacity: number;
  isDraining: boolean;
};

const EMPTY_SAND_SHAPES: HourglassSandLayerShapes = {
  upperLayers: [],
  lowerLayers: [],
  streamColor: '',
  streamOpacity: 1,
  isDraining: false,
};

// 砂の表面の谷 / 山の頂点を、揺れに合わせて中心からどれだけ左右にずらすかの最大幅 (sandWidth 比)。
// 砂時計を傾けたときに液面の頂点が低い側へスライドする見た目を作る。
const HOURGLASS_SURFACE_TILT_X_RATIO = 0.18;

function getHourglassSandLayerShapes(
  layers: readonly HourglassSandLayer[],
  activeLayerIndex: number,
  config: HourglassVariantConfig,
  surfaceTilt = 0,
): HourglassSandLayerShapes {
  // weight が正の層のみ採用する。元の index を覚えておいて activeLayerIndex を再マッピングする。
  const indexed = layers
    .map((layer, originalIndex) => ({ layer, originalIndex }))
    .filter(({ layer }) => layer.weight > 0);

  if (indexed.length === 0) return EMPTY_SAND_SHAPES;

  const totalWeight = indexed.reduce((sum, { layer }) => sum + layer.weight, 0);
  if (totalWeight <= 0) return EMPTY_SAND_SHAPES;

  const upperTotalHeight = config.sandNeckY - config.sandTop;
  const lowerTotalHeight = config.sandBottom - config.sandBottomTop;
  const xLeft = config.sandX;
  const xRight = config.sandX + config.sandWidth;
  const xCenter = config.sandX + config.sandWidth / 2;
  // -1..1 にクランプし、左右どちらの壁も超えないようオフセット幅を決定する。
  const clampedTilt = Math.max(-1, Math.min(1, surfaceTilt));
  const tiltOffset = clampedTilt * config.sandWidth * HOURGLASS_SURFACE_TILT_X_RATIO;
  const surfacePeakX = xCenter + tiltOffset;

  const heights = indexed.map(({ layer }) => {
    const normalizedWeight = layer.weight / totalWeight;
    const safeProgress = clampSandProgress(layer.progress);
    return upperTotalHeight * normalizedWeight * safeProgress;
  });

  // 高さ > 0 の層のうち、配列順で最後のものが「最上層」(漏斗の凹みを持つ層)。
  let topVisibleIdx = -1;
  for (let i = heights.length - 1; i >= 0; i--) {
    if ((heights[i] ?? 0) > 0) {
      topVisibleIdx = i;
      break;
    }
  }

  let bottomY = config.sandNeckY;
  const upperLayers: HourglassUpperLayerShape[] = indexed.map(({ layer }, idx) => {
    const layerHeight = heights[idx] ?? 0;
    if (layerHeight <= 0) {
      return {
        color: layer.color,
        opacity: layer.opacity ?? 1,
        upperPath: '',
        isTopLayer: false,
      };
    }
    const topY = bottomY - layerHeight;
    const isTop = idx === topVisibleIdx;

    let upperPath: string;
    if (isTop) {
      // 最上層: 中央が下にへこむ漏斗型。残量が浅くなりすぎたときは凹みを縮小する。
      // 揺れている時は谷の頂点 X を傾斜方向に少しずらして液面の傾きを表現する。
      const funnelDepth = Math.min(config.funnelDepthMax, layerHeight * 0.6);
      upperPath =
        `M${formatSvgNumber(xLeft)} ${formatSvgNumber(topY)}` +
        ` L${formatSvgNumber(surfacePeakX)} ${formatSvgNumber(topY + funnelDepth)}` +
        ` L${formatSvgNumber(xRight)} ${formatSvgNumber(topY)}` +
        ` L${formatSvgNumber(xRight)} ${formatSvgNumber(bottomY)}` +
        ` L${formatSvgNumber(xLeft)} ${formatSvgNumber(bottomY)} Z`;
    } else {
      // 中間・下層: 上端は隣の層の下端と一致するため、段差なしの矩形で十分。
      upperPath =
        `M${formatSvgNumber(xLeft)} ${formatSvgNumber(topY)}` +
        ` L${formatSvgNumber(xRight)} ${formatSvgNumber(topY)}` +
        ` L${formatSvgNumber(xRight)} ${formatSvgNumber(bottomY)}` +
        ` L${formatSvgNumber(xLeft)} ${formatSvgNumber(bottomY)} Z`;
    }

    bottomY = topY;
    return {
      color: layer.color,
      opacity: layer.opacity ?? 1,
      upperPath,
      isTopLayer: isTop,
    };
  });

  // 下部は配列順 (=底から上) に各層の「消費された分」を積み上げて描画する。
  // 高さは layer.weight × (1 - progress) を duration 比率で正規化したもの。
  const lowerHeights = indexed.map(({ layer }) => {
    const normalizedWeight = layer.weight / totalWeight;
    const safeProgress = clampSandProgress(layer.progress);
    const elapsed = 1 - safeProgress;
    return lowerTotalHeight * normalizedWeight * elapsed;
  });

  // 高さ > 0 の層のうち配列順で最後のものが「下部の最上層」(中央山型を持つ)。
  let topMoundIdx = -1;
  for (let i = lowerHeights.length - 1; i >= 0; i--) {
    if ((lowerHeights[i] ?? 0) > 0) {
      topMoundIdx = i;
      break;
    }
  }

  let lowerCurrentBottomY = config.sandBottom;
  const lowerLayers: HourglassLowerLayerShape[] = indexed.map(({ layer }, idx) => {
    const layerHeight = lowerHeights[idx] ?? 0;
    if (layerHeight <= 0) {
      return {
        color: layer.color,
        opacity: layer.opacity ?? 1,
        path: '',
        isTopMound: false,
      };
    }
    const topY = lowerCurrentBottomY - layerHeight;
    const isTop = idx === topMoundIdx;

    let path: string;
    if (isTop) {
      // 最上層: 中央が上に持ち上がる山型。山の高さは盛り上がりが上部の下端を超えないようクランプ。
      // 揺れている時は山の頂点 X を傾斜方向にずらして「砂が片側に寄る」見え方を作る。
      const peakBoost = Math.min(config.moundPeakMax, layerHeight * 0.4);
      const peakY = Math.max(config.sandBottomTop, topY - peakBoost);
      path =
        `M${formatSvgNumber(xLeft)} ${formatSvgNumber(lowerCurrentBottomY)}` +
        ` L${formatSvgNumber(xLeft)} ${formatSvgNumber(topY)}` +
        ` L${formatSvgNumber(surfacePeakX)} ${formatSvgNumber(peakY)}` +
        ` L${formatSvgNumber(xRight)} ${formatSvgNumber(topY)}` +
        ` L${formatSvgNumber(xRight)} ${formatSvgNumber(lowerCurrentBottomY)} Z`;
    } else {
      // 中間・下層: 上端は隣の層の下端と一致するため、段差なしの矩形で十分。
      path =
        `M${formatSvgNumber(xLeft)} ${formatSvgNumber(topY)}` +
        ` L${formatSvgNumber(xRight)} ${formatSvgNumber(topY)}` +
        ` L${formatSvgNumber(xRight)} ${formatSvgNumber(lowerCurrentBottomY)}` +
        ` L${formatSvgNumber(xLeft)} ${formatSvgNumber(lowerCurrentBottomY)} Z`;
    }

    lowerCurrentBottomY = topY;
    return {
      color: layer.color,
      opacity: layer.opacity ?? 1,
      path,
      isTopMound: isTop,
    };
  });

  const activeMatch = indexed.find(({ originalIndex }) => originalIndex === activeLayerIndex);
  const activeLayer = activeMatch?.layer;
  const activeProgress = activeLayer ? clampSandProgress(activeLayer.progress) : 1;
  const isDraining = activeLayer ? activeProgress > 0 && activeProgress < 1 : false;

  return {
    upperLayers,
    lowerLayers,
    streamColor: activeLayer?.color ?? '',
    streamOpacity: activeLayer?.opacity ?? 1,
    isDraining,
  };
}

function buildHourglassSandOverlayXml(
  layers: readonly HourglassSandLayer[],
  activeLayerIndex: number,
  showStream: boolean,
  config: HourglassVariantConfig,
) {
  const { upperLayers, lowerLayers, streamColor, isDraining } = getHourglassSandLayerShapes(
    layers,
    activeLayerIndex,
    config,
  );

  const upperXml = upperLayers
    .filter((layer) => layer.upperPath)
    .map((layer) => {
      const opacityAttr =
        layer.opacity < 1 ? ` fill-opacity="${formatSvgNumber(layer.opacity)}"` : '';
      return `<path d="${layer.upperPath}" fill="${layer.color}"${opacityAttr} clip-path="url(#${config.upperClipId})"/>`;
    })
    .join('');

  const lowerXml = lowerLayers
    .filter((layer) => layer.path)
    .map((layer) => {
      const opacityAttr =
        layer.opacity < 1 ? ` fill-opacity="${formatSvgNumber(layer.opacity)}"` : '';
      return `<path d="${layer.path}" fill="${layer.color}"${opacityAttr} clip-path="url(#${config.lowerClipId})"/>`;
    })
    .join('');

  const stream =
    showStream && isDraining && streamColor
      ? `<rect x="${config.streamX}" y="${config.streamY}" width="${config.streamWidth}" height="${config.streamHeight}" rx="${config.streamWidth / 2}" fill="${streamColor}" opacity="0.55"/>`
      : '';

  return `
<defs>
  <clipPath id="${config.upperClipId}">
    <path d="${config.upperClipPath}"/>
  </clipPath>
  <clipPath id="${config.lowerClipId}">
    <path d="${config.lowerClipPath}"/>
  </clipPath>
</defs>
<g opacity="0.92">
  ${upperXml}
  ${lowerXml}
  ${stream}
</g>`;
}

function injectHourglassSandOverlay(
  xml: string,
  layers: readonly HourglassSandLayer[],
  activeLayerIndex: number,
  showStream: boolean,
  config: HourglassVariantConfig,
) {
  if (layers.length === 0) return xml;
  return xml.replace(
    '</svg>',
    `${buildHourglassSandOverlayXml(layers, activeLayerIndex, showStream, config)}</svg>`,
  );
}

export function useHourglassBadgeXml(asset: number) {
  const [xml, setXml] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setXml(null);
    const source = Image.resolveAssetSource(asset);
    const uri = source?.uri;
    if (!uri || typeof fetch !== 'function') return;

    fetch(uri)
      .then((response) => {
        if (!response.ok && !(response.status === 0 && uri.startsWith('file://'))) {
          throw new Error(`Failed to load hourglass badge SVG: ${response.status}`);
        }
        return response.text();
      })
      .then((loadedXml) => {
        if (isMounted) {
          setXml(inlineSvgStyleAttributes(loadedXml));
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [asset]);

  return xml;
}

type SettingsIconProps = {
  size?: number;
};

function SettingsIcon({ size = 24 }: SettingsIconProps) {
  return (
    <Image
      source={SETTINGS_ICON_ASSET}
      resizeMode="contain"
      style={[styles.settingsIcon, { width: size, height: size }]}
    />
  );
}

type SessionSettingsButtonProps = {
  onPress: () => void;
  testID: string;
  rowStyle?: StyleProp<ViewStyle>;
};

export function SessionSettingsButton({ onPress, testID, rowStyle }: SessionSettingsButtonProps) {
  return (
    <View style={[styles.settingsRow, rowStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="設定"
        onPress={onPress}
        style={({ pressed }) => [styles.settingsButton, pressed ? styles.pressed : null]}
        hitSlop={8}
        testID={testID}
      >
        <SettingsIcon />
      </Pressable>
    </View>
  );
}

export type HourglassBadgeIconProps = {
  active: boolean;
  layers: readonly HourglassSandLayer[];
  activeLayerIndex: number;
  showSandStream: boolean;
  xml: string | null;
  testID: string;
  config: HourglassVariantConfig;
  /** 明示サイズ。未指定時は active フラグ × baseWidth/Height から従来計算する。 */
  width?: number;
  height?: number;
};

type HourglassBadgeFallbackIconProps = {
  width: number;
  height: number;
  testID: string;
  layers: readonly HourglassSandLayer[];
  activeLayerIndex: number;
  showSandStream: boolean;
  config: HourglassVariantConfig;
};

export function HourglassBadgeSandOverlay({
  layers,
  activeLayerIndex,
  showStream,
  config,
  surfaceTilt = 0,
}: {
  layers: readonly HourglassSandLayer[];
  activeLayerIndex: number;
  showStream: boolean;
  config: HourglassVariantConfig;
  /** -1..1。砂の表面 (谷 / 山) を中心からどれだけ左右にずらすか。0 で従来挙動。 */
  surfaceTilt?: number;
}) {
  const { upperLayers, lowerLayers, streamColor, isDraining } = getHourglassSandLayerShapes(
    layers,
    activeLayerIndex,
    config,
    surfaceTilt,
  );

  return (
    <G opacity={0.92}>
      <Defs>
        <ClipPath id={config.upperClipId}>
          <Path d={config.upperClipPath} />
        </ClipPath>
        <ClipPath id={config.lowerClipId}>
          <Path d={config.lowerClipPath} />
        </ClipPath>
      </Defs>
      {upperLayers.map((layer, idx) =>
        layer.upperPath ? (
          <Path
            key={`sand-upper-${idx}`}
            d={layer.upperPath}
            fill={layer.color}
            fillOpacity={layer.opacity}
            clipPath={`url(#${config.upperClipId})`}
          />
        ) : null,
      )}
      {lowerLayers.map((layer, idx) =>
        layer.path ? (
          <Path
            key={`sand-lower-${idx}`}
            d={layer.path}
            fill={layer.color}
            fillOpacity={layer.opacity}
            clipPath={`url(#${config.lowerClipId})`}
          />
        ) : null,
      )}
      {showStream && isDraining && streamColor ? (
        <Rect
          x={config.streamX}
          y={config.streamY}
          width={config.streamWidth}
          height={config.streamHeight}
          rx={config.streamWidth / 2}
          fill={streamColor}
          opacity={0.55}
        />
      ) : null}
    </G>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RNAnimatedCircle = RNAnimated.createAnimatedComponent(Circle);

function darkenSandColor(color: string) {
  // 12% ほど暗くしたアクセント色を返す。色解釈に失敗したら元の色を opacity 多めで返す。
  const hex = color.replace('#', '');
  if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) return color;
  const factor = 0.88;
  const r = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(0, 2), 16) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(2, 4), 16) * factor)));
  const b = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(4, 6), 16) * factor)));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function FallingSandParticle({
  particle,
  color,
  streamY,
  streamHeight,
}: {
  particle: FallingParticleConfig;
  color: string;
  streamY: number;
  streamHeight: number;
}) {
  const reducedMotion = useReducedMotion();
  // 各粒子は 0..1 の周期で進行。フェーズが少しずつズレているので落下が連続して見える。
  const progress = useSharedValue(particle.phase);

  useEffect(() => {
    if (reducedMotion) {
      // 視差効果低減モードでは静止し、中央付近に薄く点を残す。
      progress.value = 0.5;
      return;
    }
    progress.value = particle.phase;
    progress.value = withRepeat(
      withTiming(particle.phase + 1, {
        duration: particle.durationMs,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [particle.phase, particle.durationMs, reducedMotion, progress]);

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value % 1;
    const cy = streamY + streamHeight * t;
    // 上下端でフェードイン・アウトさせ、テレポートした感じを抑える。
    const fade = Math.min(1, t * 6) * Math.min(1, (1 - t) * 6);
    return {
      cy,
      opacity: 0.92 * fade,
    };
  });

  return (
    <AnimatedCircle cx={particle.cx} r={particle.r} fill={color} animatedProps={animatedProps} />
  );
}

function HourglassFallingSandLayer({
  width,
  height,
  color,
  config,
}: {
  width: number;
  height: number;
  color: string;
  config: HourglassVariantConfig;
}) {
  const accentColor = useMemo(() => darkenSandColor(color), [color]);
  const viewBox = `0 0 ${config.viewBoxWidth} ${config.viewBoxHeight}`;

  return (
    <Svg
      style={StyleSheet.absoluteFillObject}
      width={width}
      height={height}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      pointerEvents="none"
    >
      <Defs>
        <ClipPath id={HOURGLASS_FALLING_CLIP_ID}>
          <Rect
            x={config.streamX - 0.6}
            y={config.streamY}
            width={config.streamWidth + 1.2}
            height={config.streamHeight}
          />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${HOURGLASS_FALLING_CLIP_ID})`}>
        {HOURGLASS_FALLING_PARTICLES.map((p, index) => (
          <FallingSandParticle
            key={`${p.cx}-${index}`}
            particle={p}
            streamY={config.streamY}
            streamHeight={config.streamHeight}
            color={p.accent ? accentColor : color}
          />
        ))}
      </G>
    </Svg>
  );
}

function HourglassBadgeFallbackIcon({
  width,
  height,
  testID,
  layers,
  activeLayerIndex,
  showSandStream,
  config,
}: HourglassBadgeFallbackIconProps) {
  const viewBox = `0 0 ${config.viewBoxWidth} ${config.viewBoxHeight}`;
  return (
    <Svg width={width} height={height} viewBox={viewBox} fill="none" testID={testID}>
      <Path d={config.fallbackOuterPath} fill={config.fallbackOuterColor} />
      <Path d={config.fallbackInnerPath} fill={config.fallbackInnerColor} />
      {layers.length === 0 ? null : (
        <HourglassBadgeSandOverlay
          layers={layers}
          activeLayerIndex={activeLayerIndex}
          showStream={showSandStream}
          config={config}
        />
      )}
    </Svg>
  );
}

export function HourglassBadgeIcon({
  active,
  layers,
  activeLayerIndex,
  showSandStream,
  xml,
  testID,
  config,
  width: widthOverride,
  height: heightOverride,
}: HourglassBadgeIconProps) {
  const width =
    widthOverride ?? (active ? config.baseWidth * HOURGLASS_BADGE_ACTIVE_SCALE : config.baseWidth);
  const height =
    heightOverride ??
    (active ? config.baseHeight * HOURGLASS_BADGE_ACTIVE_SCALE : config.baseHeight);
  // 非アクティブなループバッジには砂を描画しない。
  const effectiveLayers: readonly HourglassSandLayer[] = active ? layers : [];
  // 落下ストリーム描画用の active 層の色（粒子レイヤで使用）
  const activeLayerColor = layers[activeLayerIndex]?.color ?? '#4B5CFF';
  const fallback = (
    <HourglassBadgeFallbackIcon
      width={width}
      height={height}
      testID={testID}
      layers={effectiveLayers}
      activeLayerIndex={activeLayerIndex}
      showSandStream={showSandStream}
      config={config}
    />
  );

  const baseLayer = xml ? (
    <SvgXml
      xml={injectHourglassSandOverlay(
        xml,
        effectiveLayers,
        activeLayerIndex,
        showSandStream,
        config,
      )}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      fallback={fallback}
      onError={() => undefined}
      testID={testID}
    />
  ) : (
    fallback
  );

  // 砂が現在進行形で落ちている（=アクティブで残量あり）ときだけ粒子レイヤを重ねる。
  // 切り分け中: Bridgeless 環境での Reanimated クラッシュ調査のため、一時的に無効化。
  const showFallingLayer = false;

  if (!showFallingLayer) {
    return baseLayer;
  }

  return (
    <View
      style={{ width, height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {baseLayer}
      <HourglassFallingSandLayer
        width={width}
        height={height}
        color={activeLayerColor}
        config={config}
      />
    </View>
  );
}

type HourglassBadgeProps = {
  currentLoop: number;
  testIDPrefix: string;
  borderColor?: string;
  marginBottom?: number;
  rowStyle?: StyleProp<ViewStyle>;
  badgeStyle?: StyleProp<ViewStyle>;
  /** @deprecated `sandLayers` を推奨。`sandLayers` 未指定時に 1 層へ正規化される。 */
  sandColor?: string;
  /** @deprecated `sandLayers` を推奨。`sandLayers` 未指定時に 1 層へ正規化される。 */
  sandProgress?: number;
  /** 下から積み上げる砂の層。配列の最後が最上層 = 漏斗の凹みを持つ。 */
  sandLayers?: readonly HourglassSandLayer[];
  /** `sandLayers` の中で残量が動いている層の index。下部山型・ストリームの色源。 */
  activeLayerIndex?: number;
  showSandStream?: boolean;
  /** バッジ画像のバリアント。ホーム画面は `gray`、セッション系画面は `blue` を指定する。 */
  variant?: HourglassBadgeVariant;
  /**
   * variant の `baseWidth` を上書きする。`SessionTopChrome` 配下では Home の gray に揃えるため
   * 全画面で同じ値を渡し、バッジ全体の高さを統一する。指定がなければ variant の baseWidth を使う。
   */
  iconBaseWidth?: number;
  /** variant の `baseHeight` を上書きする。`iconBaseWidth` と対で使う。 */
  iconBaseHeight?: number;
  /**
   * `currentLoop` 番目（= 進行中サイクル）の砂時計を覆う Wrapper View に当てる ref。
   * バッジ列の中で active バッジだけの位置を `measureInWindow` 等で取得したいときに使う。
   */
  activeIconRef?: React.Ref<View>;
};

/**
 * サイクル番号と「進行中サイクル」「base variant」から、その砂時計に適用する variant を返す。
 *
 * - base が `gray` (ホーム画面想定) の場合は常に `gray` を返す。
 * - base が `blue` 系 (input / output / break 画面) の場合:
 *   - 進行中サイクルと一致 → そのまま blue
 *   - 進行中より前 (=完了済み) → purple
 *   - 進行中より後 (=未着手) → gray
 */
function resolveIconVariant(
  loopIndex: number,
  currentLoop: number,
  baseVariant: HourglassBadgeVariant,
): HourglassBadgeVariant {
  if (baseVariant === 'gray') return 'gray';
  if (loopIndex === currentLoop) return baseVariant;
  if (loopIndex < currentLoop) return 'purple';
  return 'gray';
}

export function HourglassBadge({
  currentLoop,
  testIDPrefix,
  borderColor = BORDER_COLOR,
  marginBottom = 20,
  rowStyle,
  badgeStyle,
  sandColor,
  sandProgress,
  sandLayers,
  activeLayerIndex = 0,
  showSandStream = false,
  variant = DEFAULT_HOURGLASS_VARIANT,
  iconBaseWidth,
  iconBaseHeight,
  activeIconRef,
}: HourglassBadgeProps) {
  const grayXml = useHourglassBadgeXml(HOURGLASS_VARIANTS.gray.asset);
  const blueXml = useHourglassBadgeXml(HOURGLASS_VARIANTS.blue.asset);
  const purpleXml = useHourglassBadgeXml(HOURGLASS_VARIANTS.purple.asset);
  const xmlByVariant: Record<HourglassBadgeVariant, string | null> = {
    gray: grayXml,
    blue: blueXml,
    purple: purpleXml,
  };

  // 旧 API (`sandColor` + `sandProgress`) が来た場合は単層の sandLayers に正規化する。
  const layers = useMemo<readonly HourglassSandLayer[]>(() => {
    if (sandLayers && sandLayers.length > 0) return sandLayers;
    if (sandProgress !== undefined) {
      return [{ color: sandColor ?? '#4B5CFF', weight: 1, progress: sandProgress }];
    }
    return [];
  }, [sandLayers, sandColor, sandProgress]);

  return (
    <View
      style={[styles.badgeRow, { marginBottom }, rowStyle]}
      testID={`${testIDPrefix}-hourglass-row`}
    >
      <View
        style={[styles.badge, { borderColor }, badgeStyle]}
        testID={`${testIDPrefix}-hourglass-badge`}
      >
        {Array.from({ length: LOOP_COUNT_MAX }).map((_, index) => {
          const loopIndex = index + 1;
          const isActive = loopIndex === currentLoop;
          const iconVariant = resolveIconVariant(loopIndex, currentLoop, variant);
          const iconConfig = HOURGLASS_VARIANTS[iconVariant];
          const baseWidth = iconBaseWidth ?? iconConfig.baseWidth;
          const baseHeight = iconBaseHeight ?? iconConfig.baseHeight;
          const iconWidth = isActive ? baseWidth * HOURGLASS_BADGE_ACTIVE_SCALE : baseWidth;
          const iconHeight = isActive ? baseHeight * HOURGLASS_BADGE_ACTIVE_SCALE : baseHeight;
          const iconElement = (
            <HourglassBadgeIcon
              active={isActive}
              layers={layers}
              activeLayerIndex={activeLayerIndex}
              showSandStream={showSandStream}
              xml={xmlByVariant[iconVariant]}
              testID={`${testIDPrefix}-hourglass-badge-icon-${index + 1}`}
              config={iconConfig}
              width={iconWidth}
              height={iconHeight}
            />
          );
          // active バッジには測定用の wrapper View を被せて ref を forward する。
          // wrapper には明示サイズを当てて、flex の暗黙縮小や collapse による 0 サイズ化を防ぐ
          // (= measureInWindow で確実にバッジ中心を取れるようにする)。
          if (isActive && activeIconRef) {
            return (
              <View
                key={index}
                ref={activeIconRef}
                collapsable={false}
                style={{ width: iconWidth, height: iconHeight }}
              >
                {iconElement}
              </View>
            );
          }
          return <Fragment key={index}>{iconElement}</Fragment>;
        })}
      </View>
    </View>
  );
}

const PHASE_TAB_DOT_SIZE = 9.5;
const PHASE_TAB_DOT_STROKE = 1.5;

function PhaseTabDot({
  color,
  filled,
  testID,
  dotStyle,
}: {
  color: string;
  filled: boolean;
  testID: string;
  dotStyle?: StyleProp<ViewStyle>;
}) {
  const r = PHASE_TAB_DOT_SIZE / 2 - PHASE_TAB_DOT_STROKE / 2;
  const c = PHASE_TAB_DOT_SIZE / 2;
  return (
    <View
      testID={testID}
      style={[
        {
          width: PHASE_TAB_DOT_SIZE,
          height: PHASE_TAB_DOT_SIZE,
          borderRadius: PHASE_TAB_DOT_SIZE / 2,
          backgroundColor: filled ? color : 'transparent',
          borderColor: color,
          borderWidth: 0,
          ...(filled
            ? {
                shadowColor: color,
                shadowOpacity: 1,
                shadowRadius: 2,
                shadowOffset: { width: 0, height: 0 },
                elevation: 3,
              }
            : null),
        },
        dotStyle,
      ]}
    >
      {!filled && (
        <Svg width={PHASE_TAB_DOT_SIZE} height={PHASE_TAB_DOT_SIZE}>
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={color}
            strokeWidth={PHASE_TAB_DOT_STROKE}
            strokeDasharray="0 2.51"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      )}
    </View>
  );
}

type PhaseTabsProps = {
  activePhase: SessionPhase | null;
  testIDPrefix: string;
  activeDotColor: string;
  activeDotFilled?: boolean;
  inactiveDotFilled?: boolean;
  inactiveDotFilledPhases?: Partial<Record<SessionPhase, boolean>>;
  inactiveDotColor?: string;
  inactiveDotColors?: Partial<Record<SessionPhase, string>>;
  activeDotStyle?: StyleProp<ViewStyle>;
  activeTextColor?: string;
  inactiveTextColor?: string;
  inactiveTextColors?: Partial<Record<SessionPhase, string>>;
  separatorColor?: string;
  marginBottom?: number;
  onChange?: (phase: SessionPhase) => void;
};

export function PhaseTabs({
  activePhase,
  testIDPrefix,
  activeDotColor,
  activeDotFilled = true,
  inactiveDotFilled = false,
  inactiveDotFilledPhases,
  inactiveDotColor = DOT_INACTIVE,
  inactiveDotColors,
  activeDotStyle,
  activeTextColor = TEXT_ACTIVE,
  inactiveTextColor = DOT_INACTIVE,
  inactiveTextColors,
  separatorColor = DOT_INACTIVE,
  marginBottom = 24,
  onChange,
}: PhaseTabsProps) {
  return (
    <View style={[styles.phaseTabs, { marginBottom }]} testID={`${testIDPrefix}-phase-tabs`}>
      {SESSION_PHASES.map((phase, index) => {
        const isActive = phase === activePhase;
        const isLast = index === SESSION_PHASES.length - 1;
        const phaseInactiveDotColor = inactiveDotColors?.[phase] ?? inactiveDotColor;
        const phaseInactiveDotFilled = inactiveDotFilledPhases?.[phase] ?? inactiveDotFilled;
        const phaseInactiveTextColor = inactiveTextColors?.[phase] ?? inactiveTextColor;
        const tabContent = (
          <>
            <PhaseTabDot
              color={isActive ? activeDotColor : phaseInactiveDotColor}
              filled={isActive ? activeDotFilled : phaseInactiveDotFilled}
              testID={`${testIDPrefix}-phase-tab-${phase}-dot`}
              dotStyle={isActive ? activeDotStyle : undefined}
            />
            <SizableText
              size="$3"
              style={[
                styles.phaseTabLabel,
                { color: phaseInactiveTextColor },
                isActive
                  ? { color: activeTextColor, fontFamily: 'HiraginoSans-W6' }
                  : { fontSize: 10 },
              ]}
            >
              {SESSION_PHASE_LABELS[phase]}
            </SizableText>
          </>
        );

        return (
          <View key={phase} style={styles.phaseTabItemRow}>
            {onChange ? (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => onChange(phase)}
                style={styles.phaseTab}
                testID={`${testIDPrefix}-phase-tab-${phase}`}
              >
                {tabContent}
              </Pressable>
            ) : (
              <View style={styles.phaseTab} testID={`${testIDPrefix}-phase-tab-${phase}`}>
                {tabContent}
              </View>
            )}
            {isLast ? null : (
              <View style={[styles.phaseTabSeparator, { backgroundColor: separatorColor }]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

/**
 * 4 画面 (Home / Input / Output / Break) で共通利用する画面上部の固定 chrome。
 *
 * Home の絶対配置座標 (`top: 7.9%` / `top: 19.4%`) を 4 画面で揃えるための wrapper。
 * 砂時計バッジ・PhaseTabs を SafeAreaView 配下の親 View に対して絶対配置する想定。
 * `showHeader` が `false` のときは砂時計バッジを非表示にし、PhaseTabs だけ常に表示する。
 *
 * 画面側のメインコンテンツは `SESSION_TOP_CHROME_CONTENT_TOP` を `top` に当てた
 * 絶対配置 View でラップして、chrome と重ならない位置から始める。
 */
export const SESSION_TOP_CHROME_CONTENT_TOP = '26.1%' as const;
export const SESSION_TOP_CHROME_HOURGLASS_WIDTH_RATIO = 1 - 0.1318 - 0.1294;
export const SESSION_TOP_CHROME_PHASE_TABS_TOP = '19.1%' as const;

type SessionTopChromeProps = {
  testIDPrefix: string;
  /** 砂時計バッジを表示するか。`false` でも PhaseTabs は表示される。 */
  showHeader?: boolean;
  hourglassWrapperStyle?: StyleProp<ViewStyle>;
  cycleLabelStyle?: StyleProp<TextStyle>;
  hourglassRowStyle?: StyleProp<ViewStyle>;
  phaseTabsWrapperStyle?: StyleProp<ViewStyle>;
  hourglass: Omit<HourglassBadgeProps, 'testIDPrefix' | 'rowStyle' | 'marginBottom'>;
  phaseTabs: Omit<PhaseTabsProps, 'testIDPrefix' | 'marginBottom'>;
  /** 砂時計バッジ wrapper の View ref。Break 画面のエントランスアニメ用。 */
  hourglassWrapperRef?: React.Ref<View>;
  onHourglassWrapperLayout?: (event: LayoutChangeEvent) => void;
  /** PhaseTabs の top 位置を上書きする。省略時は SESSION_TOP_CHROME_PHASE_TABS_TOP を使う。 */
  phaseTabsTop?: `${number}%`;
};

export function SessionTopChrome({
  testIDPrefix,
  showHeader = true,
  hourglassWrapperStyle,
  cycleLabelStyle,
  hourglassRowStyle,
  phaseTabsWrapperStyle,
  hourglass,
  phaseTabs,
  hourglassWrapperRef,
  onHourglassWrapperLayout,
  phaseTabsTop,
}: SessionTopChromeProps) {
  const hourglassVariant = hourglass.variant ?? DEFAULT_HOURGLASS_VARIANT;
  const isHomeBadge = hourglassVariant === 'gray';
  const cycleLabelCount = isHomeBadge
    ? Math.max(0, hourglass.currentLoop - 1)
    : hourglass.currentLoop;
  const cycleLabelColor = isHomeBadge ? CYCLE_LABEL_HOME_COLOR : TEXT_ACTIVE;

  return (
    <>
      <View
        ref={hourglassWrapperRef}
        onLayout={onHourglassWrapperLayout}
        style={[
          styles.topChromeHourglassWrapper,
          hourglassWrapperStyle,
          showHeader ? null : { opacity: 0 },
        ]}
        pointerEvents={showHeader ? 'auto' : 'none'}
      >
        <SizableText
          style={[styles.topChromeCycleLabel, { color: cycleLabelColor }, cycleLabelStyle]}
          testID={`${testIDPrefix}-cycle-label`}
        >
          {cycleLabelCount}サイクル
        </SizableText>
        <HourglassBadge
          {...hourglass}
          testIDPrefix={testIDPrefix}
          marginBottom={0}
          rowStyle={[styles.topChromeHourglassRow, hourglassRowStyle]}
          badgeStyle={[styles.topChromeHourglassBadge, hourglass.badgeStyle]}
          iconBaseWidth={HOURGLASS_VARIANTS.gray.baseWidth}
          iconBaseHeight={HOURGLASS_VARIANTS.gray.baseHeight}
        />
      </View>
      <View
        style={[
          styles.topChromePhaseTabsWrapper,
          phaseTabsWrapperStyle,
          phaseTabsTop ? { top: phaseTabsTop } : null,
        ]}
        testID={`${testIDPrefix}-phase-tabs-wrapper`}
      >
        <PhaseTabs {...phaseTabs} testIDPrefix={testIDPrefix} marginBottom={0} />
      </View>
    </>
  );
}

type CircularPhaseTimerProps = {
  phase: SessionPhase;
  primaryColor: string;
  trackColor: string;
  testID: string;
  compact?: boolean;
  enabled?: boolean;
  phaseLabelTestID?: string;
  phaseLabelFontWeight?: TextStyle['fontWeight'];
  phaseLabelStyle?: StyleProp<TextStyle>;
  textTestID?: string;
  timerTextStyle?: StyleProp<TextStyle>;
  size?: number;
  strokeWidth?: number;
  animatedStrokeWidth?: RNAnimated.AnimatedInterpolation<string | number>;
};

export function CircularPhaseTimer({
  phase,
  primaryColor,
  trackColor,
  testID,
  compact = false,
  enabled = true,
  phaseLabelTestID,
  phaseLabelFontWeight,
  phaseLabelStyle,
  textTestID = 'timer-display',
  timerTextStyle,
  size: customSize,
  strokeWidth: customStrokeWidth,
  animatedStrokeWidth,
}: CircularPhaseTimerProps) {
  const smoothRemainingSeconds = useSmoothRemainingSeconds(enabled);
  const totalSeconds = useTimerStore((s) => s.totalSeconds);
  const size = customSize ?? (compact ? 156 : 290);
  const strokeWidth = customStrokeWidth ?? (compact ? 10 : 11);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const displayRemainingSeconds = Math.max(0, Math.ceil(smoothRemainingSeconds));
  const remainingRatio =
    totalSeconds > 0 ? Math.min(1, Math.max(0, smoothRemainingSeconds / totalSeconds)) : 0;
  const dashOffset = -circumference * (1 - remainingRatio);
  const phaseLabelStyles: StyleProp<TextStyle> = [
    styles.timerPhaseLabel,
    { color: primaryColor },
    compact ? styles.timerPhaseLabelCompact : null,
    phaseLabelFontWeight ? { fontWeight: phaseLabelFontWeight } : null,
    phaseLabelStyle,
  ];

  return (
    <View style={[styles.timerWrap, { width: size, height: size }]} testID={testID}>
      <Svg width={size} height={size}>
        <RNAnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={animatedStrokeWidth ?? strokeWidth}
          fill="none"
        />
        <RNAnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={primaryColor}
          strokeWidth={animatedStrokeWidth ?? strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View
        style={[styles.timerCenter, compact ? styles.timerCenterCompact : null]}
        pointerEvents="none"
      >
        {phaseLabelFontWeight ? (
          <Text style={phaseLabelStyles} testID={phaseLabelTestID}>
            {SESSION_PHASE_LABELS[phase]}
          </Text>
        ) : (
          <SizableText style={phaseLabelStyles} testID={phaseLabelTestID}>
            {SESSION_PHASE_LABELS[phase]}
          </SizableText>
        )}
        <SizableText
          style={[
            styles.timerText,
            { color: primaryColor },
            compact ? styles.timerTextCompact : null,
            timerTextStyle,
          ]}
          testID={textTestID}
        >
          {formatMmSs(displayRemainingSeconds)}
        </SizableText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  settingsRow: {
    position: 'absolute',
    top: -4.5,
    right: 38,
  },
  settingsButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    width: 24,
    height: 24,
  },
  pressed: {
    opacity: 0.6,
  },
  badgeRow: {
    alignItems: 'center',
    marginTop: 48,
    marginBottom: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 11.4,
    paddingHorizontal: 18,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  phaseTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    paddingLeft: 0,
  },
  phaseTabItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phaseTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  phaseTabLabel: {
    fontFamily: 'HiraginoSans-W6',
    fontSize: 10,
  },
  phaseTabSeparator: {
    width: 14,
    height: 1.5,
    borderRadius: 999,
    marginHorizontal: 2,
  },
  topChromeHourglassWrapper: {
    position: 'absolute',
    top: '3%',
    left: '13.18%',
    right: '12.94%',
    alignItems: 'flex-start',
  },
  topChromeCycleLabel: {
    marginBottom: 8,
    fontFamily: 'HiraginoSans-W6',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    transform: [{ translateY: 16 }],
  },
  topChromeHourglassRow: {
    marginTop: 20,
    width: '100%',
  },
  topChromeHourglassBadge: {
    width: '100%',
    justifyContent: 'space-between',
    gap: 0,
    paddingVertical: 10,
  },
  topChromePhaseTabsWrapper: {
    position: 'absolute',
    top: SESSION_TOP_CHROME_PHASE_TABS_TOP,
    left: '12.68%',
    right: '13.44%',
  },
  timerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: '0%',
  },
  timerCenterCompact: {
    gap: 2,
  },
  timerPhaseLabel: {
    position: 'absolute',
    top: '30.3%',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 14,
    lineHeight: 24,
  },
  timerPhaseLabelCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  timerText: {
    position: 'absolute',
    top: '41%',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 52,
    fontWeight: '700',
    lineHeight: 62,
  },
  timerTextCompact: {
    fontSize: 32,
    lineHeight: 38,
  },
});
