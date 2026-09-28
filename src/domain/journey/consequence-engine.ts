// ConsequenceEngine — 見逃した finding が後工程へ与える影響を決定的に算出する（Design §13 / 要件 8）。
//
// pure・決定的。missed findings 集合 → downstream manifestation。Score 減少だけで終わらせない。
// Guided: 説明として提示。Simulation: would-have preview。Adoption: 実際に後続 Artifact へ伝播。
import type { ContributionLevel, DimensionId } from "../entities.ts";
import type { DefectDefinition, JourneyStepId } from "./journey-entities.ts";
import type { DimensionContribution } from "./dimension-effect-adapter.ts";

/** 見逃しが顕在化する 1 件（後工程・追加リスク）。 */
export interface ConsequenceManifestation {
  readonly sourceDefectId: string;
  readonly sourceStepId: JourneyStepId;
  readonly atStepId: JourneyStepId;
  readonly manifestItemKey: string;
  readonly addsRiskDimensionIds: readonly DimensionId[];
}

/**
 * 見逃した defect 集合から、後工程で顕在化する manifestation を決定的に導出する。
 * downstreamManifestation を持つ defect のみが伝播する。順序は defectId 昇順。
 */
export function computeConsequences(
  missedDefects: readonly DefectDefinition[],
): readonly ConsequenceManifestation[] {
  const out: ConsequenceManifestation[] = [];
  const sorted = missedDefects
    .slice()
    .sort((a, b) => (a.defectId < b.defectId ? -1 : a.defectId > b.defectId ? 1 : 0));
  for (const d of sorted) {
    const m = d.downstreamManifestation;
    if (m === undefined) continue;
    out.push({
      sourceDefectId: d.defectId,
      sourceStepId: d.journeyStepId,
      atStepId: m.atStepId,
      manifestItemKey: m.manifestItemKey,
      addsRiskDimensionIds: m.addsRiskDimensionIds,
    });
  }
  return out;
}

/** 指定 step で顕在化する manifestation の manifestItemKey 群（Artifact Generator への注入用）。 */
export function consequenceItemKeysForStep(
  consequences: readonly ConsequenceManifestation[],
  stepId: JourneyStepId,
): readonly string[] {
  return consequences.filter((c) => c.atStepId === stepId).map((c) => c.manifestItemKey);
}

/**
 * 顕在化した consequence を追加の Dimension 寄与（remaining-risks / rework 等）へ変換する。
 * これにより「見逃し → 後工程で risk 増」が 9 Dimension に決定的に反映される。
 */
export function consequenceContributions(
  consequences: readonly ConsequenceManifestation[],
): readonly DimensionContribution[] {
  const out: DimensionContribution[] = [];
  const negative: ContributionLevel = "negative";
  for (const c of consequences) {
    for (const dim of c.addsRiskDimensionIds) {
      out.push({ dimensionId: dim, level: negative, reasonKey: "rc3.consequence.risk" });
    }
  }
  return out;
}
