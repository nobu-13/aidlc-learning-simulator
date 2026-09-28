// JourneySummaries — Completion 判断材料（P2-4）と Result の因果学習サマリ（P2-5）を
// 既存 Ground Truth / ReviewEvaluation / Consequence / Rework から決定的に構築する。
//
// pure・決定的（time/random/locale/mode 非参照）。runtime AI は使わない。表示文言は locale key。
import type { ContributionLevel, DimensionId } from "../entities.ts";
import { JOURNEY_STEP_IDS, type JourneyStepId } from "./journey-entities.ts";
import type { JourneyFinalResult } from "./journey-engine.ts";
import type { ReviewEvaluation } from "./review-evaluator.ts";
import type { JourneyProgress } from "./rework-state-machine.ts";

// ---------- P2-4: Completion Approval Summary ----------

/** Evidence の状態（J6 Test/Evidence の review 結果から決定的に導く）。 */
export type EvidenceStatus = "sufficient" | "insufficient" | "not-reviewed";

export interface CompletionSummary {
  readonly evidenceStatus: EvidenceStatus;
  /** 全 step 合算の未解決 finding（見逃し）数。 */
  readonly unresolvedFindingCount: number;
  /** remaining-risks Dimension の level（残存リスク）。 */
  readonly remainingRisksLevel: ContributionLevel;
  /** rework Dimension の level。 */
  readonly reworkLevel: ContributionLevel;
  /** rework 実施回数。 */
  readonly reworkCount: number;
  /** 完了した Core Journey step 数（J7/J8 を除く J1..J6）。 */
  readonly completedReviewStepCount: number;
  readonly totalReviewStepCount: number;
}

/** J1..J6 の review 対象 step 数（承認 step を除く）。 */
const REVIEW_STEP_IDS: readonly JourneyStepId[] = JOURNEY_STEP_IDS.filter(
  (s) => s !== "j7-completion-approval" && s !== "j8-release-approval",
);

function levelOf(result: JourneyFinalResult, id: DimensionId): ContributionLevel {
  return result.dimensionOutcomes.find((d) => d.dimensionId === id)?.level ?? "neutral";
}

/**
 * Completion 判断材料を決定的に構築する（P2-4）。
 * Release 固有情報（reversibility / release impact）は含めない（Completion ≠ Release を維持）。
 */
export function buildCompletionSummary(
  result: JourneyFinalResult,
  progress: JourneyProgress,
  reviewEvaluationsByStep: ReadonlyMap<JourneyStepId, ReviewEvaluation>,
): CompletionSummary {
  const j6 = reviewEvaluationsByStep.get("j6-test-evidence");
  let evidenceStatus: EvidenceStatus = "not-reviewed";
  if (j6 !== undefined) {
    // J6 に defect があり、見逃していれば insufficient。全て caught なら sufficient。
    evidenceStatus = j6.missedItemIds.length > 0 ? "insufficient" : "sufficient";
  }

  const completedReviewStepCount = REVIEW_STEP_IDS.filter((s) =>
    progress.completedStepIds.includes(s),
  ).length;

  return {
    evidenceStatus,
    unresolvedFindingCount: result.totalMissed,
    remainingRisksLevel: levelOf(result, "remaining-risks"),
    reworkLevel: levelOf(result, "rework"),
    reworkCount: progress.reworkHistory.length,
    completedReviewStepCount,
    totalReviewStepCount: REVIEW_STEP_IDS.length,
  };
}

// ---------- P2-5: Causal Learning Summary ----------

/** 1 件の因果学習エントリ（negative Dimension → 原因・帰結・戻り先）。 */
export interface CausalLearningEntry {
  readonly dimensionId: DimensionId;
  readonly level: ContributionLevel;
  /** その Dimension が negative になった主因の step（見逃しの origin）。 */
  readonly originStepId?: JourneyStepId | undefined;
  /** どこへ戻ると改善できるか（origin と同じ、または関連 review step）。 */
  readonly revisitStepId?: JourneyStepId | undefined;
  /** downstream consequence があれば、その manifest key。 */
  readonly consequenceKey?: string | undefined;
  /** Training Gym で練習できる skill があるか（決定的 mapping）。 */
  readonly gymSuggested: boolean;
}

/** Dimension → 主に関係する review step（決定的 mapping・推測しない）。 */
const DIMENSION_TO_STEP: Partial<Record<DimensionId, JourneyStepId>> = {
  "requirement-clarity": "j1-requirements",
  "acceptance-criteria-coverage": "j2-acceptance-scope",
  "risk-handling": "j3-design",
  traceability: "j4-implementation-traceability",
  "evidence-quality": "j6-test-evidence",
};

/** Training Gym で練習可能とみなす Dimension（既存 Focus/Practice がある領域）。 */
const GYM_DIMENSIONS: ReadonlySet<DimensionId> = new Set<DimensionId>([
  "evidence-quality",
  "approval-boundary",
  "traceability",
  "risk-handling",
]);

/**
 * Final Result から因果学習サマリを決定的に構築する（P2-5）。
 * negative（delta<0）な Dimension のみを対象に、origin step / consequence / revisit step を導く。
 * runtime AI 不要。既存 outcome / consequence から機械的に生成。
 */
export function buildCausalLearningSummary(
  result: JourneyFinalResult,
): readonly CausalLearningEntry[] {
  const negativeLevels: ReadonlySet<ContributionLevel> = new Set<ContributionLevel>([
    "negative",
    "strong-negative",
  ]);
  const entries: CausalLearningEntry[] = [];

  for (const outcome of result.dimensionOutcomes) {
    if (!negativeLevels.has(outcome.level)) continue;
    const dimensionId = outcome.dimensionId;
    const originStepId = DIMENSION_TO_STEP[dimensionId];
    // このディメンションに寄与した consequence（addsRiskDimensionIds に含むもの）を探す。
    const consequence = result.consequences.find((c) => c.addsRiskDimensionIds.includes(dimensionId));

    entries.push({
      dimensionId,
      level: outcome.level,
      originStepId,
      revisitStepId: consequence?.sourceStepId ?? originStepId,
      consequenceKey: consequence?.manifestItemKey,
      gymSuggested: GYM_DIMENSIONS.has(dimensionId),
    });
  }
  return entries;
}
