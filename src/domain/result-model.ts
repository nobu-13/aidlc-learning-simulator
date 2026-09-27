// ResultModel — 1 完了に対する LearningResult を構築する（FR7 / BR3.5）。
// 9 DimensionOutcome を必ず含み、rework / remaining-risks の Outcome を明示参照する。pure・決定的。
import type { DecisionRecord, DimensionOutcome, LearningResult, ValidatedScenario } from "./entities.ts";
import { DomainInvariantError } from "./errors.ts";
import { evaluateDimensions } from "./dimension-evaluator.ts";
import { deriveLearningResultId } from "./semantic-id.ts";

export function buildLearningResult(
  scenario: ValidatedScenario,
  sessionId: string,
  records: readonly DecisionRecord[],
): LearningResult {
  const dimensionOutcomes = evaluateDimensions(scenario, sessionId, records);

  const byId = new Map<string, DimensionOutcome>();
  for (const o of dimensionOutcomes) byId.set(o.dimensionId, o);

  const rework = byId.get("rework");
  const remaining = byId.get("remaining-risks");
  if (rework === undefined || remaining === undefined) {
    // 9 Dimension 固定なので通常起きないが、silent partial を返さず invariant を守る（BR3.6）。
    throw new DomainInvariantError("LearningResult に rework / remaining-risks Dimension が必要です");
  }

  return {
    learningResultId: deriveLearningResultId(sessionId),
    sessionId,
    dimensionOutcomes,
    decisionRecordIds: records.map((r) => r.decisionRecordId),
    remainingRiskDimensionOutcomeId: remaining.dimensionOutcomeId,
    reworkDimensionOutcomeId: rework.dimensionOutcomeId,
  };
}
