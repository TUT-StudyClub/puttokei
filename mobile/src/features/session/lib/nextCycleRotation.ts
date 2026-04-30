const DEFAULT_MAX_DRAG_ROTATION_DEGREES = 1080;
const DEFAULT_ROTATE_THRESHOLD_DEGREES = 360;

export function clampNextCycleRotation(
  rotation: number,
  maxRotation = DEFAULT_MAX_DRAG_ROTATION_DEGREES,
) {
  return Math.max(-maxRotation, Math.min(maxRotation, rotation));
}

export function normalizeNextCycleRotationDelta(
  delta: number,
  threshold = DEFAULT_ROTATE_THRESHOLD_DEGREES,
) {
  if (delta > threshold / 2) return delta - threshold;
  if (delta < -threshold / 2) return delta + threshold;
  return delta;
}
