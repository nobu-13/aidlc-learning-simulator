// DimensionEffectAdapter — Review 診断結果を既存 9 Dimension Effect へ変換する明示的 boundary
// （Design §11 / Human Decision 3）。
//
// 目的: 既存 dimension-evaluator.ts の semantic を一切変えずに、Artifact Review の結果を 9 Dimension へ
// 反映する。ここが唯一の変換点。Review Diagnostic Metrics（TP/FP/FN/coverage）と 9 Dimension を
// 混同しない — 診断指標そのものは Dimension に足し込まず、「defect を捕らえたか/見逃したか/gate が妥当か」
// という判断結果のみを ContributionLevel へ写像する。pure・決定的。
import type { ContributionLevel, DimensionId } from "../entities.ts";
import { DIMENSION_IDS } from "../entities.ts";
import type { DefectDefinition, GateDecision } from "./journey-entities.ts";
import type { ReviewEvaluation } from "./review-evaluator.ts";

/** 1 つの Dimension への寄与（Adapter の出力単位）。 */
export interface DimensionContribution {
  readonly dimensionId: DimensionId;
  readonly level: ContributionLevel;
  /** 寄与の由来（説明可能性）。 */
  readonly reasonKey: string;
}

const SCORE_TO_LEVEL = (score: number): ContributionLevel => {
  if (score <= -2) return "strong-negative";
  if (score === -1) return "negative";
  if (score === 0) return "neutral";
  if (score === 1) return "positive";
  return "strong-positive";
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** gate 判断が approval-boundary に与える寄与（未解決 defect のまま approve は境界違反）。 */
function gateContribution(gate: GateDecision, missedCount: number): number {
  const passing = gate === "approve" || gate === "approve-with-conditions";
  if (passing && missedCount > 0) {
    // 未解決 defect を残して通す = approval boundary を踏み越えた。
    return gate === "approve" ? -2 : -1;
  }
  if (passing && missedCount === 0) return 1; // clean を正しく通した。
  // return / block / change-scope: 見逃しがあるなら妥当（境界を守った）。
  return missedCount > 0 ? 1 : 0;
}

/**
 * 1 つの Artifact Review evaluation を Dimension 寄与へ変換する。
 * - caught defect → その defect の relatedDimensionIds へ positive。
 * - missed defect → その defect の relatedDimensionIds へ negative（見逃しの帰結）。
 * - false positive → 過剰 review。delegation-quality（非単調）へ弱い negative（過剰介入の含意）。
 * - gate 判断 → approval-boundary へ寄与。
 * 集約は Dimension ごとに合計し clamp。決定的。
 */
export function reviewToDimensionContributions(
  evaluation: ReviewEvaluation,
  stepDefects: readonly DefectDefinition[],
): readonly DimensionContribution[] {
  const scores = new Map<DimensionId, number>();
  const reasons = new Map<DimensionId, string>();
  const add = (id: DimensionId, delta: number, reasonKey: string): void => {
    scores.set(id, (scores.get(id) ?? 0) + delta);
    if (!reasons.has(id)) reasons.set(id, reasonKey);
  };

  const defectById = new Map<string, DefectDefinition>();
  for (const d of stepDefects) defectById.set(d.itemId, d);

  for (const fo of evaluation.findingOutcomes) {
    const defect = defectById.get(fo.itemId);
    if (fo.kind === "caught" && defect) {
      for (const dim of defect.relatedDimensionIds) add(dim, 1, "rc3.effect.caught");
    } else if (fo.kind === "missed" && defect) {
      for (const dim of defect.relatedDimensionIds) add(dim, -1, "rc3.effect.missed");
    } else if (fo.kind === "false") {
      // 過剰 review。委任・介入バランスの含意として delegation-quality（非単調）へ弱い負。
      add("delegation-quality", -1, "rc3.effect.false");
    }
  }

  // gate 判断 → approval-boundary。
  add(
    "approval-boundary",
    gateContribution(evaluation.gateDecision, evaluation.missedItemIds.length),
    "rc3.effect.gate",
  );

  const out: DimensionContribution[] = [];
  for (const id of DIMENSION_IDS) {
    if (!scores.has(id)) continue;
    const raw = clamp(scores.get(id) ?? 0, -2, 2);
    out.push({ dimensionId: id, level: SCORE_TO_LEVEL(raw), reasonKey: reasons.get(id) ?? "rc3.effect.generic" });
  }
  return out;
}

/**
 * Approval 判断（Completion / Release）を Dimension 寄与へ変換する。
 * - 未解決 finding があるのに approve → approval-boundary strong-negative + remaining-risks negative。
 * - Completion を Release と混同（completion 通過を理由に無条件 release）→ 呼び出し側が conflated=true を渡す。
 */
export function approvalToDimensionContributions(args: {
  readonly decision: "approve" | "approve-with-conditions" | "return" | "block";
  readonly unresolvedFindingCount: number;
  readonly isRelease: boolean;
  readonly conflatedWithCompletion?: boolean | undefined;
  readonly remainingRiskHigh?: boolean | undefined;
}): readonly DimensionContribution[] {
  const out: DimensionContribution[] = [];
  const passing = args.decision === "approve" || args.decision === "approve-with-conditions";

  if (passing && args.unresolvedFindingCount > 0) {
    out.push({
      dimensionId: "approval-boundary",
      level: args.decision === "approve" ? "strong-negative" : "negative",
      reasonKey: "rc3.effect.approveUnresolved",
    });
    out.push({ dimensionId: "remaining-risks", level: "negative", reasonKey: "rc3.effect.approveUnresolved" });
  } else if (passing && args.unresolvedFindingCount === 0) {
    out.push({ dimensionId: "approval-boundary", level: "positive", reasonKey: "rc3.effect.approveClean" });
  }

  if (args.isRelease && args.conflatedWithCompletion === true) {
    // Completion approved を理由に Release を自動承認した = C6 違反相当。
    out.push({ dimensionId: "approval-boundary", level: "strong-negative", reasonKey: "rc3.effect.conflate" });
    out.push({ dimensionId: "remaining-risks", level: "negative", reasonKey: "rc3.effect.conflate" });
  }

  if (args.isRelease && passing && args.remainingRiskHigh === true) {
    out.push({ dimensionId: "remaining-risks", level: "negative", reasonKey: "rc3.effect.releaseRisk" });
  }

  return out;
}
