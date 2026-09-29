// JourneySummaries — Completion 判断材料（P2-4）と Result の因果学習サマリ（P2-5）を
// 既存 Ground Truth / ReviewEvaluation / Consequence / Rework から決定的に構築する。
//
// pure・決定的（time/random/locale/mode 非参照）。runtime AI は使わない。表示文言は locale key。
import type { ContributionLevel, DimensionId } from "../entities.ts";
import {
  JOURNEY_STEP_IDS,
  type ApprovalDecision,
  type ApprovalRequirement,
  type JourneyStepId,
  type ReleaseImpact,
  type Reversibility,
  type Severity,
} from "./journey-entities.ts";
import type { JourneyFinalResult } from "./journey-engine.ts";
import type { ReviewEvaluation } from "./review-evaluator.ts";
import type { JourneyProgress } from "./rework-state-machine.ts";
import {
  openConditions as computeOpenConditions,
  type ConditionalApproval,
} from "./conditional-approval.ts";

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

// ---------- RC4 Integrity (STEP 4): Decision Readiness Summary ----------
//
// Completion / Release / Result が「同じ state から同じ判断材料」を見るための single derived model。
// 画面ごとに件数や severity を別計算しない（同じ state なら常に同じ数字）。P1-3 の根本対策。

/** 未解決 finding の最高深刻度。unresolved が 0 のときは "none"。 */
export type HighestSeverity = "none" | Severity;

/** 1 件の残存リスク（見逃し由来の後工程顕在化）。 */
export interface ResidualRiskItem {
  /** 表示文言 key（consequence の manifestItemKey）。 */
  readonly manifestItemKey: string;
  /** その残存リスクの発生源 step（origin）。 */
  readonly originStepId: JourneyStepId;
  /** 顕在化する後工程 step。 */
  readonly atStepId: JourneyStepId;
}

/**
 * Completion / Release / Result 共通の判断材料（決定的・single source）。
 * 「ユーザーが直前の画面を記憶しなくても判断できる」ために必要な情報を 1 箇所へ集約する。
 */
export interface DecisionReadinessSummary {
  readonly evidenceStatus: EvidenceStatus;
  /** 全 step 合算の未解決 finding（見逃し）数。 */
  readonly unresolvedFindingCount: number;
  /** 未解決 finding の最高深刻度（none/low/medium/high）。 */
  readonly highestSeverity: HighestSeverity;
  /** remaining-risks Dimension の level（残存リスクの総合評価）。 */
  readonly remainingRisksLevel: ContributionLevel;
  /** 残存リスクの内訳（見逃し由来の後工程顕在化・origin 付き）。 */
  readonly residualRisks: readonly ResidualRiskItem[];
  /** 残存リスクの発生源 step 集合（決定的順序・重複排除）。 */
  readonly originStepIds: readonly JourneyStepId[];
  readonly reworkLevel: ContributionLevel;
  readonly reworkCount: number;
  readonly completedReviewStepCount: number;
  readonly totalReviewStepCount: number;
  /** Completion 承認判断（未確定なら undefined）。Release/Result で「直前の判断」を持ち越すため。 */
  readonly completionDecision?: ApprovalDecision | undefined;
  /** Completion が条件付き承認（approve-with-conditions）だったか。 */
  readonly isConditionalCompletion: boolean;
  /**
   * RC5 P1-D: 未解決の承認条件（open conditional approvals）。
   * Completion / Release / Result で同じ derived model として消えずに提示する。
   */
  readonly openConditions: readonly ConditionalApproval[];
  /**
   * RC5 P2-D: Evidence semantics を分離する。「Evidence 十分」の一語で異なる概念を束ねない。
   *  - evidenceArtifactStatus: 証跡アーティファクト自体が揃っているか（J6 review ベース）。
   *  - traceabilityStatus    : トレーサビリティが揃っているか（traceability dimension ベース）。
   *  - endToEndAssurance     : 上記＋残存リスクを総合したエンドツーエンドの保証水準。
   * 例: Evidence artifact = complete でも Traceability = incomplete なら assurance = partial。
   */
  readonly evidenceArtifactStatus: "complete" | "incomplete";
  readonly traceabilityStatus: "complete" | "incomplete";
  readonly endToEndAssurance: "sufficient" | "partial" | "insufficient";
  /**
   * RC6 Parameter Sensitivity: 承認体制・リリース影響・可逆性を Completion/Release 判断材料へ反映する。
   * これらの structured 軸が observable に決定判断へ効くことを保証する（UI 宣言との整合）。
   */
  readonly approvalRegime: ApprovalRequirement;
  readonly releaseImpactLevel: ReleaseImpact;
  readonly reversibilityLevel: Reversibility;
  /** releaseImpact=high かつ approvalRequirement=single（承認体制が影響度に見合わない）か。 */
  readonly approvalRegimeGap: boolean;
  /** reversibility=irreversible（戻せない前提での承認）か。 */
  readonly irreversible: boolean;
}

const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 };

/**
 * 未解決（missed）finding の最高深刻度を決定的に導く。
 * result.reviewEvaluations と defect severity から算出（step ごとの missed item を defect へ対応付け）。
 */
function computeHighestSeverity(
  result: JourneyFinalResult,
  reviewEvaluationsByStep: ReadonlyMap<JourneyStepId, ReviewEvaluation>,
  severityOfMissedItem: (stepId: JourneyStepId, itemId: string) => Severity | undefined,
): HighestSeverity {
  let best: Severity | undefined;
  for (const [stepId, evaluation] of reviewEvaluationsByStep) {
    for (const itemId of evaluation.missedItemIds) {
      const sev = severityOfMissedItem(stepId, itemId);
      if (sev === undefined) continue;
      if (best === undefined || SEVERITY_RANK[sev] > SEVERITY_RANK[best]) best = sev;
    }
  }
  void result;
  return best ?? "none";
}

/**
 * Decision Readiness Summary を決定的に構築する（STEP 4）。
 * Completion / Release / Result で共有する single derived model。
 *
 * @param severityOfMissedItem step/item から Ground Truth severity を引く関数（呼び出し側が defect set を渡す）。
 */
export function buildDecisionReadinessSummary(args: {
  readonly result: JourneyFinalResult;
  readonly progress: JourneyProgress;
  readonly reviewEvaluationsByStep: ReadonlyMap<JourneyStepId, ReviewEvaluation>;
  readonly severityOfMissedItem: (stepId: JourneyStepId, itemId: string) => Severity | undefined;
  readonly completionDecision?: ApprovalDecision | undefined;
  /** RC5 P1-D: 現在保持している全条件（open のみ抽出する）。 */
  readonly conditionalApprovals?: readonly ConditionalApproval[] | undefined;
  /**
   * RC6 Parameter Sensitivity: 承認体制・リリース影響・可逆性の structured 値。
   * これらを判断材料へ反映する（observable に decision へ効く）。
   */
  readonly approvalRegime: ApprovalRequirement;
  readonly releaseImpactLevel: ReleaseImpact;
  readonly reversibilityLevel: Reversibility;
}): DecisionReadinessSummary {
  const { result, progress, reviewEvaluationsByStep, severityOfMissedItem, completionDecision } = args;

  const base = buildCompletionSummary(result, progress, reviewEvaluationsByStep);

  const highestSeverity = computeHighestSeverity(result, reviewEvaluationsByStep, severityOfMissedItem);

  // 残存リスク = 見逃し由来の後工程顕在化（consequences）。決定的順序（既に defectId 昇順で来る）。
  const residualRisks: ResidualRiskItem[] = result.consequences.map((c) => ({
    manifestItemKey: c.manifestItemKey,
    originStepId: c.sourceStepId,
    atStepId: c.atStepId,
  }));

  // origin step 集合（決定的順序 = JOURNEY_STEP_IDS 順・重複排除）。
  const originSet = new Set<JourneyStepId>(residualRisks.map((r) => r.originStepId));
  const originStepIds = JOURNEY_STEP_IDS.filter((s) => originSet.has(s));

  return {
    evidenceStatus: base.evidenceStatus,
    unresolvedFindingCount: base.unresolvedFindingCount,
    highestSeverity,
    remainingRisksLevel: base.remainingRisksLevel,
    residualRisks,
    originStepIds,
    reworkLevel: base.reworkLevel,
    reworkCount: base.reworkCount,
    completedReviewStepCount: base.completedReviewStepCount,
    totalReviewStepCount: base.totalReviewStepCount,
    ...(completionDecision !== undefined ? { completionDecision } : {}),
    isConditionalCompletion: completionDecision === "approve-with-conditions",
    openConditions: computeOpenConditions(args.conditionalApprovals ?? []),
    // RC6 Parameter Sensitivity: 承認体制・リリース影響・可逆性を判断材料へ反映。
    approvalRegime: args.approvalRegime,
    releaseImpactLevel: args.releaseImpactLevel,
    reversibilityLevel: args.reversibilityLevel,
    // releaseImpact=high かつ single 承認 = 承認体制が影響度に見合わない。
    approvalRegimeGap: args.releaseImpactLevel === "high" && args.approvalRegime === "single",
    irreversible: args.reversibilityLevel === "irreversible",
    ...deriveEvidenceSemantics(result, base.evidenceStatus, residualRisks.length),
  };
}

/**
 * RC5 P2-D: Evidence artifact status / traceability status / end-to-end assurance を分離導出する。
 *  - evidenceArtifactStatus: J6 evidence review が sufficient なら complete、それ以外は incomplete。
 *  - traceabilityStatus    : traceability dimension が negative 系なら incomplete、それ以外 complete。
 *  - endToEndAssurance     : evidence & traceability が complete かつ残存リスク 0 → sufficient。
 *                            どちらか incomplete か残存リスクあり → partial、両方 incomplete or 残存リスク大 → insufficient。
 */
function deriveEvidenceSemantics(
  result: JourneyFinalResult,
  evidenceStatus: EvidenceStatus,
  residualRiskCount: number,
): {
  readonly evidenceArtifactStatus: "complete" | "incomplete";
  readonly traceabilityStatus: "complete" | "incomplete";
  readonly endToEndAssurance: "sufficient" | "partial" | "insufficient";
} {
  const evidenceArtifactStatus: "complete" | "incomplete" =
    evidenceStatus === "sufficient" ? "complete" : "incomplete";
  const traceLevel = levelOf(result, "traceability");
  const traceNegative = traceLevel === "negative" || traceLevel === "strong-negative";
  const traceabilityStatus: "complete" | "incomplete" = traceNegative ? "incomplete" : "complete";

  const evComplete = evidenceArtifactStatus === "complete";
  const trComplete = traceabilityStatus === "complete";
  let endToEndAssurance: "sufficient" | "partial" | "insufficient";
  if (evComplete && trComplete && residualRiskCount === 0) {
    endToEndAssurance = "sufficient";
  } else if (!evComplete && !trComplete) {
    endToEndAssurance = "insufficient";
  } else {
    // どちらか一方が欠ける、または残存リスクがある → 部分的な保証。
    endToEndAssurance = residualRiskCount > 0 && (!evComplete || !trComplete) ? "insufficient" : "partial";
  }
  return { evidenceArtifactStatus, traceabilityStatus, endToEndAssurance };
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

// ---------- RC4 Final（STEP I）: Result Highlights（上部サマリ） ----------

/** Result 上部に出す「最重要サマリ」。詳細（既存カード）は下部へ残す。 */
export interface ResultHighlights {
  /** 最重要の学び（最大 3 件・negative dimension を深刻度順）。 */
  readonly topLearnings: readonly CausalLearningEntry[];
  /**
   * 最も危険だった Decision の locale key（無ければ undefined）。
   * 「残存リスクがあるのに Release を通した」等を決定的に判定する。
   */
  readonly mostDangerousDecisionKey?: string | undefined;
  /** 次に練習する 1 件（gymSuggested な causal entry の先頭）。 */
  readonly practiceNext?: CausalLearningEntry | undefined;
}

const LEVEL_SEVERITY: Record<ContributionLevel, number> = {
  "strong-negative": 0,
  negative: 1,
  neutral: 2,
  positive: 3,
  "strong-positive": 4,
};

/**
 * Result Highlights を決定的に構築する（STEP I）。
 * - topLearnings: causal entries を level 深刻度順 → dimensionId 昇順で安定ソートし最大 3 件。
 * - mostDangerousDecision: 残存リスク（consequences）や高深刻度見逃しがある状態で Release/Completion を
 *   approve/approve-with-conditions した場合を「危険」と判定（決定的・locale key）。
 * - practiceNext: gymSuggested な causal entry の先頭。
 */
export function buildResultHighlights(
  result: JourneyFinalResult,
  causal: readonly CausalLearningEntry[],
  completionDecision: string | undefined,
  releaseDecision: string | undefined,
): ResultHighlights {
  const sorted = [...causal].sort((a, b) => {
    const s = LEVEL_SEVERITY[a.level] - LEVEL_SEVERITY[b.level];
    if (s !== 0) return s;
    return a.dimensionId < b.dimensionId ? -1 : a.dimensionId > b.dimensionId ? 1 : 0;
  });
  const topLearnings = sorted.slice(0, 3);
  const practiceNext = sorted.find((c) => c.gymSuggested);

  const hasRemainingRisk = result.consequences.length > 0 || result.totalMissed > 0;
  const approved = (d: string | undefined): boolean =>
    d === "approve" || d === "approve-with-conditions";

  let mostDangerousDecisionKey: string | undefined;
  if (hasRemainingRisk && approved(releaseDecision)) {
    // 残存リスクがあるのに Release を通した = 最も危険。
    mostDangerousDecisionKey = "rc4.result.danger.releaseWithRisk";
  } else if (hasRemainingRisk && approved(completionDecision)) {
    mostDangerousDecisionKey = "rc4.result.danger.completionWithRisk";
  } else if (result.totalMissed > 0) {
    mostDangerousDecisionKey = "rc4.result.danger.missed";
  }

  return {
    topLearnings,
    ...(mostDangerousDecisionKey !== undefined ? { mostDangerousDecisionKey } : {}),
    ...(practiceNext !== undefined ? { practiceNext } : {}),
  };
}
