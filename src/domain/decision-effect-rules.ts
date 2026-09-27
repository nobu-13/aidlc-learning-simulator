// DecisionEffectRules — EffectRule の決定的適用（ADR-005 / BR3.1）。
// condition は決定的述語（DecisionRecord 列に対して評価）。time/random/locale/mode 非参照・副作用なし。
import type { DecisionRecord, EffectCondition, EffectRule, ValidatedScenario } from "./entities.ts";

/** 選択された optionId の集合（condition 評価の入力）。 */
export function chosenOptionIdSet(records: readonly DecisionRecord[]): ReadonlySet<string> {
  const s = new Set<string>();
  for (const r of records) s.add(r.chosenDecisionOptionId);
  return s;
}

/** condition を決定的に評価する。condition 省略時は常に true（無条件適用）。 */
export function evaluateCondition(
  condition: EffectCondition | undefined,
  chosen: ReadonlySet<string>,
): boolean {
  if (condition === undefined) return true;
  switch (condition.kind) {
    case "requires-decision":
      return condition.anyOfOptionIds.some((id) => chosen.has(id));
    case "absent-decision":
      return condition.noneOfOptionIds.every((id) => !chosen.has(id));
    default: {
      // discriminated union の網羅性を型で担保。
      const _exhaustive: never = condition;
      return _exhaustive;
    }
  }
}

/**
 * 選択された decision 列から、適用される EffectRule 群を Dimension ごとに集める。
 * 各 DecisionRecord.chosenDecisionOptionId → DecisionOption.effectRuleRefs → EffectRule を辿り、
 * condition を満たすものだけを採用する。note は入力にしない（BR3.1）。
 * 戻り値は「dimensionId → その Dimension に効く (rule, 寄与 DecisionRecord) のリスト」。
 */
export interface AppliedEffect {
  readonly rule: EffectRule;
  readonly decisionRecordId: string;
}

export function collectAppliedEffects(
  scenario: ValidatedScenario,
  records: readonly DecisionRecord[],
): ReadonlyMap<string, readonly AppliedEffect[]> {
  const chosen = chosenOptionIdSet(records);
  const byDimension = new Map<string, AppliedEffect[]>();

  for (const record of records) {
    const option = scenario.decisionOptions.get(record.chosenDecisionOptionId);
    if (option === undefined) continue; // Loader が dangling を排除済みだが防御的に skip。
    for (const effectRuleId of option.effectRuleRefs) {
      const rule = scenario.effectRules.get(effectRuleId);
      if (rule === undefined) continue;
      if (!evaluateCondition(rule.condition, chosen)) continue;
      const list = byDimension.get(rule.dimensionId) ?? [];
      list.push({ rule, decisionRecordId: record.decisionRecordId });
      byDimension.set(rule.dimensionId, list);
    }
  }
  return byDimension;
}
