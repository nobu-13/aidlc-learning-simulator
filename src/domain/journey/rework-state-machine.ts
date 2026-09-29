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

/**
 * Rework 履歴 1 件（なぜ・どこへ戻ったか）。RC4 Phase 2 で defect 単位の記録を additive 追加。
 * timestamp は持たない（決定性を壊さない・要件）。
 */
export interface ReworkEntry {
  readonly fromStepId: JourneyStepId;
  readonly toStepId: JourneyStepId;
  readonly action: ReworkAction;
  readonly trigger: ReworkTrigger;
  /** 戻った時点での対象 Artifact の revision。 */
  readonly atRevision: number;
  /**
   * RC4 Phase 2: この Return で「修正対象として指定された」実 defect id（Ground Truth 上 defect のもの）。
   * false positive は含まない。additive（旧データ復元時は空）。
   */
  readonly targetedDefectIds?: readonly string[] | undefined;
  /** RC4 Phase 2: この Return の結果、当該 step で解決済みになった defect id（累積後のスナップショット）。 */
  readonly resolvedDefectIds?: readonly string[] | undefined;
  /** RC4 Phase 2: この Return 後も当該 step に残る未解決 defect id。 */
  readonly remainingDefectIds?: readonly string[] | undefined;
  /**
   * RC4 Phase 2 修正: valid target が無く Artifact content が変わらなかった rework 試行（no-op attempt）。
   * true のとき atRevision は増えていない（Artifact revision history とは分離した「review retry」記録）。
   * additive（旧データ復元時は undefined = 通常の rework）。
   */
  readonly isNoOpAttempt?: boolean | undefined;
}

/** Journey の進行状態（どこまで来たか + rework 履歴 + revision + 解決済み defect）。 */
export interface JourneyProgress {
  readonly currentStepId: JourneyStepId;
  /** step id → その step の現在 revision（rework で increment）。 */
  readonly revisions: Readonly<Record<string, number>>;
  readonly reworkHistory: readonly ReworkEntry[];
  /** completed（approve 済み）step 集合。 */
  readonly completedStepIds: readonly JourneyStepId[];
  /**
   * RC4 Phase 2: step id → その step で解決済みの defect id 集合（単調増加）。
   * Generator v2 がこれを見て defective → corrected 本文へ切り替える。
   * additive（旧 state 復元時は空 = 全 defect 未解決 = RC3 と同じ挙動）。
   */
  readonly resolvedDefectIds: Readonly<Record<string, readonly string[]>>;
}

/** Core Journey の先頭 step（決定的・固定）。 */
const FIRST_STEP: JourneyStepId = "j1-requirements";

export function initialProgress(): JourneyProgress {
  return {
    currentStepId: FIRST_STEP,
    revisions: {},
    reworkHistory: [],
    completedStepIds: [],
    resolvedDefectIds: {},
  };
}

/** 指定 step の解決済み defect id（未 rework なら空）。 */
export function resolvedDefectIdsOf(
  progress: JourneyProgress,
  stepId: JourneyStepId,
): readonly string[] {
  return progress.resolvedDefectIds[stepId] ?? [];
}

function stepIndex(stepId: JourneyStepId): number {
  return JOURNEY_STEP_IDS.indexOf(stepId);
}

/**
 * RC4 Phase 2: Artifact content が実際に変化するかを判定する semantic helper。
 * revision（= Artifact Version）は「これが true のとき」だけ increment する（hard invariant）。
 *
 * Phase 2 の content change 条件は「新たに解決される defect が 1 件以上ある」こと。
 * 将来 Change Scope 等で別の content change 要因が加わる場合はこの helper に集約して拡張する
 * （呼び出し側の revision 判定ロジックを増やさない）。pure・決定的。
 */
export function hasArtifactChange(args: {
  readonly newlyResolvedDefectIds: readonly string[];
}): boolean {
  return args.newlyResolvedDefectIds.length > 0;
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
 * Rework: 指定 target step へ戻す（Conditional Transition）。決定的。
 *
 * RC4 Phase 2 の中心:
 *  - targetedDefectIds に「Return で修正対象として指定された実 defect id」を渡すと、
 *    target step の resolvedDefectIds へ **単調に** 追加する（Agent が実際に修正した扱い）。
 *  - false positive や存在しない id は呼び出し側で除外して渡す前提（ここでは受け取った id をそのまま
 *    resolved へ入れる。呼び出し側 = useJourneyState が Ground Truth と照合して valid target のみ渡す）。
 *  - revision は「実際に content が変わりうる」= 修正対象があるか、または戻り自体で常に +1 する。
 *    Phase 2 では Return は必ず artifact を再生成する（revision は常に increment）。
 *  - target が現在より後ろ / 範囲外なら no-op（不正遷移を作らない）。
 *
 * 不変条件:
 *  - resolvedDefectIds は単調増加（既存 resolved を落とさない・重複排除）。
 *  - target 以降（target 含む）の completed を取り消す（戻った先からやり直す）。
 */
export function rework(
  progress: JourneyProgress,
  targetStepId: JourneyStepId,
  action: ReworkAction,
  trigger: ReworkTrigger,
  targetedDefectIds: readonly string[] = [],
): JourneyProgress {
  const fromIdx = stepIndex(progress.currentStepId);
  const toIdx = stepIndex(targetStepId);
  if (toIdx < 0 || toIdx > fromIdx) return progress; // 未来へは戻れない。

  // RC4 Phase 2 修正: revision は「Artifact content が実際に変わるとき」のみ増やす（Artifact Version 化）。
  // Phase 2 の content change 条件 = 既存 resolved に無い defect が新たに解決される（newlyResolved > 0）。
  // 将来 Change Scope 等で別の content change が入りうるため hasArtifactChange helper に閉じる。
  const prevResolved = progress.resolvedDefectIds[targetStepId] ?? [];
  const prevSet = new Set(prevResolved);
  const newlyResolved = targetedDefectIds.filter((id) => !prevSet.has(id));
  const contentWillChange = hasArtifactChange({ newlyResolvedDefectIds: newlyResolved });

  // target 以降（target 含む）の completed を取り消す（戻った先からやり直すため）。
  // これは content change の有無に関わらず行う（再レビューへ戻す遷移そのもの）。
  const completedStepIds = progress.completedStepIds.filter((s) => stepIndex(s) < toIdx);

  if (!contentWillChange) {
    // no-op rework（false positive only / valid target なし / mandatory rework の初回）:
    //  - revision 変更なし・resolvedDefectIds 変更なし・Artifact identity/content 変更なし。
    //  - ただし「Review へ戻す」遷移は行う（currentStepId を戻し、completed を巻き戻す）。
    //  - artifact revision history（revision++）とは分離するため、attempt として記録する。
    const attemptEntry: ReworkEntry = {
      fromStepId: progress.currentStepId,
      toStepId: targetStepId,
      action,
      trigger,
      atRevision: progress.revisions[targetStepId] ?? 0, // 据え置き（increment しない）。
      isNoOpAttempt: true,
      targetedDefectIds: [...targetedDefectIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
      resolvedDefectIds: [...prevResolved],
    };
    return {
      ...progress,
      currentStepId: targetStepId,
      completedStepIds,
      reworkHistory: [...progress.reworkHistory, attemptEntry],
    };
  }

  // content change あり: revision++・resolvedDefectIds を単調に前進。
  const atRevision = (progress.revisions[targetStepId] ?? 0) + 1;
  const revisions = { ...progress.revisions, [targetStepId]: atRevision };

  const merged = new Set<string>(prevResolved);
  for (const id of targetedDefectIds) merged.add(id);
  const nextResolvedForStep = [...merged].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const resolvedDefectIds = { ...progress.resolvedDefectIds, [targetStepId]: nextResolvedForStep };

  const entry: ReworkEntry = {
    fromStepId: progress.currentStepId,
    toStepId: targetStepId,
    action,
    trigger,
    atRevision,
    targetedDefectIds: [...targetedDefectIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    resolvedDefectIds: nextResolvedForStep,
  };

  return {
    currentStepId: targetStepId,
    revisions,
    reworkHistory: [...progress.reworkHistory, entry],
    completedStepIds,
    resolvedDefectIds,
  };
}

/** 指定 step の現在 revision（未 rework なら 0）。 */
export function revisionOf(progress: JourneyProgress, stepId: JourneyStepId): number {
  return progress.revisions[stepId] ?? 0;
}
