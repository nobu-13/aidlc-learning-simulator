// ReworkStateMachine — Rework を実 State Transition として表現する（Design §14 / 要件 9）。
//
// pure・決定的。Return / Revise / Change Scope / Re-review / Re-approve を domain として表現。
// Rework 回数を増やすこと自体が目的ではなく「なぜ戻る必要が生じたか」を記録・説明できるようにする。
import { JOURNEY_STEP_IDS, type JourneyStepId } from "./journey-entities.ts";

/** Change Control の trigger（Journey 横断の Conditional Transition・Human Decision 1）。 */
export type ReworkTrigger =
  | "requirement-changed"
  | "scope-changed"
  | "critical-finding"
  | "downstream-mismatch"
  | "approval-prerequisite-changed";

export type ReworkAction =
  | "return"
  | "revise"
  | "change-scope"
  | "re-review"
  | "re-approve";

/** Rework 履歴 1 件（なぜ・どこへ戻ったか）。 */
export interface ReworkEntry {
  readonly fromStepId: JourneyStepId;
  readonly toStepId: JourneyStepId;
  readonly action: ReworkAction;
  readonly trigger: ReworkTrigger;
  /** 戻った時点での対象 Artifact の revision。 */
  readonly atRevision: number;
}

/** Journey の進行状態（どこまで来たか + rework 履歴 + revision）。 */
export interface JourneyProgress {
  readonly currentStepId: JourneyStepId;
  /** step id → その step の現在 revision（rework で increment）。 */
  readonly revisions: Readonly<Record<string, number>>;
  readonly reworkHistory: readonly ReworkEntry[];
  /** completed（approve 済み）step 集合。 */
  readonly completedStepIds: readonly JourneyStepId[];
}

/** Core Journey の先頭 step（決定的・固定）。 */
const FIRST_STEP: JourneyStepId = "j1-requirements";

export function initialProgress(): JourneyProgress {
  return {
    currentStepId: FIRST_STEP,
    revisions: {},
    reworkHistory: [],
    completedStepIds: [],
  };
}

function stepIndex(stepId: JourneyStepId): number {
  return JOURNEY_STEP_IDS.indexOf(stepId);
}

/** 現在 step を approve して次 step へ進む（次が無ければ現状維持=完了）。 */
export function advance(progress: JourneyProgress): JourneyProgress {
  const idx = stepIndex(progress.currentStepId);
  const completed = progress.completedStepIds.includes(progress.currentStepId)
    ? progress.completedStepIds
    : [...progress.completedStepIds, progress.currentStepId];
  const next: JourneyStepId | undefined = JOURNEY_STEP_IDS[idx + 1];
  const currentStepId: JourneyStepId = next ?? progress.currentStepId;
  return {
    ...progress,
    completedStepIds: completed,
    currentStepId,
  };
}

/** すべての Core Journey step が completed か。 */
export function isJourneyComplete(progress: JourneyProgress): boolean {
  return JOURNEY_STEP_IDS.every((s) => progress.completedStepIds.includes(s));
}

/**
 * Rework: 指定 target step へ戻す（Conditional Transition）。target の revision を +1 し、
 * target 以降の completed を取り消す（戻った先からやり直すため）。決定的。
 * target が現在より後ろ / 範囲外なら no-op（不正遷移を作らない）。
 */
export function rework(
  progress: JourneyProgress,
  targetStepId: JourneyStepId,
  action: ReworkAction,
  trigger: ReworkTrigger,
): JourneyProgress {
  const fromIdx = stepIndex(progress.currentStepId);
  const toIdx = stepIndex(targetStepId);
  if (toIdx < 0 || toIdx > fromIdx) return progress; // 未来へは戻れない。

  const atRevision = (progress.revisions[targetStepId] ?? 0) + 1;
  const revisions = { ...progress.revisions, [targetStepId]: atRevision };

  // target 以降（target 含む）の completed を取り消す。
  const completedStepIds = progress.completedStepIds.filter((s) => stepIndex(s) < toIdx);

  const entry: ReworkEntry = {
    fromStepId: progress.currentStepId,
    toStepId: targetStepId,
    action,
    trigger,
    atRevision,
  };

  return {
    currentStepId: targetStepId,
    revisions,
    reworkHistory: [...progress.reworkHistory, entry],
    completedStepIds,
  };
}

/** 指定 step の現在 revision（未 rework なら 0）。 */
export function revisionOf(progress: JourneyProgress, stepId: JourneyStepId): number {
  return progress.revisions[stepId] ?? 0;
}
