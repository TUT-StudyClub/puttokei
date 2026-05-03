/**
 * AnnotatedOutputImage の純粋ロジック (computeRenderArea) を検証する。
 *
 * letterbox 計算は数値だけのロジックなので component を render せず、
 * 関数を直接呼ぶ形で 4 ケース (横長 / 縦長 / 同比率 / 0 寸法) を確認する。
 */
import { computeRenderArea } from '@/features/session/components/AnnotatedOutputImage';

describe('computeRenderArea', () => {
  it('画像が container より横長の場合は上下に letterbox を入れる', () => {
    // container 400x300 (4:3), natural 1600x800 (2:1, より横長)
    const area = computeRenderArea({ width: 400, height: 300 }, { width: 1600, height: 800 });
    expect(area).toEqual({
      offsetX: 0,
      offsetY: 50, // (300 - 200) / 2
      width: 400,
      height: 200, // 400 / 2
    });
  });

  it('画像が container より縦長の場合は左右に letterbox を入れる', () => {
    // container 400x300 (4:3), natural 600x1200 (1:2, より縦長)
    const area = computeRenderArea({ width: 400, height: 300 }, { width: 600, height: 1200 });
    expect(area).toEqual({
      offsetX: 125, // (400 - 150) / 2
      offsetY: 0,
      width: 150, // 300 * 0.5
      height: 300,
    });
  });

  it('container と画像のアスペクト比が一致する場合は letterbox なし', () => {
    // container 400x300 (4:3), natural 800x600 (4:3)
    const area = computeRenderArea({ width: 400, height: 300 }, { width: 800, height: 600 });
    expect(area).toEqual({
      offsetX: 0,
      offsetY: 0,
      width: 400,
      height: 300,
    });
  });

  it('container / natural のいずれかが null の場合は null を返す', () => {
    expect(computeRenderArea(null, { width: 800, height: 600 })).toBeNull();
    expect(computeRenderArea({ width: 400, height: 300 }, null)).toBeNull();
    expect(computeRenderArea(null, null)).toBeNull();
  });

  it('寸法に 0 が含まれる場合は null を返す (zero-divide 防止)', () => {
    expect(computeRenderArea({ width: 0, height: 300 }, { width: 800, height: 600 })).toBeNull();
    expect(computeRenderArea({ width: 400, height: 0 }, { width: 800, height: 600 })).toBeNull();
    expect(computeRenderArea({ width: 400, height: 300 }, { width: 0, height: 600 })).toBeNull();
    expect(computeRenderArea({ width: 400, height: 300 }, { width: 800, height: 0 })).toBeNull();
  });
});
