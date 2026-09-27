// DimensionEvaluator — 決定的な 9 Dimension 算出（ADR-005 / BR3.x / NFR2）。
//
// 入力: DecisionRecord 列 + immutable Scenario context + EffectRules（+ ApprovalSemantics は
//   非単調判定の一部として内包）。UI / locale / mode / current time / random を入力にしない（BR3.1）。
// 出力: 固定 9 DimensionOutcome（level + 寄与 DecisionRecord）。同一入力→同一結果、順序入替でも不変（BR3.2）。
// 非単調 Dimension（delegation-quality / approval-boundary / risk-handling）は過少・過剰の双方を
//   negative 側へ寄せる（BR3.4）。invariant 違反は DomainInvariantError（silent partial score なし・BR3.6）。
import {
  DIMENSION_IDS,
  NON_MONOTONIC_DIMENSIONS,
  type ContributionLevel,
  type DecisionRecord,
  type DimensionId,
  type DimensionOutcome,
  type ValidatedScenario,
} from "./entities.ts";
import { DomainInvariantError } from "./errors.ts";
import { collectAppliedEffects, type AppliedEffect } from "./decision-effect-rules.ts";
import { deriveDimensionOutcomeId } from "./semantic-id.ts";

// 離散 5 段階 ⇔ 内部数値 map（authoring は意味名、実装内部で数値化：BR3.3）。
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

/**
 * 単調 Dimension: 寄与スコアの合計を [-2, 2] にクランプして level 化。
 * 非単調 Dimension: 正負が混在（過少 negative と過剰 positive が両立）する場合、
 *   「バランスが取れていない」ことを負に評価する。具体的には、正寄与と負寄与の両方が
 *   存在するときは打ち消さず、絶対値の大きい側から不均衡ペナルティを引いて negative 側へ寄せる。
 *   これにより「過少介入も過剰介入も negative」という非単調性を決定的に表現する（BR3.4）。
 */
function foldDimensionScore(dimensionId: DimensionId, effects: readonly AppliedEffect[]): number {
  let posSum = 0;
  let negSum = 0;
  for (const e of effects) {
    const s = LEVEL_TO_SCORE[e.rule.contribution];
    if (s > 0) posSum += s;
    else if (s < 0) negSum += s; // negSum は 0 以下
  }

  if (!NON_MONOTONIC_DIMENSIONS.has(dimensionId)) {
    // 単調: 単純合計をクランプ。
    return clamp(posSum + negSum, -2, 2);
  }

  // 非単調: 正負が両立するときは不均衡として負へ寄せる。
  const hasPos = posSum > 0;
  const hasNeg = negSum < 0;
  if (hasPos && hasNeg) {
    // 過少（negative 寄与）と過剰（positive 寄与）が同居 = バランスを欠く判断列。
    // 打ち消さず、負の存在を優先して negative 側へ。
    const imbalance = -(Math.abs(posSum) + Math.abs(negSum));
    return clamp(imbalance, -2, 0);
  }
  if (hasNeg) {
    // 過少介入のみ: そのまま negative。
    return clamp(negSum, -2, 0);
  }
  if (hasPos) {
    // 適切な介入（正寄与のみ）: positive を許容するが、非単調 Dimension は過剰を戒めるため
    // 単調より控えめに（合計を [0,2] にクランプ）。
    return clamp(posSum, 0, 2);
  }
  return 0;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * 9 Dimension を決定的に算出する。effects の集約は Map 経由で順序非依存、
 * contributingDecisionRecordIds は DecisionRecord の orderIndex 昇順に正規化して
 * 順序不変性を保つ（BR3.2）。
 */
export function evaluateDimensions(
  scenario: ValidatedScenario,
  sessionId: string,
  records: readonly DecisionRecord[],
): readonly DimensionOutcome[] {
  const byDimension = collectAppliedEffects(scenario, records);
  // 寄与 DecisionRecord の順序正規化用に orderIndex を引けるようにする。
  const orderOf = new Map<string, number>();
  for (const r of records) orderOf.set(r.decisionRecordId, r.orderIndex);

  const outcomes: DimensionOutcome[] = [];
  for (const dimensionId of DIMENSION_IDS) {
    const effects = byDimension.get(dimensionId) ?? [];
    const score = foldDimensionScore(dimensionId, effects);
    const level = scoreToLevel(score);

    // 寄与 DecisionRecord（重複排除 + orderIndex 昇順で正規化 → 順序不変）。
    const contributing = [...new Set(effects.map((e) => e.decisionRecordId))].sort((a, b) => {
      const oa = orderOf.get(a) ?? 0;
      const ob = orderOf.get(b) ?? 0;
      if (oa !== ob) return oa - ob;
      return a < b ? -1 : a > b ? 1 : 0;
    });

    outcomes.push({
      dimensionOutcomeId: deriveDimensionOutcomeId(sessionId, dimensionId),
      dimensionId,
      sessionId,
      level,
      contributingDecisionRecordIds: contributing,
      isEducationalSimulationValue: true,
    });
  }

  // invariant: 必ず 9 Dimension を出力（BR3.5）。欠落は DomainInvariantError（silent partial なし・BR3.6）。
  if (outcomes.length !== DIMENSION_IDS.length) {
    throw new DomainInvariantError(
      `評価は固定 ${DIMENSION_IDS.length} Dimension を出力する必要があります（実際: ${outcomes.length}）`,
    );
  }
  return outcomes;
}
