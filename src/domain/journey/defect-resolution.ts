// DefectResolution — RC4 Final。data-driven multi-stage resolution の決定的 semantic 中枢。
//
// pure・決定的（time / random / locale / mode 非参照）。
//
// 設計（Human Decision）:
//  - defect ごとに resolutionStages（data）を宣言できる。省略時は binary（unresolved → resolved）。
//  - Journey state は step ごとに defectStages[defectId] = 到達済み stageIndex を持つ。
//    entry が無い defect は stageIndex 0（= unresolved）。
//  - Return で「修正対象」の defect は stageIndex を 1 進める（次 stage があるときだけ）。
//    次 stage が無い（既に terminal）defect は動かない = content 変化なし = no-op 要因。
//  - resolvedDefectIds[step] は「terminal stage に到達した defect」= 完全解決。既存 downstream /
//    propagation ロジック（resolved か否かの binary 判定）はこの集合をそのまま使い続ける（不変）。
//
// hard invariant を守るための唯一の content-change 判定はここに集約する（呼び出し側で散らさない）。
import type { DefectDefinition, DefectResolutionState } from "./journey-entities.ts";

/** binary defect（resolutionStages 未宣言）の実効 stage 数（unresolved, resolved）。 */
const BINARY_STAGE_COUNT = 2;

/** defect の resolution stage 総数（binary は 2、multi-stage は宣言数）。決定的。 */
export function resolutionStageCount(defect: DefectDefinition): number {
  const stages = defect.resolutionStages;
  if (stages === undefined || stages.length === 0) return BINARY_STAGE_COUNT;
  return stages.length;
}

/** defect の terminal stage index（= stageCount - 1）。 */
export function terminalStageIndex(defect: DefectDefinition): number {
  return resolutionStageCount(defect) - 1;
}

/** stageIndex が terminal（= resolved）に達しているか。 */
export function isTerminalStage(defect: DefectDefinition, stageIndex: number): boolean {
  return stageIndex >= terminalStageIndex(defect);
}

/**
 * 指定 stageIndex の resolution state を決定的に返す。
 * - 0            → unresolved
 * - terminal     → resolved
 * - その中間     → partial（multi-stage のみ発生しうる）
 * multi-stage defect が明示 state を宣言していればそれを優先（data-driven）。
 */
export function resolutionStateAt(defect: DefectDefinition, stageIndex: number): DefectResolutionState {
  const clamped = clampStage(defect, stageIndex);
  const stages = defect.resolutionStages;
  if (stages !== undefined && stages.length > 0) {
    const found = stages.find((s) => s.stageIndex === clamped);
    if (found !== undefined) return found.state;
  }
  if (clamped <= 0) return "unresolved";
  if (isTerminalStage(defect, clamped)) return "resolved";
  return "partial";
}

/** stageIndex を [0, terminal] に収める（防御的・決定的）。 */
export function clampStage(defect: DefectDefinition, stageIndex: number): number {
  const term = terminalStageIndex(defect);
  if (!Number.isFinite(stageIndex) || stageIndex < 0) return 0;
  if (stageIndex > term) return term;
  return Math.floor(stageIndex);
}

/**
 * この defect を「1 段階 Return で進める」ときの次 stageIndex を返す。
 * 既に terminal なら現状維持（= 動かない = content 変化なし）。
 */
export function nextStageIndex(defect: DefectDefinition, currentStageIndex: number): number {
  const cur = clampStage(defect, currentStageIndex);
  if (isTerminalStage(defect, cur)) return cur;
  return cur + 1;
}

/**
 * Return で targeted な defect 群を 1 段階ずつ進めたとき、実際に stage が動く（content が変わる）
 * defect があるかを判定する。これが local content-change の唯一条件（hard invariant）。
 *
 * currentStages: step の現在 defectStages（defectId → stageIndex, entry 無し = 0）。
 * 返り値: 進んだ defect が 1 件でもあれば true。
 */
export function anyStageAdvances(
  targeted: readonly DefectDefinition[],
  currentStages: Readonly<Record<string, number>>,
): boolean {
  for (const d of targeted) {
    const cur = clampStage(d, currentStages[d.defectId] ?? 0);
    if (!isTerminalStage(d, cur)) return true;
  }
  return false;
}
