// ResultSummary — Result Dashboard の内容を決定的に構築する（RC2 §10）。
//
// 入力は既存の LearningResult（9 DimensionOutcome）+ DecisionRecord 列 + Scenario。
// スコアリングは変更せず、その結果を「学習レビュー」として説明可能に再構成する（pure・決定的）。
// Next Focus 推薦は「弱い Dimension → Focus scenario」の決定的 mapping のみ。推測しない（§10.F）。
import type {
  ContributionLevel,
  DecisionRecord,
  DimensionId,
  DimensionOutcome,
  LearningResult,
  ValidatedScenario,
} from "./entities.ts";
import { DIMENSION_IDS } from "./entities.ts";
import { deriveOptionJudgment, type OptionJudgment } from "./decision-judgment.ts";

/** Dimension の結果 1 行（dashboard の 9 軸表示）。 */
export interface DimensionRow {
  readonly dimensionId: DimensionId;
  readonly level: ContributionLevel;
  readonly delta: number;
  /** この Outcome に寄与した DecisionRecord id（説明可能性）。 */
  readonly contributingDecisionRecordIds: readonly string[];
}

/** Decision Timeline の 1 行。 */
export interface TimelineRow {
  readonly decisionRecordId: string;
  readonly orderIndex: number;
  readonly stageId: string | undefined;
  readonly stageTitleKey: string | undefined;
  readonly decisionPointId: string;
  readonly promptKey: string;
  readonly selectedOptionId: string;
  readonly selectedOptionLabelKey: string;
  readonly judgment: OptionJudgment;
  readonly note?: string | undefined;
}

/** 決定的な Next-Focus 推薦（弱い Dimension → Focus scenario）。 */
export interface NextFocusRecommendation {
  readonly focusScenarioId: string;
  readonly reasonDimensionId: DimensionId;
}

export interface ResultDashboard {
  readonly positiveDimensions: readonly DimensionId[];
  readonly reviewDimensions: readonly DimensionId[];
  readonly dimensionRows: readonly DimensionRow[];
  readonly timeline: readonly TimelineRow[];
  readonly remainingRisksLevel: ContributionLevel;
  readonly reworkLevel: ContributionLevel;
  readonly nextFocus: readonly NextFocusRecommendation[];
}

const LEVEL_TO_DELTA: Record<ContributionLevel, number> = {
  "strong-negative": -2,
  negative: -1,
  neutral: 0,
  positive: 1,
  "strong-positive": 2,
};

/**
 * 弱い Dimension → Focus scenario の決定的 mapping。
 * mapping に存在し、かつ catalog に読み込まれている Focus のみ推薦する（無ければ何も出さない）。
 */
const DIMENSION_TO_FOCUS: Partial<Record<DimensionId, string>> = {
  "evidence-quality": "focus-evidence",
  traceability: "focus-evidence",
  "approval-boundary": "focus-checkpoint-review",
  "risk-handling": "focus-refusal-recovery",
  "remaining-risks": "focus-refusal-recovery",
};

function outcomeLevel(outcomes: readonly DimensionOutcome[], id: DimensionId): ContributionLevel {
  const o = outcomes.find((x) => x.dimensionId === id);
  return o ? o.level : "neutral";
}

/** stage を DecisionPoint id から逆引きする（timeline の stage 対応表示用）。 */
function stageOfDecisionPoint(
  scenario: ValidatedScenario,
  decisionPointId: string,
): { stageId: string; titleKey: string } | undefined {
  for (const stageId of scenario.orderedStageIds) {
    const stage = scenario.stages.get(stageId);
    if (stage !== undefined && stage.decisionPointIds.includes(decisionPointId)) {
      return { stageId, titleKey: stage.titleKey };
    }
  }
  return undefined;
}

export function buildResultDashboard(
  scenario: ValidatedScenario,
  result: LearningResult,
  records: readonly DecisionRecord[],
  availableScenarioIds: readonly string[],
): ResultDashboard {
  const outcomes = result.dimensionOutcomes;

  const positiveDimensions: DimensionId[] = [];
  const reviewDimensions: DimensionId[] = [];
  const dimensionRows: DimensionRow[] = [];

  for (const id of DIMENSION_IDS) {
    const o = outcomes.find((x) => x.dimensionId === id);
    const level = o ? o.level : "neutral";
    const delta = LEVEL_TO_DELTA[level];
    dimensionRows.push({
      dimensionId: id,
      level,
      delta,
      contributingDecisionRecordIds: o ? o.contributingDecisionRecordIds : [],
    });
    if (delta > 0) positiveDimensions.push(id);
    else if (delta < 0) reviewDimensions.push(id);
  }

  // Decision Timeline（orderIndex 昇順・決定的）。
  const ordered = [...records].sort((a, b) => a.orderIndex - b.orderIndex);
  const timeline: TimelineRow[] = ordered.map((r) => {
    const dp = scenario.decisionPoints.get(r.decisionPointId);
    const option = scenario.decisionOptions.get(r.chosenDecisionOptionId);
    const stage = stageOfDecisionPoint(scenario, r.decisionPointId);
    return {
      decisionRecordId: r.decisionRecordId,
      orderIndex: r.orderIndex,
      stageId: stage?.stageId,
      stageTitleKey: stage?.titleKey,
      decisionPointId: r.decisionPointId,
      promptKey: dp ? dp.promptKey : r.decisionPointId,
      selectedOptionId: r.chosenDecisionOptionId,
      selectedOptionLabelKey: option ? option.labelKey : r.chosenDecisionOptionId,
      judgment: deriveOptionJudgment(scenario, r.decisionPointId, r.chosenDecisionOptionId),
      note: r.note,
    };
  });

  // Next Focus 推薦: review 対象 Dimension のうち mapping があり、
  // 「自分が今やった scenario 以外」で catalog に存在する Focus のみ。決定的・重複排除。
  const nextFocus: NextFocusRecommendation[] = [];
  const seenFocus = new Set<string>();
  for (const id of reviewDimensions) {
    const focusId = DIMENSION_TO_FOCUS[id];
    if (focusId === undefined) continue;
    if (focusId === scenario.scenario.scenarioId) continue;
    if (!availableScenarioIds.includes(focusId)) continue;
    if (seenFocus.has(focusId)) continue;
    seenFocus.add(focusId);
    nextFocus.push({ focusScenarioId: focusId, reasonDimensionId: id });
  }

  return {
    positiveDimensions,
    reviewDimensions,
    dimensionRows,
    timeline,
    remainingRisksLevel: outcomeLevel(outcomes, "remaining-risks"),
    reworkLevel: outcomeLevel(outcomes, "rework"),
    nextFocus,
  };
}
