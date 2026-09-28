// JourneyResult — Journey 全体の Dimension 寄与を集約し、既存 9 Dimension semantic で決定的に畳み込む
// （Design §11/§12）。
//
// 重要: 既存 dimension-evaluator.ts の fold semantic（単調 = clamp 合計、非単調 = 正負同居で不均衡ペナルティ）
// と同一の規則で畳む。scoring semantic を変えないため、同じ規則をここでも厳密に再現する。
// pure・決定的（time / random / locale / mode 非参照）。
import type { ContributionLevel, DimensionId } from "../entities.ts";
import { DIMENSION_IDS, NON_MONOTONIC_DIMENSIONS } from "../entities.ts";
import type { DimensionContribution } from "./dimension-effect-adapter.ts";

const LEVEL_TO_SCORE: Record<ContributionLevel, number> = {
  "strong-negative": -2,
  negative: -1,
  neutral: 0,
  positive: 1,
  "strong-positive": 2,
};

function scoreToLevel(score: number): ContributionLevel {
  if (score <= -2) return "strong-negative";
  if (score === -1) return "negative";
  if (score === 0) return "neutral";
  if (score === 1) return "positive";
  return "strong-positive";
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * 既存 dimension-evaluator.foldDimensionScore と同一 semantic で畳み込む。
 * 単調 Dimension: 合計を [-2,2] にクランプ。
 * 非単調 Dimension: 正負同居なら不均衡ペナルティで負へ寄せる / 負のみそのまま / 正のみは [0,2]。
 */
function foldScores(dimensionId: DimensionId, levels: readonly ContributionLevel[]): number {
  let posSum = 0;
  let negSum = 0;
  for (const lv of levels) {
    const s = LEVEL_TO_SCORE[lv];
    if (s > 0) posSum += s;
    else if (s < 0) negSum += s;
  }
  if (!NON_MONOTONIC_DIMENSIONS.has(dimensionId)) {
    return clamp(posSum + negSum, -2, 2);
  }
  const hasPos = posSum > 0;
  const hasNeg = negSum < 0;
  if (hasPos && hasNeg) {
    return clamp(-(Math.abs(posSum) + Math.abs(negSum)), -2, 0);
  }
  if (hasNeg) return clamp(negSum, -2, 0);
  if (hasPos) return clamp(posSum, 0, 2);
  return 0;
}

/** Journey 全体の 1 Dimension の結果。 */
export interface JourneyDimensionOutcome {
  readonly dimensionId: DimensionId;
  readonly level: ContributionLevel;
  readonly reasonKeys: readonly string[];
}

/**
 * Journey 全体で集めた DimensionContribution 列を 9 Dimension の結果へ畳み込む。
 * 固定 9 Dimension を必ず出力（欠落は neutral）。順序は DIMENSION_IDS。
 */
export function foldJourneyContributions(
  contributions: readonly DimensionContribution[],
): readonly JourneyDimensionOutcome[] {
  const byDim = new Map<DimensionId, ContributionLevel[]>();
  const reasons = new Map<DimensionId, string[]>();
  for (const c of contributions) {
    const arr = byDim.get(c.dimensionId) ?? [];
    arr.push(c.level);
    byDim.set(c.dimensionId, arr);
    const r = reasons.get(c.dimensionId) ?? [];
    if (!r.includes(c.reasonKey)) r.push(c.reasonKey);
    reasons.set(c.dimensionId, r);
  }

  return DIMENSION_IDS.map((id) => {
    const levels = byDim.get(id) ?? [];
    return {
      dimensionId: id,
      level: scoreToLevel(foldScores(id, levels)),
      reasonKeys: reasons.get(id) ?? [],
    };
  });
}
