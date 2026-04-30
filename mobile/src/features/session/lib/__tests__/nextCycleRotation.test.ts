import {
  clampNextCycleRotation,
  normalizeNextCycleRotationDelta,
} from '@/features/session/lib/nextCycleRotation';

describe('nextCycleRotation', () => {
  it('ドラッグ回転量を正負の最大値内に丸める', () => {
    expect(clampNextCycleRotation(1200)).toBe(1080);
    expect(clampNextCycleRotation(-1200)).toBe(-1080);
    expect(clampNextCycleRotation(180)).toBe(180);
  });

  it('360 度境界を跨ぐ差分を短い方向に正規化する', () => {
    expect(normalizeNextCycleRotationDelta(190)).toBe(-170);
    expect(normalizeNextCycleRotationDelta(-190)).toBe(170);
    expect(normalizeNextCycleRotationDelta(90)).toBe(90);
  });
});
