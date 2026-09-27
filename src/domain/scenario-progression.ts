// ScenarioProgression — 進行 lifecycle の source of truth（ADR-011 / BR2.x）。
//
// ScenarioSession lifecycle: not-started → in-progress → completed。
// runtime の invariant 違反でのみ errored（DomainInvariantError、silent に部分状態を進めない・BR2.2）。
// DecisionRecord は chosenDecisionOptionId を stable ID で記録（表示文言を保存しない・BR2.3）。
// runtime semantic ID は semantic key 由来で決定的導出（time/random 非依存・BR8.2）。
// pure・不変（各操作は新しい ScenarioSession を返す。React state / localStorage に依存しない）。
import type { DecisionRecord, ScenarioSession, ValidatedScenario } from "./entities.ts";
import { DomainInvariantError } from "./errors.ts";
import { deriveDecisionRecordId, deriveSessionId } from "./semantic-id.ts";

/** 進行操作の結果（session と、その session に属する DecisionRecord 群）。 */
export interface ProgressionState {
  readonly session: ScenarioSession;
  readonly decisionRecords: readonly DecisionRecord[];
}

/** Scenario を開始する。not-started → in-progress（最初の Stage を currentStageId に）。 */
export function startScenario(scenario: ValidatedScenario): ProgressionState {
  const firstStageId = scenario.orderedStageIds[0];
  if (firstStageId === undefined) {
    throw new DomainInvariantError("Scenario に Stage がありません");
  }
  const sessionId = deriveSessionId(scenario.scenario.scenarioId);
  return {
    session: {
      sessionId,
      scenarioId: scenario.scenario.scenarioId,
      status: "in-progress",
      currentStageId: firstStageId,
      decisionRecordIds: [],
    },
    decisionRecords: [],
  };
}

/**
 * DecisionPoint での選択を記録する。in-progress でのみ許可。
 * 存在しない DecisionPoint / DecisionOption、または DecisionOption が当該 DecisionPoint に
 * 属さない場合は DomainInvariantError（矛盾した遷移を silent に進めない・BR2.2）。
 */
export function recordDecision(
  scenario: ValidatedScenario,
  state: ProgressionState,
  decisionPointId: string,
  chosenDecisionOptionId: string,
  note?: string,
): ProgressionState {
  if (state.session.status !== "in-progress") {
    throw new DomainInvariantError(`in-progress でない session に decision を記録できません（status=${state.session.status}）`);
  }
  const dp = scenario.decisionPoints.get(decisionPointId);
  if (dp === undefined) {
    throw new DomainInvariantError(`存在しない DecisionPoint への記録: ${decisionPointId}`);
  }
  if (!dp.optionIds.includes(chosenDecisionOptionId)) {
    throw new DomainInvariantError(
      `DecisionOption ${chosenDecisionOptionId} は DecisionPoint ${decisionPointId} に属しません`,
    );
  }

  const orderIndex = state.decisionRecords.length;
  const record: DecisionRecord = {
    decisionRecordId: deriveDecisionRecordId(state.session.sessionId, decisionPointId, orderIndex),
    sessionId: state.session.sessionId,
    decisionPointId,
    chosenDecisionOptionId,
    ...(note !== undefined ? { note } : {}),
    orderIndex,
  };

  const decisionRecords = [...state.decisionRecords, record];
  return {
    session: {
      ...state.session,
      decisionRecordIds: [...state.session.decisionRecordIds, record.decisionRecordId],
    },
    decisionRecords,
  };
}

/** 現 Stage を次順の Stage へ進める。最終 Stage を超える前進は completed への遷移で扱う。 */
export function advanceStage(scenario: ValidatedScenario, state: ProgressionState): ProgressionState {
  if (state.session.status !== "in-progress") {
    throw new DomainInvariantError(`in-progress でない session を advance できません（status=${state.session.status}）`);
  }
  const current = state.session.currentStageId;
  if (current === undefined) {
    throw new DomainInvariantError("in-progress session に currentStageId がありません");
  }
  const idx = scenario.orderedStageIds.indexOf(current);
  if (idx < 0) {
    throw new DomainInvariantError(`currentStageId が Scenario の Stage 列にありません: ${current}`);
  }
  const nextStageId = scenario.orderedStageIds[idx + 1];
  if (nextStageId === undefined) {
    // 最終 Stage を超えた → 完了。
    return completeScenario(state);
  }
  return {
    ...state,
    session: { ...state.session, currentStageId: nextStageId },
  };
}

/** 全 Stage 完了 → completed（BR2.1）。 */
export function completeScenario(state: ProgressionState): ProgressionState {
  if (state.session.status !== "in-progress") {
    throw new DomainInvariantError(`in-progress でない session を complete できません（status=${state.session.status}）`);
  }
  // completed では currentStageId を持たない（exactOptionalPropertyTypes: プロパティを省略する）。
  const completed: ScenarioSession = {
    sessionId: state.session.sessionId,
    scenarioId: state.session.scenarioId,
    status: "completed",
    decisionRecordIds: state.session.decisionRecordIds,
  };
  return { ...state, session: completed };
}

/** errored からの safe reset → not-started（BR2.1）。 */
export function safeReset(scenario: ValidatedScenario): ProgressionState {
  return {
    session: {
      sessionId: deriveSessionId(scenario.scenario.scenarioId),
      scenarioId: scenario.scenario.scenarioId,
      status: "not-started",
      decisionRecordIds: [],
    },
    decisionRecords: [],
  };
}
