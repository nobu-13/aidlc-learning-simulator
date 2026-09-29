// ReworkStateMachine — Rework を実 State Transition として表現する（Design §14 / 要件 9）。
//
// pure・決定的。Return / Revise / Change Scope / Re-review / Re-approve を domain として表現。
// Rework 回数を増やすこと自体が目的ではなく「なぜ戻る必要が生じたか」を記録・説明できるようにする。
import { JOURNEY_STEP_IDS, type JourneyStepId, type DefectDefinition } from "./journey-entities.ts";
import {
  anyStageAdvances,
  clampStage,
  isTerminalStage,
  nextStageIndex,
} from "./defect-resolution.ts";

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
  /**
   * RC4 Final: この Return 時に reviewer が書いた Review note（自由文・quote のみ）。
   * Review note → Rework history → Revision explanation の trace を成立させる（Human Decision）。
   * 採点には使わない・runtime 生成もしない。additive（旧データは undefined）。
   */
  readonly reviewNote?: string | undefined;
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
  /**
   * RC4 Final: step id → その step の各 defect の到達済み resolution stageIndex（defectId → index）。
   * entry が無い defect は stageIndex 0（= unresolved）。multi-stage defect の partial 状態を保持する軸。
   * resolvedDefectIds（terminal 到達）とは別軸で、partial（中間 stage）を表現するために追加した。
   * additive（旧 state 復元時は {} = 全 defect stage 0 = 従来の binary 挙動）。
   * optional: 未初期化（旧 state）は undefined。
   */
  readonly defectStages?: Readonly<Record<string, Readonly<Record<string, number>>>> | undefined;
  /**
   * RC4 Phase 3: step id → その step の Artifact content 全体の version（= artifactVersion）。
   * revisions（= localRevision, この step 自身が Human Return → Agent Rework された回数）とは
   * 役割を分離する。artifactVersion は content 変化要因（local Agent Rework / upstream propagation /
   * 将来の Change Scope）で increment される。Step 3 では state shape / initial / read helper のみ導入し、
   * increment behavior は変更しない（後続 Step で扱う）。
   * optional: undefined = legacy state / Phase 3 version state 未初期化、{} = Phase 3 version model で初期化済み。
   * 旧 state 復元時は補完せず undefined のまま（legacy unknown を 0 へ丸めない）。
   */
  readonly artifactVersions?: Partial<Record<JourneyStepId, number>>;
  /**
   * RC4 Phase 3: step id → その step の Artifact が一度でも materialize（表示・生成）されたか。
   * まだ materialize されていない downstream は current upstream state から artifactVersion 0 として
   * 初回生成してよい。materialize 済みは upstream propagation で content が変わるなら artifactVersion +1 が要る。
   * Step 3 では state shape / initial / read helper のみ導入し、mutation semantics は後続 Step で扱う。
   * optional: undefined = legacy state / Phase 3 version state 未初期化、{} = Phase 3 version model で初期化済み。
   * 旧 state 復元時は補完せず undefined のまま（legacy unknown を false へ丸めない）。
   */
  readonly materializedSteps?: Partial<Record<JourneyStepId, boolean>>;
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
    defectStages: {},
    artifactVersions: {},
    materializedSteps: {},
  };
}

/** 指定 step の解決済み（terminal stage 到達）defect id（未 rework なら空）。 */
export function resolvedDefectIdsOf(
  progress: JourneyProgress,
  stepId: JourneyStepId,
): readonly string[] {
  return progress.resolvedDefectIds[stepId] ?? [];
}

/**
 * RC4 Final: 指定 step の各 defect の到達済み resolution stageIndex（defectId → index）。
 * entry が無ければ空 record（= 全 defect stage 0 = unresolved）。read only・決定的。
 */
export function defectStagesOf(
  progress: JourneyProgress,
  stepId: JourneyStepId,
): Readonly<Record<string, number>> {
  return progress.defectStages?.[stepId] ?? {};
}

/** RC4 Final: 指定 step / defect の到達済み stageIndex（未 rework なら 0）。 */
export function defectStageIndexOf(
  progress: JourneyProgress,
  stepId: JourneyStepId,
  defectId: string,
): number {
  return defectStagesOf(progress, stepId)[defectId] ?? 0;
}

function stepIndex(stepId: JourneyStepId): number {
  return JOURNEY_STEP_IDS.indexOf(stepId);
}

/**
 * RC4 Final: Artifact content が実際に変化するかを判定する semantic helper。
 * revision（= Artifact Version）は「これが true のとき」だけ increment する（hard invariant）。
 *
 * data-driven multi-stage resolution:
 *  content change 条件 = targeted defect のうち少なくとも 1 件が「次 resolution stage を持つ」
 *  （= まだ terminal でない）こと。次 stage があれば Return で本文が defective→partial→corrected と
 *  実際に変わる。全 targeted が既に terminal なら content は変わらない = no-op。
 *
 * これにより:
 *  - binary defect: unresolved(stage0) → 1 回目 Return で terminal(resolved) へ。2 回目は no-op。
 *  - multi-stage defect: stage0 → stage1(partial) → stage2(resolved)。各 Return で content 変化。
 *  - 既に resolved の defect 再 Return: 次 stage 無し → no-op（hard invariant 3）。
 *
 * pure・決定的。呼び出し側の revision 判定ロジックはこの helper に集約する。
 */
export function hasArtifactChange(args: {
  readonly targetedDefects: readonly DefectDefinition[];
  readonly currentStages: Readonly<Record<string, number>>;
}): boolean {
  return anyStageAdvances(args.targetedDefects, args.currentStages);
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
  targetedDefectsOrIds: readonly (DefectDefinition | string)[] = [],
  reviewNote?: string,
): JourneyProgress {
  const fromIdx = stepIndex(progress.currentStepId);
  const toIdx = stepIndex(targetStepId);
  if (toIdx < 0 || toIdx > fromIdx) return progress; // 未来へは戻れない。

  // 入力正規化: string（defect id のみ）は「binary defect」として扱う（resolutionStages 無し）。
  // 正式経路（use-journey-state）は完全な DefectDefinition を渡すため multi-stage が働く。
  // string 経路は multi-stage 情報を持たないので binary（unresolved→resolved）挙動になる。
  const targetedDefects: readonly DefectDefinition[] = targetedDefectsOrIds.map((d) =>
    typeof d === "string" ? asBinaryDefect(d) : d,
  );
  const targetedDefectIds = targetedDefects.map((d) => d.defectId);

  // RC4 Final: content change 条件 = targeted defect のうち次 resolution stage を持つものがあるか。
  //  - multi-stage defect は stage0→1→2 と Return のたびに content が変わる。
  //  - 既に terminal（resolved）の defect を再 target しても動かない = no-op（hard invariant）。
  const prevStagesForStep = defectStagesOf(progress, targetStepId);
  const contentWillChange = hasArtifactChange({
    targetedDefects,
    currentStages: prevStagesForStep,
  });

  // target 以降（target 含む）の completed を取り消す（戻った先からやり直すため）。
  // これは content change の有無に関わらず行う（再レビューへ戻す遷移そのもの）。
  const completedStepIds = progress.completedStepIds.filter((s) => stepIndex(s) < toIdx);

  const prevResolved = progress.resolvedDefectIds[targetStepId] ?? [];

  if (!contentWillChange) {
    // no-op rework（false positive only / valid target なし / 既に resolved を再 target / 初回 mandatory）:
    //  - revision 変更なし・stage 変更なし・resolvedDefectIds 変更なし・Artifact identity/content 変更なし。
    //  - ただし「Review へ戻す」遷移は行う（currentStepId を戻し、completed を巻き戻す）。
    //  - artifact revision history（revision++）とは分離するため、attempt として記録する。
    const attemptEntry: ReworkEntry = {
      fromStepId: progress.currentStepId,
      toStepId: targetStepId,
      action,
      trigger,
      atRevision: progress.revisions[targetStepId] ?? 0, // 据え置き（increment しない）。
      isNoOpAttempt: true,
      targetedDefectIds: [...targetedDefectIds].sort(idCompare),
      resolvedDefectIds: [...prevResolved],
      ...(reviewNote !== undefined && reviewNote.trim().length > 0
        ? { reviewNote: reviewNote.trim() }
        : {}),
    };
    return {
      ...progress,
      currentStepId: targetStepId,
      completedStepIds,
      reworkHistory: [...progress.reworkHistory, attemptEntry],
    };
  }

  // content change あり: localRevision(=revisions)++・defect stage を 1 段階前進。
  const atRevision = (progress.revisions[targetStepId] ?? 0) + 1;
  const revisions = { ...progress.revisions, [targetStepId]: atRevision };

  // RC4 Phase 3: local Agent Rework で content が変わるので artifactVersion も +1 する。
  // localRevision と artifactVersion は別軸だが、local rework という同一要因では同時に増える。
  // legacy state（artifactVersions === undefined）は暗黙 migration せず undefined のまま維持する。
  const artifactVersions = progress.artifactVersions === undefined
    ? undefined
    : {
        ...progress.artifactVersions,
        [targetStepId]: (progress.artifactVersions[targetStepId] ?? 0) + 1,
      };

  // RC4 Final: targeted defect の stage を 1 段階前進（terminal は据え置き）。
  const nextStagesForStep: Record<string, number> = { ...prevStagesForStep };
  for (const d of targetedDefects) {
    const cur = clampStage(d, prevStagesForStep[d.defectId] ?? 0);
    nextStagesForStep[d.defectId] = nextStageIndex(d, cur);
  }
  const defectStages = {
    ...(progress.defectStages ?? {}),
    [targetStepId]: nextStagesForStep,
  };

  // resolvedDefectIds[step] = terminal stage に到達した defect（完全解決）のみ。
  // 既存 downstream / propagation ロジックはこの binary 集合を使い続けるため exact に再計算する。
  const resolvedForStep = new Set<string>(prevResolved);
  for (const d of targetedDefects) {
    if (isTerminalStage(d, nextStagesForStep[d.defectId] ?? 0)) resolvedForStep.add(d.defectId);
  }
  const nextResolvedForStep = [...resolvedForStep].sort(idCompare);
  const resolvedDefectIds = { ...progress.resolvedDefectIds, [targetStepId]: nextResolvedForStep };

  // 残存（この step に有効だが未 terminal）は呼び出し側が持たないため、targeted のうち未 terminal を記録。
  const remainingForStep = targetedDefects
    .filter((d) => !isTerminalStage(d, nextStagesForStep[d.defectId] ?? 0))
    .map((d) => d.defectId)
    .sort(idCompare);

  const entry: ReworkEntry = {
    fromStepId: progress.currentStepId,
    toStepId: targetStepId,
    action,
    trigger,
    atRevision,
    targetedDefectIds: [...targetedDefectIds].sort(idCompare),
    resolvedDefectIds: nextResolvedForStep,
    ...(remainingForStep.length > 0 ? { remainingDefectIds: remainingForStep } : {}),
    ...(reviewNote !== undefined && reviewNote.trim().length > 0
      ? { reviewNote: reviewNote.trim() }
      : {}),
  };

  return {
    ...progress,
    currentStepId: targetStepId,
    revisions,
    reworkHistory: [...progress.reworkHistory, entry],
    completedStepIds,
    resolvedDefectIds,
    defectStages,
    // RC4 Phase 3: artifactVersion を明示反映（legacy は undefined を維持）。
    // exactOptionalPropertyTypes 下では undefined を明示代入できないため条件で分岐。
    ...(artifactVersions !== undefined ? { artifactVersions } : {}),
  };
}

/** stable id 昇順比較（決定的順序）。 */
function idCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * defect id だけが渡されたとき（direct test / legacy 経路）に使う最小の binary defect stub。
 * resolutionStages を持たないので unresolved → resolved の 2 stage 挙動になる。
 * category/severity 等は stage 進行に無関係なので placeholder で埋める（本 stub は rework の
 * stage 計算にしか使われず、Ground Truth 評価には流れない）。
 */
function asBinaryDefect(defectId: string): DefectDefinition {
  return {
    defectId,
    category: "requirement-omission",
    journeyStepId: "j1-requirements",
    itemId: defectId,
    expectedSeverity: "medium",
    rationaleKey: "",
    relatedDimensionIds: [],
  };
}

/** 指定 step の現在 revision（= localRevision, 未 rework なら 0）。 */
export function revisionOf(progress: JourneyProgress, stepId: JourneyStepId): number {
  return progress.revisions[stepId] ?? 0;
}

/**
 * RC4 Phase 3: 指定 step の現在 artifactVersion（Artifact content 全体の version, 未設定なら 0）。
 * revisionOf（localRevision）とは別軸。read only（Step 3 では increment behavior を変更しない）。
 */
export function artifactVersionOf(
  progress: JourneyProgress,
  stepId: JourneyStepId,
): number | undefined {
  if (progress.artifactVersions === undefined) return undefined;
  return progress.artifactVersions[stepId] ?? 0;
}

/**
 * RC4 Phase 3: 指定 step の Artifact が materialize されたか。read only。
 *
 * 返り値の意味（2 段階を区別する）:
 *  - materializedSteps 自体が undefined → legacy / unknown（Phase 3 version state 未初期化）。undefined を返す。
 *  - materializedSteps は存在するが step key なし → その step は false / not materialized。
 * legacy unknown を false へ丸めない（undefined / false / true の具体的扱いは
 * Materialization semantics 実装 Step で確定）。
 */
export function materializationOf(
  progress: JourneyProgress,
  stepId: JourneyStepId,
): boolean | undefined {
  if (progress.materializedSteps === undefined) return undefined;
  return progress.materializedSteps[stepId] ?? false;
}

/**
 * RC4 Phase 3: 指定 step の Artifact を materialize 済みとして記録する pure state transition。
 *
 * semantic:
 *  - Phase 3 initialized state（materializedSteps 存在）で未 materialized → true にする。
 *  - 既に true → idempotent（同一 state を返しうる・値は不変）。
 *  - revision / artifactVersion は変更しない（materialization 自体は version を増やさない）。
 *  - legacy state（materializedSteps === undefined）→ 暗黙 migration せず undefined のまま維持する
 *    （Persistence migration は後続 Human Decision）。
 */
export function markMaterialized(
  progress: JourneyProgress,
  stepId: JourneyStepId,
): JourneyProgress {
  // legacy unknown state は触らない（undefined を {} へ暗黙 migration しない）。
  if (progress.materializedSteps === undefined) return progress;
  // 既に true なら idempotent。
  if (progress.materializedSteps[stepId] === true) return progress;
  return {
    ...progress,
    materializedSteps: { ...progress.materializedSteps, [stepId]: true },
  };
}
