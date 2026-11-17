export interface EstimateAccuracy {
  estimateMin: number;
  actualMin: number;
  /** Actual ÷ estimate. Above 1 means the chunk took longer than planned. */
  ratio: number;
}

/**
 * Planned versus actual focus time for one chunk. Null when the chunk has no
 * estimate or no focus time yet.
 */
export function estimateAccuracy(
  estimateMin: number | null,
  actualSeconds: number,
): EstimateAccuracy | null {
  if (estimateMin === null || estimateMin <= 0 || actualSeconds <= 0) return null;
  const actualMin = actualSeconds / 60;
  return { estimateMin, actualMin, ratio: actualMin / estimateMin };
}
