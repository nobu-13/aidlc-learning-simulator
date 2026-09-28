// DecisionJudgment — 選んだ option の望ましさ（judgment status）と Dimension impact を
// EffectRule から決定的に導出する（RC2 Feedback Card / Result Timeline の根拠源）。
//
// 重要: これは既存の 9 Dimension 評価（dimension-evaluator）とは独立した「説明のための」導出であり、
//   スコアリング semantics を変更しない。mode / locale / time / random を入力にしない（BR3.1 / NFR2）。
//   judgment は EffectRule.contribution から機械的に導く。根拠なく "Recommended" を付けない（§9）。
import type {
  ContributionLevel,
  DecisionOption,
  DimensionId,
  EffectRule,
  ValidatedScenario,
} from "./entities.ts";
import { NON_MONOTONIC_DIMENSIONS } from "./entities.ts";

/** 選んだ option の総合的な望ましさ。EffectRule から決定的に導く。 */
export type JudgmentStatus = "recommended" | "context-dependent" | "risky";

/** option 単位の Dimension への寄与（feedback / timeline で「なぜ」を説明する）。 */
export interface DimensionImpact {
  readonly dimensionId: DimensionId;
  readonly contribution: ContributionLevel;
  /** 表示用の符号付きデルタ（+2..-2）。内部数値表現と矛盾しない。 */
  readonly delta: number;
  readonly nonMonotonic: boolean;
  /** EffectRule.rationaleKey（あれば）。判断理由の locale key。 */
  readonly rationaleKey?: string | undefined;
}

/** option 1 つ分の judgment（status + impact 群 + better alternative option id）。 */
export interface OptionJudgment {
  readonly optionId: string;
  readonly status: JudgmentStatus;
  readonly impacts: readonly DimensionImpact[];
  /** この option が属する DecisionPoint の LearningPoint が推奨する option（あれば）。 */
  readonly betterAlternativeOptionId?: string | undefined;
}

const LEVEL_TO_DELTA: Record<ContributionLevel, number> = {
  "strong-negative": -2,
  negative: -1,
  neutral: 0,
  positive: 1,
  "strong-positive": 2,
};

/** option の effectRuleRefs を解決して EffectRule 列を返す（dangling は skip）。 */
function rulesFor(scenario: ValidatedScenario, option: DecisionOption): readonly EffectRule[] {
  const out: EffectRule[] = [];
  for (const ref of option.effectRuleRefs) {
    const rule = scenario.effectRules.get(ref);
    if (rule !== undefined) out.push(rule);
  }
  return out;
}

/**
 * status 導出（決定的）:
 *  - 負の寄与が 1 つでもあれば risky（strong-negative / negative）。
 *  - 正の寄与のみ、かつ非単調 Dimension への正寄与を含むなら context-dependent
 *    （非単調 Dimension は「過剰も negative」なので、正だけでも文脈依存を示す）。
 *  - 正の寄与のみ、かつ単調 Dimension のみへ効くなら recommended。
 *  - 寄与が全く無い（neutral のみ / 空）なら context-dependent（良否を断定しない）。
 * これにより「根拠なく Recommended を出さない」を満たす。
 */
export function deriveOptionJudgment(
  scenario: ValidatedScenario,
  decisionPointId: string,
  optionId: string,
): OptionJudgment {
  const option = scenario.decisionOptions.get(optionId);
  if (option === undefined) {
    return { optionId, status: "context-dependent", impacts: [] };
  }
  const rules = rulesFor(scenario, option);
  const impacts: DimensionImpact[] = rules.map((r) => ({
    dimensionId: r.dimensionId,
    contribution: r.contribution,
    delta: LEVEL_TO_DELTA[r.contribution],
    nonMonotonic: NON_MONOTONIC_DIMENSIONS.has(r.dimensionId),
    rationaleKey: r.rationaleKey,
  }));

  const hasNegative = impacts.some((i) => i.delta < 0);
  const hasPositive = impacts.some((i) => i.delta > 0);
  const touchesNonMonotonic = impacts.some((i) => i.nonMonotonic && i.delta > 0);

  let status: JudgmentStatus;
  if (hasNegative) {
    status = "risky";
  } else if (hasPositive && touchesNonMonotonic) {
    status = "context-dependent";
  } else if (hasPositive) {
    status = "recommended";
  } else {
    status = "context-dependent";
  }

  // DecisionPoint の LearningPoint が betterAlternativeRef を持てば、それを better alternative とする。
  const dp = scenario.decisionPoints.get(decisionPointId);
  let betterAlternativeOptionId: string | undefined;
  if (dp !== undefined) {
    for (const lpId of dp.learningPointRefs) {
      const lp = scenario.learningPoints.get(lpId);
      if (lp?.betterAlternativeRef !== undefined) {
        betterAlternativeOptionId = lp.betterAlternativeRef;
        break;
      }
    }
  }

  return {
    optionId,
    status,
    impacts,
    ...(betterAlternativeOptionId !== undefined ? { betterAlternativeOptionId } : {}),
  };
}
