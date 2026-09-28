// FeedbackModel — 1 つの Decision に対する Feedback Card の内容を決定的に構築する（RC2 §9）。
//
// UI は locale key を解決するだけ。ここは「何を出すか」を EffectRule / LearningPoint / provenance /
// judgment から決定的に組み立てる（pure・mode/locale 非依存）。DP に LearningPoint が無くても
// judgment と Dimension impact から必ず意味のある feedback を出す（BUG 4.1 の恒久対策）。
import type {
  DecisionPoint,
  LearningPoint,
  ProvenanceEntry,
  ValidatedScenario,
} from "./entities.ts";
import { deriveOptionJudgment, type OptionJudgment } from "./decision-judgment.ts";

export interface FeedbackLearningPoint {
  readonly learningPointId: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly provenance: readonly ProvenanceEntry[];
}

export interface FeedbackCard {
  readonly decisionPointId: string;
  readonly promptKey: string;
  readonly selectedOptionId: string;
  readonly selectedOptionLabelKey: string;
  readonly judgment: OptionJudgment;
  /** DP に紐づく LearningPoint（0..n）。空でも他フィールドで feedback は成立する。 */
  readonly learningPoints: readonly FeedbackLearningPoint[];
  /** better alternative の option label key（judgment が指し、かつ選択と異なる場合のみ）。 */
  readonly betterAlternativeLabelKey?: string | undefined;
  /** DP 自体の provenance（LearningPoint が無い DP でも根拠を示せる）。 */
  readonly decisionProvenance: readonly ProvenanceEntry[];
}

function resolveProvenance(
  scenario: ValidatedScenario,
  refs: readonly string[],
): readonly ProvenanceEntry[] {
  const out: ProvenanceEntry[] = [];
  for (const ref of refs) {
    const pv = scenario.provenanceEntries.get(ref);
    if (pv !== undefined) out.push(pv);
  }
  return out;
}

function feedbackLearningPoint(
  scenario: ValidatedScenario,
  lp: LearningPoint,
): FeedbackLearningPoint {
  return {
    learningPointId: lp.learningPointId,
    titleKey: lp.titleKey,
    bodyKey: lp.bodyKey,
    provenance: resolveProvenance(scenario, lp.provenanceRefs),
  };
}

/** 選択 option の provenance を DP provenance とマージ（重複 id 排除）。 */
function decisionProvenanceFor(
  scenario: ValidatedScenario,
  dp: DecisionPoint,
  selectedOptionId: string,
): readonly ProvenanceEntry[] {
  const option = scenario.decisionOptions.get(selectedOptionId);
  const refs = [...dp.provenanceRefs, ...(option?.provenanceRefs ?? [])];
  const seen = new Set<string>();
  const out: ProvenanceEntry[] = [];
  for (const ref of refs) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    const pv = scenario.provenanceEntries.get(ref);
    if (pv !== undefined) out.push(pv);
  }
  return out;
}

/**
 * 選択に応じた Feedback Card を決定的に構築する。
 * selectedOptionId が DP に属さない場合は undefined（呼び出し側は error 扱い）。
 */
export function buildFeedbackCard(
  scenario: ValidatedScenario,
  decisionPointId: string,
  selectedOptionId: string,
): FeedbackCard | undefined {
  const dp = scenario.decisionPoints.get(decisionPointId);
  if (dp === undefined) return undefined;
  if (!dp.optionIds.includes(selectedOptionId)) return undefined;
  const option = scenario.decisionOptions.get(selectedOptionId);
  if (option === undefined) return undefined;

  const judgment = deriveOptionJudgment(scenario, decisionPointId, selectedOptionId);

  const learningPoints: FeedbackLearningPoint[] = [];
  for (const lpId of dp.learningPointRefs) {
    const lp = scenario.learningPoints.get(lpId);
    if (lp !== undefined) learningPoints.push(feedbackLearningPoint(scenario, lp));
  }

  let betterAlternativeLabelKey: string | undefined;
  const betterId = judgment.betterAlternativeOptionId;
  if (betterId !== undefined && betterId !== selectedOptionId) {
    const better = scenario.decisionOptions.get(betterId);
    if (better !== undefined) betterAlternativeLabelKey = better.labelKey;
  }

  return {
    decisionPointId,
    promptKey: dp.promptKey,
    selectedOptionId,
    selectedOptionLabelKey: option.labelKey,
    judgment,
    learningPoints,
    ...(betterAlternativeLabelKey !== undefined ? { betterAlternativeLabelKey } : {}),
    decisionProvenance: decisionProvenanceFor(scenario, dp, selectedOptionId),
  };
}
