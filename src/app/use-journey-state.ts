// useJourneyState — RC3 Journey の presentation state controller（/app）。
//
// RC2 の use-app-state とは独立させ、RC3 Journey を Primary Learning Experience として提供する
// （Human Decision 4）。domain logic は持たず、journey-engine / rework-state-machine / mode-policy を
// 呼び出す。localStorage 永続は共有 ProgressStore の journey フィールドへ（RC2 フィールドは保持）。
import { useCallback, useMemo, useState } from "react";
import type { Application } from "./application-orchestrator.ts";
import type { ExperienceMode, Locale } from "../domain/entities.ts";
import type {
  ApprovalDecision,
  ArtifactReview,
  GeneratedArtifact,
  JourneyStepId,
  ProjectContextInput,
  Severity,
  StructuredControlInput,
} from "../domain/journey/journey-entities.ts";
import { JOURNEY_STEP_IDS, isProjectArchetypeId } from "../domain/journey/journey-entities.ts";
import {
  buildArtifactForStep,
  computeJourneyResult,
  type JourneyFinalResult,
  type JourneyRunInput,
} from "../domain/journey/journey-engine.ts";
import {
  evaluateArtifactReview,
  hasCriticalLearningBlocker,
  type ReviewEvaluation,
} from "../domain/journey/review-evaluator.ts";
import { buildDefectSet, defectsForStep } from "../domain/journey/defect-catalog.ts";
import {
  CANONICAL_SAMPLE_PROFILE,
  DEFAULT_ARCHETYPE_ID,
  buildUserProfile,
  defaultStructuredInput,
  type JourneyProfile,
} from "../domain/journey/journey-profiles.ts";
import {
  advance,
  initialProgress,
  isJourneyComplete,
  markMaterialized,
  rework,
  revisionOf,
  defectStagesOf,
  type JourneyProgress,
  type ReworkTrigger,
} from "../domain/journey/rework-state-machine.ts";
import { anyStageAdvances, isTerminalStage } from "../domain/journey/defect-resolution.ts";
import {
  journeyModePolicyFor,
  mustBlockOnCriticalMiss,
  type JourneyModePolicy,
} from "../domain/journey/mode-policy.ts";
import { gateAllowsAdvance } from "../domain/journey/gate-transition.ts";
import { computeConsequences } from "../domain/journey/consequence-engine.ts";
import {
  localReworkDiff as computeLocalReworkDiff,
  propagationDiff as computePropagationDiff,
  type LocalReworkDiffResult,
  type PropagationDiffResult,
} from "../domain/journey/journey-diff.ts";
import {
  buildCompletionSummary,
  buildCausalLearningSummary,
  buildResultHighlights,
  buildDecisionReadinessSummary,
  type CompletionSummary,
  type CausalLearningEntry,
  type ResultHighlights,
  type DecisionReadinessSummary,
} from "../domain/journey/journey-summaries.ts";
import { evaluateAllReviews } from "../domain/journey/journey-engine.ts";
import {
  buildJourneyOutcomeSummary,
  type JourneyOutcomeSummary,
} from "../domain/journey/journey-outcome.ts";
import {
  openConditions as computeOpenConditions,
  toPersistedCondition,
  fromPersistedCondition,
  type ConditionalApproval,
  type ConditionDueGate,
} from "../domain/journey/conditional-approval.ts";
import { buildFeedbackViewModel, type FeedbackViewModel } from "../domain/journey/feedback-viewmodel.ts";
import { buildAdoptionOutput, type AdoptionOutput } from "../domain/journey/adoption-output.ts";
import type { PersistedJourney, PersistedProgress } from "../data/progress-store.ts";

export type JourneyView =
  | "journey-home"
  | "journey-setup"
  | "journey-review"
  | "journey-feedback"
  | "journey-completion"
  | "journey-interstitial"
  | "journey-release"
  | "journey-result";

export interface JourneyState {
  readonly view: JourneyView;
  readonly locale: Locale;
  readonly mode: ExperienceMode;
  readonly profile: JourneyProfile;
  readonly progress: JourneyProgress;
  readonly reviews: Readonly<Partial<Record<JourneyStepId, ArtifactReview>>>;
  readonly completionDecision?: ApprovalDecision | undefined;
  readonly releaseDecision?: ApprovalDecision | undefined;
  readonly releaseConflated: boolean;
  /** feedback view で表示中の直近評価（Guided/Simulation）。 */
  readonly lastEvaluation?: ReviewEvaluation | undefined;
  /** setup 編集中の下書き。 */
  readonly draftUserAuthored: ProjectContextInput["userAuthored"];
  readonly draftStructured: StructuredControlInput;
  /**
   * 復元可能な in-progress Journey があるか（Home の Resume 導線・P1-2）。
   * これがあると journey-home で Resume Journey を出し、resume() で復帰できる。
   */
  readonly resumable: boolean;
  /**
   * Simulation の critical miss で強制 rework が必要な状態（P1-3/P1-4）。
   * feedback view でこれが true のとき、Next を出さず Return for rework を促す。
   */
  readonly mustFix: boolean;
  /**
   * 学習履歴（P1-5 N3）。current review 状態とは独立に、Journey 中に一度でも起きた
   * miss / false positive / rework を累積する。最終的に correct review へ直しても消えない。
   */
  readonly learningHistory: LearningHistory;
  /** Journey が完了したか（P2-5 N6）。true なら Home は completed 扱い（in-progress resume を出さない）。 */
  readonly journeyComplete: boolean;
  /**
   * 未 submit の Review 下書き（G1）。step ごとに保持し、reload / Home 往復後も復元する。
   * submitReview で確定した review とは独立。artifactId が現在の artifact と一致するときのみ hydrate。
   */
  readonly reviewDrafts: Readonly<Partial<Record<JourneyStepId, ReviewDraft>>>;
  /**
   * RC5 P1-C: Return が「実 artifact 変化を生まない no-op」だったため拒否したことの通知理由。
   *  - "allResolved"  : 選択した指摘がすべて既に解消済み（terminal）。
   *  - "noValidTarget": 差し戻し対象となる未解決の指摘が選択されていない。
   * silent no-op で古い revision を再表示するのを禁止し、明示メッセージを出すためのフラグ。
   * 次の submit / rework / 画面遷移でクリアする。
   */
  readonly reworkRejection?: "allResolved" | "noValidTarget" | undefined;
  /**
   * RC5 P1-D: Conditional Approval を first-class state として保持する。
   * approve-with-conditions を選んだ工程で構造化条件（condition / evidence / dueGate）を記録し、
   * 下流（後続 review step）・Completion・Release・Result で一貫して参照する。
   * conditions が消えない = 実質 Approve に退化しないことの保証。
   */
  readonly conditionalApprovals: readonly ConditionalApproval[];
}

/**
 * 未 submit の Review 下書き（G1）。submitReview 前の作業中入力を step 単位で persist/restore する。
 * artifactId を持ち、現在表示中の artifact と一致するときだけ hydrate する（revision ずれで誤復元しない）。
 */
export interface ReviewDraft {
  readonly artifactId: string;
  readonly findings: readonly { readonly itemId: string; readonly severity?: Severity | undefined }[];
  readonly gateDecision: ArtifactReview["gateDecision"];
  readonly noteText?: string | undefined;
}

/**
 * finding-level の学習履歴エントリ（F4）。「具体的に何を間違えたか」に答えるための情報。
 * internal ID は含めず locale key / 列挙値のみ。stable key（stepId + itemTitleKey + mistakeType）で dedup。
 */
export interface LearningHistoryEntry {
  readonly itemTitleKey: string;
  readonly itemBodyKey: string;
  readonly mistakeType: "missed" | "false-positive";
  readonly severity?: Severity | undefined;
  readonly whyItMattersKey?: string | undefined;
  readonly originStepId?: JourneyStepId | undefined;
  readonly affectedLaterStepId?: JourneyStepId | undefined;
  readonly consequenceKey?: string | undefined;
  readonly revisitStepId?: JourneyStepId | undefined;
}

/** Journey を通じた学習履歴の累積（P1-5 / F3 / F4）。current state とは別に保持・永続する。 */
export interface LearningHistory {
  /** finding-level の履歴（dedup 済み・表示用）。 */
  readonly entries: readonly LearningHistoryEntry[];
  /** miss 発生回数（累積・aggregate metric）。dedup とは別に実発生回数を保持。 */
  readonly totalMissed: number;
  /** false positive 発生回数（累積）。 */
  readonly totalFalse: number;
}

function emptyLearningHistory(): LearningHistory {
  return { entries: [], totalMissed: 0, totalFalse: 0 };
}

/** entry の stable key（dedup 用）。 */
function historyEntryKey(e: LearningHistoryEntry): string {
  return `${e.originStepId ?? "?"}__${e.itemTitleKey}__${e.mistakeType}`;
}

/**
 * RC5 P1-D: UI が渡す条件付き承認の構造化入力（1 件）。
 * sourceStep / status / highestSeverity は state 側で付与する。
 */
export interface ConditionalApprovalInput {
  readonly condition: string;
  readonly requiredEvidence?: string | undefined;
  readonly dueGate: ConditionDueGate;
  readonly findingIds?: readonly string[] | undefined;
}

export interface JourneyApi {
  readonly state: JourneyState;
  readonly policy: JourneyModePolicy;
  startGuided(): void;
  startSimulation(): void;
  startAdoption(): void;
  setDraftUserAuthored(field: string, text: string): void;
  setDraftStructured(field: keyof StructuredControlInput, value: string): void;
  beginJourney(): void;
  currentArtifact(): GeneratedArtifact;
  /**
   * RC4 Phase 3: current step の Local Rework Diff（前 Artifact Version → 現 Artifact Version）。
   * local Human Return → Agent Rework の Before/After 表示に使う。未 rework なら diff は undefined。
   */
  localReworkDiff(): LocalReworkDiffResult;
  /**
   * RC4 Phase 3: current step の Propagation Diff（upstream defect resolution による downstream 変化）。
   * 影響が無い（upstream resolved なし / content 変化なし）なら diff は undefined（捏造しない）。
   */
  propagationDiff(): PropagationDiffResult;
  /** 未 submit の Review 下書きを保存する（G1）。 */
  setReviewDraft(draft: ReviewDraft): void;
  submitReview(review: ArtifactReview): void;
  proceedAfterFeedback(): void;
  reworkTo(stepId: JourneyStepId, trigger: ReworkTrigger): void;
  /** RC5 P1-C: rework 拒否通知を閉じる（明示 dismiss）。 */
  dismissReworkRejection(): void;
  /**
   * Completion 承認判断。approve-with-conditions のときは構造化条件（P1-D）を渡す。
   * 条件は state.conditionalApprovals に保持され、Release / Result / 下流で参照される。
   */
  decideCompletion(decision: ApprovalDecision, conditions?: readonly ConditionalApprovalInput[]): void;
  toRelease(): void;
  decideRelease(
    decision: ApprovalDecision,
    conflated: boolean,
    conditions?: readonly ConditionalApprovalInput[],
  ): void;
  finalResult(): JourneyFinalResult;
  /** Completion 判断材料（P2-4）。 */
  completionSummary(): CompletionSummary;
  /**
   * RC4 Integrity（STEP 4）: Completion / Release / Result 共通の判断材料（single derived model）。
   * 同じ state なら常に同じ数字。Release 画面が「直前の Completion 判断材料」を再現するために使う。
   */
  decisionReadiness(): DecisionReadinessSummary;
  /** RC5 P1-D: 未解決の承認条件（open conditional approvals）。下流・Completion・Release・Result で表示。 */
  openConditions(): readonly ConditionalApproval[];
  /** Result の因果学習サマリ（P2-5）。 */
  causalSummary(): readonly CausalLearningEntry[];
  /** RC4 Final（STEP I）: Result 上部の最重要サマリ（学び3件 / 最も危険な Decision / 次の練習）。 */
  resultHighlights(): ResultHighlights;
  /**
   * RC5 P1-A: delivery/journey の帰結（JourneyOutcome）と学習者の判断品質（LearnerEvaluation）を
   * 分離した Result view model。Block が正しくても outcome は "blocked"、learner は "strong" になりうる。
   */
  outcomeSummary(): JourneyOutcomeSummary;
  /** 直近 review の human-readable feedback view model（P1-1 H2/H4）。 */
  feedbackViewModel(): FeedbackViewModel | undefined;
  /** RC4 Final（STEP H）: Adoption Review 向けの実務持ち帰り output（derived・決定的）。 */
  adoptionOutput(): import("../domain/journey/adoption-output.ts").AdoptionOutput;
  /** rework 回数（single source of truth = reworkHistory・P2-4 N5）。 */
  reworkCount(): number;
  /** Home へ戻る（Journey は破棄せず保持。Resume で復帰可能・P1-4）。 */
  goHome(): void;
  /** 保存済み in-progress Journey へ復帰する（P1-2）。 */
  resume(): void;
  /** 論理的な前画面へ戻る（presentation only・domain state を変えない・P1-4）。 */
  goBack(): void;
  /** current view の Back ラベル種別（"back" / "home" / "none"）。 */
  readonly backKind: "back" | "home" | "none";
  exit(): void;
}

/**
 * RC4 Phase 2: Return for Rework の「修正対象実 defect id」を決定的に導く。
 *
 * 戻る step の submit 済み review を、その step の現在 Artifact に対して評価し、
 * caught（= Ground Truth 上 defect を正しく指摘）した項目の defectId を返す。
 * - false positive（defect でない項目の指摘）は caughtItemIds に入らないため対象外（要件）。
 * - 未選択の defect は caught にならないため未解決のまま（部分 rework・要件）。
 * - review が無い（mandatory rework で feedback から直接戻る等）場合でも、submit 済み review が
 *   state.reviews[stepId] にあることが前提。無ければ空（no-op = 本文は変わらないが revision は進む）。
 */
function computeReworkTargets(
  state: JourneyState,
  stepId: JourneyStepId,
): readonly import("../domain/journey/journey-entities.ts").DefectDefinition[] {
  const review = state.reviews[stepId];
  if (review === undefined) return [];
  const defects = buildDefectSet(state.profile.context.structured, state.profile.profileDefectRules);
  const artifact = buildArtifactForStep(currentRunInput(state), stepId);
  // review の artifactId が現在の artifact と一致しないと evaluateArtifactReview は reject するため、
  // identity 不一致（revision ずれ）のときは安全に no-op。
  if (review.artifactId !== artifact.artifactId) return [];
  const evaluation = evaluateArtifactReview(artifact, defects, review);
  const stepDefects = defectsForStep(defects, stepId);
  const byItemId = new Map(stepDefects.map((d) => [d.itemId, d]));
  const targets: import("../domain/journey/journey-entities.ts").DefectDefinition[] = [];
  for (const itemId of evaluation.caughtItemIds) {
    const defect = byItemId.get(itemId);
    if (defect !== undefined) targets.push(defect);
  }
  return targets;
}

/**
 * RC5 P1-C: ユーザーが指摘した項目のうち、この工程の defect に対応し「既に terminal（解消済み）」
 * である件数を返す。resolved item を再選択して Return した（= fake revision を作らせない）ケースを
 * 正確に検出するために使う。review 未提出 / 別 revision の review なら 0。
 */
function countSelectedResolvedFindings(state: JourneyState, stepId: JourneyStepId): number {
  const review = state.reviews[stepId];
  if (review === undefined) return 0;
  const defects = buildDefectSet(state.profile.context.structured, state.profile.profileDefectRules);
  const stepDefects = defectsForStep(defects, stepId);
  const byItemId = new Map(stepDefects.map((d) => [d.itemId, d]));
  const stages = defectStagesOf(state.progress, stepId);
  let count = 0;
  for (const f of review.findings) {
    const defect = byItemId.get(f.itemId);
    if (defect === undefined) continue; // false positive（defect でない）は対象外。
    const stage = stages[defect.defectId] ?? 0;
    if (isTerminalStage(defect, stage)) count += 1;
  }
  return count;
}

/**
 * RC5 P1-D: UI 入力の条件を first-class な ConditionalApproval へ変換する。
 * - sourceStepId / status(open) を付与。
 * - highestSeverity は「現在の未解決 finding（見逃し）の最高深刻度」を Ground Truth から決定的に導く。
 *   これにより High severity を条件付きで通した場合に open risk として可視化できる（無条件に問題なしにしない）。
 * - 空条件（condition が空白のみ）は捨てる。
 */
function buildConditionalApprovals(
  state: JourneyState,
  sourceStepId: JourneyStepId,
  inputs: readonly ConditionalApprovalInput[],
): ConditionalApproval[] {
  const result = computeJourneyResult(currentRunInput(state));
  // 未解決 finding の最高深刻度（Ground Truth severity）。none なら undefined。
  const defects = buildDefectSet(state.profile.context.structured, state.profile.profileDefectRules);
  const rank: Record<string, number> = { low: 0, medium: 1, high: 2 };
  let highest: "low" | "medium" | "high" | undefined;
  for (const ev of result.reviewEvaluations) {
    for (const itemId of ev.missedItemIds) {
      const sev = defects.find((d) => d.itemId === itemId)?.expectedSeverity;
      if (sev === undefined) continue;
      if (highest === undefined || rank[sev]! > rank[highest]!) highest = sev;
    }
  }
  const out: ConditionalApproval[] = [];
  for (const inp of inputs) {
    if (inp.condition.trim().length === 0) continue;
    out.push({
      sourceStepId,
      findingIds: inp.findingIds !== undefined ? [...inp.findingIds] : [],
      condition: inp.condition.trim(),
      ...(inp.requiredEvidence !== undefined && inp.requiredEvidence.trim().length > 0
        ? { requiredEvidence: inp.requiredEvidence.trim() }
        : {}),
      dueGate: inp.dueGate,
      status: "open",
      ...(highest !== undefined ? { highestSeverity: highest } : {}),
    });
  }
  return out;
}

/**
 * RC6 P1-A: step-level の Approve with Conditions を ConditionalApproval[] へ変換する。
 *
 * decideCompletion/decideRelease 用の buildConditionalApprovals（全体 missed の最高深刻度を使う）とは別に、
 * step 単位で以下を導く:
 *  - findingIds   : この step で「実 defect を正しく指摘した（caught）」項目 id。条件が守る対象。
 *  - highestSeverity: この step の caught + missed finding の Ground Truth 最高深刻度。
 *    high を条件付きで通した場合に open high-severity risk として可視化する（無条件に問題なしにしない）。
 *  - status       : caught（未解決の実 defect を認識しつつ通した）→ conditionally-accepted、
 *                   それ以外 → open。いずれも resolved ではない（下流で消えない）。
 * 条件本文が空（空白のみ）の入力は捨てる。条件が 1 件も無ければ空配列。
 */
function buildStepConditionalApprovals(
  state: JourneyState,
  sourceStepId: JourneyStepId,
  inputs: readonly ConditionalApprovalInput[],
  evaluation: ReviewEvaluation,
): ConditionalApproval[] {
  const defects = buildDefectSet(state.profile.context.structured, state.profile.profileDefectRules);
  const stepDefects = defectsForStep(defects, sourceStepId);
  const byItemId = new Map(stepDefects.map((d) => [d.itemId, d]));
  const rank: Record<string, number> = { low: 0, medium: 1, high: 2 };

  // この step で認識した/見逃した実 defect の最高深刻度（Ground Truth）。
  let highest: "low" | "medium" | "high" | undefined;
  const consider = [...evaluation.caughtItemIds, ...evaluation.missedItemIds];
  for (const itemId of consider) {
    const sev = byItemId.get(itemId)?.expectedSeverity;
    if (sev === undefined) continue;
    if (highest === undefined || rank[sev]! > rank[highest]!) highest = sev;
  }

  // 条件が守る対象 = caught（認識した実 defect）の defectId。
  const caughtDefectIds: string[] = [];
  for (const itemId of evaluation.caughtItemIds) {
    const d = byItemId.get(itemId);
    if (d !== undefined) caughtDefectIds.push(d.defectId);
  }
  // caught（実 defect を認識しつつ条件付き通過）なら conditionally-accepted、それ以外は open。
  const status: ConditionalApproval["status"] =
    caughtDefectIds.length > 0 ? "conditionally-accepted" : "open";

  const out: ConditionalApproval[] = [];
  for (const inp of inputs) {
    if (inp.condition.trim().length === 0) continue;
    out.push({
      sourceStepId,
      findingIds: inp.findingIds !== undefined && inp.findingIds.length > 0
        ? [...inp.findingIds]
        : caughtDefectIds,
      condition: inp.condition.trim(),
      ...(inp.requiredEvidence !== undefined && inp.requiredEvidence.trim().length > 0
        ? { requiredEvidence: inp.requiredEvidence.trim() }
        : {}),
      dueGate: inp.dueGate,
      status,
      ...(highest !== undefined ? { highestSeverity: highest } : {}),
    });
  }
  return out;
}

function currentRunInput(state: JourneyState): JourneyRunInput {
  return {
    profile: state.profile,
    mode: state.mode,
    progress: state.progress,
    reviews: state.reviews,
    ...(state.completionDecision !== undefined ? { completionDecision: state.completionDecision } : {}),
    ...(state.releaseDecision !== undefined ? { releaseDecision: state.releaseDecision } : {}),
    releaseConflatedWithCompletion: state.releaseConflated,
    // RC6 P1-A: open conditions を result へ伝えるため conditionalApprovals を渡す。
    conditionalApprovals: state.conditionalApprovals,
  };
}

/** JourneyState → PersistedJourney（stable-id のみ）。 */
function toPersistedJourney(s: JourneyState): PersistedJourney {
  const reviews: PersistedJourney["reviews"] = {};
  const rec = reviews as Record<string, unknown>;
  for (const stepId of JOURNEY_STEP_IDS) {
    const r = s.reviews[stepId];
    if (r === undefined) continue;
    rec[stepId] = {
      findings: r.findings.map((f) => (f.severity !== undefined ? { itemId: f.itemId, severity: f.severity } : { itemId: f.itemId })),
      gateDecision: r.gateDecision,
      ...(r.noteText !== undefined ? { noteText: r.noteText } : {}),
    };
  }
  return {
    mode: s.mode,
    profileId: s.profile.profileId,
    // RC4: archetype を保存（復元時に本文題材を再現）。
    archetypeId: s.profile.context.archetypeId,
    currentStepId: s.progress.currentStepId,
    userAuthored: { ...s.profile.context.userAuthored } as Record<string, string>,
    structured: { ...s.profile.context.structured } as unknown as Record<string, string>,
    revisions: s.progress.revisions,
    completedStepIds: s.progress.completedStepIds,
    reworkHistory: s.progress.reworkHistory.map((e) => ({
      fromStepId: e.fromStepId,
      toStepId: e.toStepId,
      action: e.action,
      trigger: e.trigger,
      atRevision: e.atRevision,
      // RC4 Phase 2: defect 単位の記録を additive 保存。
      ...(e.targetedDefectIds !== undefined ? { targetedDefectIds: [...e.targetedDefectIds] } : {}),
      ...(e.resolvedDefectIds !== undefined ? { resolvedDefectIds: [...e.resolvedDefectIds] } : {}),
      ...(e.remainingDefectIds !== undefined ? { remainingDefectIds: [...e.remainingDefectIds] } : {}),
      ...(e.isNoOpAttempt !== undefined ? { isNoOpAttempt: e.isNoOpAttempt } : {}),
      ...(e.reviewNote !== undefined ? { reviewNote: e.reviewNote } : {}),
    })),
    // RC4 Phase 2: 解決済み defect（step → id[]）を保存。reload/Resume で corrected を維持。
    resolvedDefectIds: serializeResolvedDefectIds(s.progress.resolvedDefectIds),
    // RC4 Final: multi-stage defect の到達済み stageIndex（step → defectId → index）を保存。
    // reload 後も partial（中間 stage）を維持する。undefined（legacy）は保存しない。
    ...(s.progress.defectStages !== undefined
      ? { defectStages: serializeDefectStages(s.progress.defectStages) }
      : {}),
    // RC4 Persistence v4: artifactVersions / materializedSteps を exact 保存する。
    // これにより reload 後も revision != artifactVersion（propagation 由来 increment 含む）を維持できる。
    // undefined（legacy state）は保存しない（restore 側で legacy 扱い）。
    ...(s.progress.artifactVersions !== undefined
      ? { artifactVersions: serializeStepNumberRecord(s.progress.artifactVersions) }
      : {}),
    ...(s.progress.materializedSteps !== undefined
      ? { materializedSteps: serializeStepBoolRecord(s.progress.materializedSteps) }
      : {}),
    reviews,
    ...(s.completionDecision !== undefined ? { completionDecision: s.completionDecision } : {}),
    ...(s.releaseDecision !== undefined ? { releaseDecision: s.releaseDecision } : {}),
    releaseConflated: s.releaseConflated,
    // F1: Setup 中の下書き（beginJourney 前でも保存）。
    draftUserAuthored: { ...s.draftUserAuthored } as Record<string, string>,
    draftStructured: { ...s.draftStructured } as unknown as Record<string, string>,
    savedView: s.view,
    journeyComplete: s.journeyComplete,
    // F3/F4: finding-level 学習履歴。
    learningHistory: {
      entries: s.learningHistory.entries.map((e) => ({
        itemTitleKey: e.itemTitleKey,
        itemBodyKey: e.itemBodyKey,
        mistakeType: e.mistakeType,
        ...(e.severity !== undefined ? { severity: e.severity } : {}),
        ...(e.whyItMattersKey !== undefined ? { whyItMattersKey: e.whyItMattersKey } : {}),
        ...(e.originStepId !== undefined ? { originStepId: e.originStepId } : {}),
        ...(e.affectedLaterStepId !== undefined ? { affectedLaterStepId: e.affectedLaterStepId } : {}),
        ...(e.consequenceKey !== undefined ? { consequenceKey: e.consequenceKey } : {}),
        ...(e.revisitStepId !== undefined ? { revisitStepId: e.revisitStepId } : {}),
      })),
      totalMissed: s.learningHistory.totalMissed,
      totalFalse: s.learningHistory.totalFalse,
    },
    // G1: 未 submit の Review 下書き。
    reviewDrafts: serializeReviewDrafts(s.reviewDrafts),
    // RC5 P1-D: Conditional Approval を保存（空なら省略）。
    ...(s.conditionalApprovals.length > 0
      ? { conditionalApprovals: s.conditionalApprovals.map(toPersistedCondition) }
      : {}),
  };
}

/** JourneyProgress.resolvedDefectIds → Persisted 形（plain record・stable id のみ）。 */
function serializeResolvedDefectIds(
  resolved: Readonly<Record<string, readonly string[]>>,
): Readonly<Record<string, readonly string[]>> {
  const out: Record<string, readonly string[]> = {};
  for (const k of Object.keys(resolved)) {
    const v = resolved[k];
    if (v !== undefined && v.length > 0) out[k] = [...v];
  }
  return out;
}

/** RC4 Final: JourneyProgress.defectStages → Persisted 形（step→defectId→index, 数値のみ）。 */
function serializeDefectStages(
  stages: Readonly<Record<string, Readonly<Record<string, number>>>>,
): Readonly<Record<string, Readonly<Record<string, number>>>> {
  const out: Record<string, Record<string, number>> = {};
  for (const stepId of Object.keys(stages)) {
    const perDefect = stages[stepId];
    if (perDefect === undefined) continue;
    const inner: Record<string, number> = {};
    for (const defectId of Object.keys(perDefect)) {
      const idx = perDefect[defectId];
      // stage 0（未前進）は保存不要（default と同じ）。partial/resolved のみ保存。
      if (typeof idx === "number" && idx > 0) inner[defectId] = idx;
    }
    if (Object.keys(inner).length > 0) out[stepId] = inner;
  }
  return out;
}

/** RC4 v4: step→number（artifactVersions）を Persisted 形へ（数値のみ）。 */
function serializeStepNumberRecord(
  rec: Partial<Record<JourneyStepId, number>>,
): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(rec)) {
    const val = rec[k as JourneyStepId];
    if (typeof val === "number") out[k] = val;
  }
  return out;
}

/** RC4 v4: step→boolean（materializedSteps）を Persisted 形へ（真偽のみ）。 */
function serializeStepBoolRecord(
  rec: Partial<Record<JourneyStepId, boolean>>,
): Readonly<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const k of Object.keys(rec)) {
    const val = rec[k as JourneyStepId];
    if (typeof val === "boolean") out[k] = val;
  }
  return out;
}

/** JourneyState.reviewDrafts → Persisted 形（stable id のみ）。 */
function serializeReviewDrafts(
  drafts: Readonly<Partial<Record<JourneyStepId, ReviewDraft>>>,
): NonNullable<PersistedJourney["reviewDrafts"]> {
  const out: Record<string, unknown> = {};
  for (const stepId of JOURNEY_STEP_IDS) {
    const d = drafts[stepId];
    if (d === undefined) continue;
    out[stepId] = {
      artifactId: d.artifactId,
      findings: d.findings.map((f) =>
        f.severity !== undefined ? { itemId: f.itemId, severity: f.severity } : { itemId: f.itemId },
      ),
      gateDecision: d.gateDecision,
      ...(d.noteText !== undefined ? { noteText: d.noteText } : {}),
    };
  }
  return out as NonNullable<PersistedJourney["reviewDrafts"]>;
}

/** PersistedJourney → 復元用の JourneyState 断片（P1-2 / F1 / F3）。不正なら null（controlled fallback）。 */
interface RestoredJourney {
  readonly mode: ExperienceMode;
  readonly profile: JourneyProfile;
  readonly progress: JourneyProgress;
  readonly reviews: Readonly<Partial<Record<JourneyStepId, ArtifactReview>>>;
  readonly completionDecision?: ApprovalDecision | undefined;
  readonly releaseDecision?: ApprovalDecision | undefined;
  readonly releaseConflated: boolean;
  readonly draftUserAuthored: ProjectContextInput["userAuthored"];
  readonly draftStructured: StructuredControlInput;
  readonly savedView: JourneyView | undefined;
  readonly journeyComplete: boolean;
  readonly learningHistory: LearningHistory;
  readonly reviewDrafts: Readonly<Partial<Record<JourneyStepId, ReviewDraft>>>;
  readonly conditionalApprovals: readonly ConditionalApproval[];
}

const APPROVAL_DECISIONS: readonly ApprovalDecision[] = ["approve", "approve-with-conditions", "return", "block"];
const GATE_DECISIONS = ["approve", "approve-with-conditions", "return-for-rework", "change-scope", "block"] as const;
const SEVERITIES = ["low", "medium", "high"] as const;

function isApproval(v: unknown): v is ApprovalDecision {
  return typeof v === "string" && (APPROVAL_DECISIONS as readonly string[]).includes(v);
}

/**
 * PersistedJourney を JourneyState へ復元する（P1-2）。structured から profile を再構築し、
 * reviews / progress / decisions を型安全に戻す。壊れていれば null（silent data loss せず home 起動）。
 */
function restoreJourney(persisted: PersistedJourney): RestoredJourney | null {
  const mode = persisted.mode;
  if (mode !== "guided" && mode !== "simulation" && mode !== "adoption-review") return null;

  // structured を StructuredControlInput へ（欠損は default で補完）。
  const base = defaultStructuredInput();
  const structured = { ...base } as Record<string, string>;
  for (const k of Object.keys(persisted.structured)) {
    structured[k] = persisted.structured[k] as string;
  }
  // RC4: archetype を復元（未指定/不正は default archetype で補完・Human Decision 10）。
  const archetypeId = isProjectArchetypeId(persisted.archetypeId)
    ? persisted.archetypeId
    : DEFAULT_ARCHETYPE_ID;
  const profile =
    mode === "guided"
      ? CANONICAL_SAMPLE_PROFILE
      : buildUserProfile(
          "user",
          persisted.userAuthored,
          structured as unknown as StructuredControlInput,
          archetypeId,
        );

  const currentStepId: JourneyStepId = (JOURNEY_STEP_IDS as readonly string[]).includes(persisted.currentStepId)
    ? (persisted.currentStepId as JourneyStepId)
    : "j1-requirements";
  const completedStepIds = persisted.completedStepIds.filter((s): s is JourneyStepId =>
    (JOURNEY_STEP_IDS as readonly string[]).includes(s),
  );

  const progress: JourneyProgress = {
    currentStepId,
    revisions: persisted.revisions,
    reworkHistory: persisted.reworkHistory.map((e) => ({
      fromStepId: e.fromStepId as JourneyStepId,
      toStepId: e.toStepId as JourneyStepId,
      action: e.action as JourneyProgress["reworkHistory"][number]["action"],
      trigger: e.trigger as JourneyProgress["reworkHistory"][number]["trigger"],
      atRevision: e.atRevision,
      // RC4 Phase 2: defect 単位の記録を復元（additive・missing は undefined のまま）。
      ...(Array.isArray(e.targetedDefectIds) ? { targetedDefectIds: [...e.targetedDefectIds] } : {}),
      ...(Array.isArray(e.resolvedDefectIds) ? { resolvedDefectIds: [...e.resolvedDefectIds] } : {}),
      ...(Array.isArray(e.remainingDefectIds) ? { remainingDefectIds: [...e.remainingDefectIds] } : {}),
      ...(typeof e.isNoOpAttempt === "boolean" ? { isNoOpAttempt: e.isNoOpAttempt } : {}),
      ...(typeof e.reviewNote === "string" ? { reviewNote: e.reviewNote } : {}),
    })),
    completedStepIds,
    // RC4 Phase 2: 解決済み defect を復元（missing/不正 = 空 = RC3 挙動）。
    resolvedDefectIds: restoreResolvedDefectIds(persisted.resolvedDefectIds),
    // RC4 Final: multi-stage defect の到達済み stageIndex を復元（missing = 空 = 全 stage 0）。
    defectStages: restoreDefectStages(persisted.defectStages),
    // RC4 Persistence v4: artifactVersions / materializedSteps を exact restore。
    // これにより reload 後も revision != artifactVersion（propagation 由来 increment 含む）を維持する。
    // v4 では ProgressStore が旧版 journey を safe reset するので、ここに来る journey は v4 のみ。
    // フィールドが欠落した v4 journey（Phase 3 初期化前など）は空 record で初期化する（legacy 化しない）。
    artifactVersions: restoreStepNumberRecord(persisted.artifactVersions),
    materializedSteps: restoreStepBoolRecord(persisted.materializedSteps),
  };

  // reviews を復元（gate / severity を型検証）。
  // artifactId は復元後の progress で buildArtifactForStep を実行して再計算する
  // （effective artifactVersion = stored artifactVersion + propagation を含む displayed 版と一致させる。
  //  revision fallback は v4 では廃止）。
  //
  // effective artifactVersion は「direct upstream の review 見逃し」に依存するため（propagation は 1-hop）、
  // step を J1→J6 の順で処理し、各 step の artifactId を「それまでに確定した earlier step の review を
  // 含む input」で計算する（incremental）。これにより downstream の propagation-bumped 版も正しく再現する。
  const reviews: Partial<Record<JourneyStepId, ArtifactReview>> = {};
  for (const stepId of JOURNEY_STEP_IDS) {
    const r = persisted.reviews[stepId];
    if (r === undefined) continue;
    const gate = (GATE_DECISIONS as readonly string[]).includes(r.gateDecision)
      ? (r.gateDecision as ArtifactReview["gateDecision"])
      : "approve";
    const findings = r.findings.map((f) => {
      const sev = f.severity !== undefined && (SEVERITIES as readonly string[]).includes(f.severity)
        ? (f.severity as ArtifactReview["findings"][number]["severity"])
        : undefined;
      return sev !== undefined ? { itemId: f.itemId, severity: sev } : { itemId: f.itemId };
    });
    // これまでに確定した earlier step の reviews を含む input で artifactId を計算（1-hop 依存を満たす）。
    const inputSoFar: JourneyRunInput = { profile, mode, progress, reviews };
    reviews[stepId] = {
      artifactId: buildArtifactForStep(inputSoFar, stepId).artifactId,
      journeyStepId: stepId,
      findings,
      gateDecision: gate,
      ...(r.noteText !== undefined ? { noteText: r.noteText } : {}),
    };
  }

  // F1: Setup 下書きを復元（safe default）。
  const draftUserAuthored = (persisted.draftUserAuthored ?? {}) as ProjectContextInput["userAuthored"];
  const draftStructured = restoreStructured(persisted.draftStructured);
  const savedView = isJourneyView(persisted.savedView) ? persisted.savedView : undefined;

  // F3/F4: 学習履歴を復元（missing = empty・safe）。
  const learningHistory = restoreLearningHistory(persisted.learningHistory);

  return {
    mode,
    profile,
    progress,
    reviews,
    ...(isApproval(persisted.completionDecision) ? { completionDecision: persisted.completionDecision } : {}),
    ...(isApproval(persisted.releaseDecision) ? { releaseDecision: persisted.releaseDecision } : {}),
    releaseConflated: persisted.releaseConflated === true,
    draftUserAuthored,
    draftStructured,
    savedView,
    journeyComplete: persisted.journeyComplete === true || isApproval(persisted.releaseDecision),
    learningHistory,
    // G1: 未 submit の Review 下書きを復元（missing/不正 = 空）。
    reviewDrafts: restoreReviewDrafts(persisted.reviewDrafts),
    // RC5 P1-D: Conditional Approval を復元（missing/不正 = 空）。
    conditionalApprovals: restoreConditionalApprovals(persisted.conditionalApprovals),
  };
}

/** RC5 P1-D: persisted conditionalApprovals を復元（missing/不正な要素は捨てる・決定的）。 */
function restoreConditionalApprovals(
  v: PersistedJourney["conditionalApprovals"] | undefined,
): readonly ConditionalApproval[] {
  if (!Array.isArray(v)) return [];
  const isStepId = (id: string): boolean => (JOURNEY_STEP_IDS as readonly string[]).includes(id);
  const out: ConditionalApproval[] = [];
  for (const p of v) {
    const restored = fromPersistedCondition(p, isStepId);
    if (restored !== null) out.push(restored);
  }
  return out;
}

/** persisted reviewDrafts を復元（missing/不正 = 空。gate/severity を型検証）。 */
function restoreReviewDrafts(
  v: PersistedJourney["reviewDrafts"] | undefined,
): Readonly<Partial<Record<JourneyStepId, ReviewDraft>>> {
  const out: Partial<Record<JourneyStepId, ReviewDraft>> = {};
  if (v === undefined) return out;
  for (const stepId of JOURNEY_STEP_IDS) {
    const d = v[stepId];
    if (d === undefined || typeof d.artifactId !== "string") continue;
    const gate = (GATE_DECISIONS as readonly string[]).includes(d.gateDecision)
      ? (d.gateDecision as ArtifactReview["gateDecision"])
      : "approve";
    const findings = Array.isArray(d.findings)
      ? d.findings
          .filter((f): f is { itemId: string; severity?: string } => typeof f.itemId === "string")
          .map((f) =>
            isSeverity(f.severity) ? { itemId: f.itemId, severity: f.severity } : { itemId: f.itemId },
          )
      : [];
    out[stepId] = {
      artifactId: d.artifactId,
      findings,
      gateDecision: gate,
      ...(typeof d.noteText === "string" ? { noteText: d.noteText } : {}),
    };
  }
  return out;
}

const JOURNEY_VIEWS: readonly JourneyView[] = [
  "journey-home",
  "journey-setup",
  "journey-review",
  "journey-feedback",
  "journey-completion",
  "journey-interstitial",
  "journey-release",
  "journey-result",
];
function isJourneyView(v: unknown): v is JourneyView {
  return typeof v === "string" && (JOURNEY_VIEWS as readonly string[]).includes(v);
}

/** persisted structured（部分・不正含む）を安全な StructuredControlInput へ（default で補完）。 */
function restoreStructured(v: Readonly<Record<string, string>> | undefined): StructuredControlInput {
  const base = defaultStructuredInput() as unknown as Record<string, string>;
  const out: Record<string, string> = { ...base };
  if (v !== undefined) for (const k of Object.keys(v)) if (k in base) out[k] = v[k] as string;
  return out as unknown as StructuredControlInput;
}

/** persisted resolvedDefectIds を復元（missing/不正 = 空）。string 配列値のみ受理。 */
function restoreResolvedDefectIds(
  v: Readonly<Record<string, readonly string[]>> | undefined,
): Readonly<Record<string, readonly string[]>> {
  if (v === undefined || typeof v !== "object") return {};
  const out: Record<string, readonly string[]> = {};
  for (const k of Object.keys(v)) {
    const arr = v[k];
    if (Array.isArray(arr)) {
      const ids = arr.filter((x): x is string => typeof x === "string");
      if (ids.length > 0) out[k] = ids;
    }
  }
  return out;
}

/** RC4 Final: persisted defectStages を復元（step→defectId→index）。missing/不正 = 空 record。 */
function restoreDefectStages(
  v: Readonly<Record<string, Readonly<Record<string, number>>>> | undefined,
): Readonly<Record<string, Readonly<Record<string, number>>>> {
  const out: Record<string, Record<string, number>> = {};
  if (v === undefined || typeof v !== "object") return out;
  for (const stepId of Object.keys(v)) {
    if (!(JOURNEY_STEP_IDS as readonly string[]).includes(stepId)) continue;
    const perDefect = v[stepId];
    if (typeof perDefect !== "object" || perDefect === null) continue;
    const inner: Record<string, number> = {};
    for (const defectId of Object.keys(perDefect)) {
      const idx = perDefect[defectId];
      if (typeof idx === "number" && Number.isFinite(idx) && idx > 0) inner[defectId] = Math.floor(idx);
    }
    if (Object.keys(inner).length > 0) out[stepId] = inner;
  }
  return out;
}

/**
 * RC4 v4: persisted artifactVersions を復元（step→number）。
 * missing/不正な entry は無視。全体が欠落しても legacy 化せず空 record を返す
 * （v4 journey は Phase 3 version model で管理される前提。空 = 全 step 未 increment）。
 */
function restoreStepNumberRecord(
  v: Readonly<Record<string, number>> | undefined,
): Partial<Record<JourneyStepId, number>> {
  const out: Partial<Record<JourneyStepId, number>> = {};
  if (v === undefined || typeof v !== "object") return out;
  for (const k of Object.keys(v)) {
    if (!(JOURNEY_STEP_IDS as readonly string[]).includes(k)) continue;
    const n = v[k];
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) out[k as JourneyStepId] = n;
  }
  return out;
}

/** RC4 v4: persisted materializedSteps を復元（step→boolean）。missing/不正 = 空 record。 */
function restoreStepBoolRecord(
  v: Readonly<Record<string, boolean>> | undefined,
): Partial<Record<JourneyStepId, boolean>> {
  const out: Partial<Record<JourneyStepId, boolean>> = {};
  if (v === undefined || typeof v !== "object") return out;
  for (const k of Object.keys(v)) {
    if (!(JOURNEY_STEP_IDS as readonly string[]).includes(k)) continue;
    if (typeof v[k] === "boolean") out[k as JourneyStepId] = v[k]!;
  }
  return out;
}

/** persisted learningHistory を復元（missing/不正 = empty）。 */
function restoreLearningHistory(
  v: NonNullable<PersistedJourney["learningHistory"]> | undefined,
): LearningHistory {
  if (v === undefined || !Array.isArray(v.entries)) return emptyLearningHistory();
  const entries: LearningHistoryEntry[] = v.entries
    .filter((e) => typeof e.itemTitleKey === "string" && typeof e.itemBodyKey === "string")
    .map((e) => ({
      itemTitleKey: e.itemTitleKey,
      itemBodyKey: e.itemBodyKey,
      mistakeType: e.mistakeType === "false-positive" ? "false-positive" : "missed",
      ...(isSeverity(e.severity) ? { severity: e.severity } : {}),
      ...(typeof e.whyItMattersKey === "string" ? { whyItMattersKey: e.whyItMattersKey } : {}),
      ...(isStep(e.originStepId) ? { originStepId: e.originStepId } : {}),
      ...(isStep(e.affectedLaterStepId) ? { affectedLaterStepId: e.affectedLaterStepId } : {}),
      ...(typeof e.consequenceKey === "string" ? { consequenceKey: e.consequenceKey } : {}),
      ...(isStep(e.revisitStepId) ? { revisitStepId: e.revisitStepId } : {}),
    }));
  return {
    entries,
    totalMissed: typeof v.totalMissed === "number" ? v.totalMissed : 0,
    totalFalse: typeof v.totalFalse === "number" ? v.totalFalse : 0,
  };
}
function isSeverity(v: unknown): v is Severity {
  return v === "low" || v === "medium" || v === "high";
}
function isStep(v: unknown): v is JourneyStepId {
  return typeof v === "string" && (JOURNEY_STEP_IDS as readonly string[]).includes(v);
}

/**
 * 復元した Journey からどの view で再開するかを決める（F2）。
 * decision semantics + progress + journeyComplete + savedView から決定。
 * Completion Return/Block からは Release へ絶対 resume しない。
 */
function resumeViewFor(r: RestoredJourney): JourneyView {
  // Release 済み or block 済み or 完了 → Result。
  if (r.releaseDecision !== undefined) return "journey-result";
  if (r.completionDecision === "block") return "journey-result";
  if (r.journeyComplete) return "journey-result";
  // Completion Return → review 工程（Release へは行かない）。
  if (r.completionDecision === "return") return "journey-review";
  // Completion Approve / Approve-with-conditions → Release path（interstitial は完了扱いなので release へ）。
  if (r.completionDecision === "approve" || r.completionDecision === "approve-with-conditions") {
    return "journey-release";
  }
  // decision 未確定: progress で判断。
  if (r.progress.currentStepId === "j7-completion-approval") return "journey-completion";
  if (r.progress.currentStepId === "j8-release-approval") return "journey-release";
  // Setup 中に保存された場合は setup へ復帰（F1）。
  if (r.savedView === "journey-setup") return "journey-setup";
  return "journey-review";
}

export function useJourneyState(app: Application): JourneyApi {
  const [state, setState] = useState<JourneyState>(() => {
    const defaults: JourneyState = {
      view: "journey-home",
      locale: app.locale,
      mode: "guided",
      profile: CANONICAL_SAMPLE_PROFILE,
      progress: initialProgress(),
      reviews: {},
      releaseConflated: false,
      draftUserAuthored: {},
      draftStructured: defaultStructuredInput(),
      resumable: false,
      mustFix: false,
      learningHistory: emptyLearningHistory(),
      journeyComplete: false,
      reviewDrafts: {},
      conditionalApprovals: [],
    };
    // 起動時に保存済み journey を検出して Resume 可能にする（P1-2）。domain へ壊れた state を渡さない。
    // 完了済み journey（release 済み）は in-progress resume として扱わない（P2-5 N6）。
    try {
      const loaded = app.store.load(app.locale);
      const pj = loaded.progress.journey;
      if (pj !== null) {
        const restored = restoreJourney(pj);
        if (restored !== null) {
          // G3: reload 後の completed 判定は release 済みだけでなく
          // Completion Block（completionDecision==="block"）や persisted journeyComplete も含める。
          // restoreJourney が journeyComplete を正しく算出しているのでそれを唯一の真実として使う。
          const completed = restored.journeyComplete;
          return {
            ...defaults,
            locale: loaded.progress.locale,
            resumable: !completed,
            journeyComplete: completed,
          };
        }
      }
      return { ...defaults, locale: loaded.progress.locale };
    } catch {
      return defaults;
    }
  });

  // RC2 フィールドを保持したまま journey フィールドだけ更新して永続化する。
  const persist = useCallback(
    (s: JourneyState) => {
      try {
        const loaded = app.store.load(s.locale);
        const next: PersistedProgress = { ...loaded.progress, journey: toPersistedJourney(s) };
        app.store.save(next);
      } catch {
        // 保存失敗は学習継続を妨げない。
      }
    },
    [app],
  );

  const update = useCallback(
    (fn: (s: JourneyState) => JourneyState, opts?: { persist?: boolean }) => {
      setState((s) => {
        const next = fn(s);
        if (opts?.persist) persist(next);
        return next;
      });
    },
    [persist],
  );

  const startGuided = useCallback(() => {
    update((s) => {
      // initialProgress() は 1 回だけ生成する（progress property も 1 件だけ）。
      const guidedProgress = initialProgress();
      return {
        ...s,
        mode: "guided",
        profile: CANONICAL_SAMPLE_PROFILE,
        reviews: {},
        completionDecision: undefined,
        releaseDecision: undefined,
        releaseConflated: false,
        mustFix: false,
        resumable: true,
        learningHistory: emptyLearningHistory(),
        journeyComplete: false,
        reviewDrafts: {},
        conditionalApprovals: [],
        reworkRejection: undefined,
        // RC4 Phase 3: journey-review へ遷移するので初期 step を materialize 記録。
        progress: markMaterialized(guidedProgress, guidedProgress.currentStepId),
        view: "journey-review",
      };
    }, { persist: true });
  }, [update]);

  const startFromUser = useCallback(
    (mode: ExperienceMode) => {
      update((s) => ({
        ...s,
        mode,
        progress: initialProgress(),
        reviews: {},
        completionDecision: undefined,
        releaseDecision: undefined,
        releaseConflated: false,
        mustFix: false,
        learningHistory: emptyLearningHistory(),
        journeyComplete: false,
        reviewDrafts: {},
        conditionalApprovals: [],
        reworkRejection: undefined,
        draftStructured: defaultStructuredInput(),
        draftUserAuthored: {},
        // F1: setup に入った時点で resume 可能（Home へ行って戻れる）。
        resumable: true,
        view: "journey-setup",
      }), { persist: true });
    },
    [update],
  );

  const startSimulation = useCallback(() => startFromUser("simulation"), [startFromUser]);
  const startAdoption = useCallback(() => startFromUser("adoption-review"), [startFromUser]);

  const setDraftUserAuthored = useCallback(
    (field: string, text: string) => {
      // F1: Setup 中の下書きも永続化する（beginJourney 前でも復元できるように）。
      update((s) => ({ ...s, draftUserAuthored: { ...s.draftUserAuthored, [field]: text } }), { persist: true });
    },
    [update],
  );

  const setDraftStructured = useCallback(
    (field: keyof StructuredControlInput, value: string) => {
      update((s) => ({
        ...s,
        draftStructured: { ...s.draftStructured, [field]: value } as StructuredControlInput,
      }), { persist: true });
    },
    [update],
  );

  // G1: 未 submit の Review 下書きを step 単位で保存する（入力のたびに persist）。
  const setReviewDraft = useCallback(
    (draft: ReviewDraft) => {
      update(
        (s) => ({
          ...s,
          reviewDrafts: { ...s.reviewDrafts, [s.progress.currentStepId]: draft },
        }),
        { persist: true },
      );
    },
    [update],
  );

  const beginJourney = useCallback(() => {
    update((s) => {
      const profile = buildUserProfile("user", s.draftUserAuthored, s.draftStructured);
      const startProgress = initialProgress();
      return {
        ...s,
        profile,
        // RC4 Phase 3: journey-review 表示が確定するので初期 step を materialize 記録。
        progress: markMaterialized(startProgress, startProgress.currentStepId),
        reviews: {},
        resumable: true,
        learningHistory: emptyLearningHistory(),
        journeyComplete: false,
        reviewDrafts: {},
        conditionalApprovals: [],
        reworkRejection: undefined,
        view: "journey-review",
      };
    }, { persist: true });
  }, [update]);

  const currentArtifact = useCallback((): GeneratedArtifact => {
    return buildArtifactForStep(currentRunInput(state), state.progress.currentStepId);
  }, [state]);

  // RC4 Phase 3: current step の Local Rework Diff（derived・永続しない）。
  const localReworkDiff = useCallback(
    (): LocalReworkDiffResult => computeLocalReworkDiff(currentRunInput(state), state.progress.currentStepId),
    [state],
  );

  // RC4 Phase 3: current step の Propagation Diff（derived・永続しない）。
  const propagationDiff = useCallback(
    (): PropagationDiffResult => computePropagationDiff(currentRunInput(state), state.progress.currentStepId),
    [state],
  );

  const submitReview = useCallback(
    (review: ArtifactReview) => {
      update(
        (s) => {
          const reviews = { ...s.reviews, [s.progress.currentStepId]: review };
          // G1: submit したので当該 step の下書きは破棄（確定 review が source of truth）。
          const reviewDrafts = { ...s.reviewDrafts };
          delete reviewDrafts[s.progress.currentStepId];
          const policy = journeyModePolicyFor(s.mode);
          // RC5 P1-C: 新しい submit で rework 拒否通知はクリアする。
          const next: JourneyState = { ...s, reviews, reviewDrafts, reworkRejection: undefined };

          // 全モードで評価し、学習履歴（miss/FP）を累積する（P1-5 N3）。
          // current review は正解へ直せるが、履歴は消さない。
          const defects = buildDefectSet(s.profile.context.structured, s.profile.profileDefectRules);
          const artifact = buildArtifactForStep(currentRunInput(next), s.progress.currentStepId);
          const evaluation = evaluateArtifactReview(artifact, defects, review);
          const vm = buildFeedbackViewModel(artifact, defects, evaluation);
          const learningHistory = mergeLearningHistory(s.learningHistory, vm);

          // RC6 P1-A: step-level の Approve with Conditions を first-class な ConditionalApproval へ変換する。
          // 従来は decideCompletion(J7)/decideRelease(J8) でしか条件を作らず、j1〜j6 の
          // 「条件付き承認」が下流・Completion・Release・Result から消えて実質 plain Approve に退化していた。
          // 同じ step を再 submit した場合は、その step 由来の既存条件を置き換える（重複蓄積を防ぐ）。
          const stepId = s.progress.currentStepId;
          const keptConditions = s.conditionalApprovals.filter((c) => c.sourceStepId !== stepId);
          const newStepConditions =
            review.gateDecision === "approve-with-conditions"
              ? buildStepConditionalApprovals(next, stepId, review.conditions ?? [], evaluation)
              : [];
          const conditionalApprovals = [...keptConditions, ...newStepConditions];
          const withHistory: JourneyState = { ...next, learningHistory, conditionalApprovals };

          if (policy.feedbackTiming === "final-only") {
            // Adoption: 途中で正解を開示しない。履歴は累積しつつ次工程へ進める。
            return advanceOrApprove(withHistory);
          }
          // Guided / Simulation: 直近 review を評価して feedback を表示。
          // P1-3/P1-4: Simulation で critical learning blocker があれば must-fix（Next を出さない）。
          const mustFix = mustBlockOnCriticalMiss(s.mode, hasCriticalLearningBlocker(evaluation));
          return { ...withHistory, lastEvaluation: evaluation, mustFix, view: "journey-feedback" };
        },
        { persist: true },
      );
    },
    [update],
  );

  const proceedAfterFeedback = useCallback(() => {
    update((s) => {
      // P1-3: must-fix のときは次工程へ進めない（Simulation の Stage Gate）。
      if (s.mustFix) return s;
      // P1-2（Gate Decision must constrain transitions）: current step の Human Gate 決定が
      // advance を許さない（Return for Rework / Change Scope / Block）なら次工程へ進めない。
      // UI の分岐だけに依存せず domain level で illegal transition を拒否する（全 mode 共通）。
      const gate = s.reviews[s.progress.currentStepId]?.gateDecision;
      if (gate !== undefined && !gateAllowsAdvance(gate)) return s;
      return advanceOrApprove(s);
    }, { persist: true });
  }, [update]);

  const reworkTo = useCallback(
    (stepId: JourneyStepId, trigger: ReworkTrigger) => {
      update((s) => {
        // RC4 Phase 2: Return で「修正対象として指定された実 defect」を resolved へ前進させる。
        // rework target = 戻る step の submit 済み review で「実 defect を正しく指摘（caught）」した defect id。
        // - false positive（defect でない項目の指摘）は caughtItemIds に入らない → resolved にならない。
        // - 未選択の defect は caught にならない → 未解決のまま残る（部分 rework）。
        const targetedDefectIds = computeReworkTargets(s, stepId);

        // RC5 P1-C: Return が実 artifact 変化を生むか（= 進められる未解決 defect があるか）を事前判定する。
        // content 変化が無い Return を silent no-op として review 画面に戻す（古い revision 再表示）のは禁止。
        //
        // ただし「まだ defect が特定されていない初回/強制 rework」（artifact に未解決 defect が残る）は
        // 正当な差し戻し（再レビューへ戻す）なので拒否しない。拒否するのは:
        //  - allResolved  : この工程の未解決 defect がもう存在しない（全て terminal 解消済み）のに Return。
        // これにより「terminal resolved item を再選択して Return」= fake revision の生成を防ぎつつ、
        // 「見逃した defect を修正するための再レビュー往復」は妨げない。
        const currentStages = defectStagesOf(s.progress, stepId);
        const willChange = anyStageAdvances(targetedDefectIds, currentStages);
        if (!willChange) {
          // ユーザーが flag した項目のうち「この工程の defect に対応するが既に terminal（解消済み）」の数を数える。
          // computeReworkTargets は corrected 項目を caught に含めないため、resolved 再選択の検出は
          // review findings と現在の defect stage を直接突き合わせて行う（P1-C Case 2 の正確な検出）。
          const selectedResolvedCount = countSelectedResolvedFindings(s, stepId);
          if (selectedResolvedCount > 0) {
            // 既に解消済みの指摘だけを選んで Return した = fake revision を作らせない。明示拒否。
            return { ...s, reworkRejection: "allResolved", view: "journey-review" };
          }
          // 選択が空 or false-positive のみ: artifact にまだ未解決 defect が残っていれば、
          // 見逃しを直すための再レビュー往復は正当（初回/強制 rework）→ review へ戻す（no-op attempt）。
          // 未解決 defect がもう無いなら Return する意味が無い → 明示拒否。
          const stepArtifact = buildArtifactForStep(currentRunInput(s), stepId);
          if (stepArtifact.unresolvedDefectIds.length === 0) {
            return { ...s, reworkRejection: "noValidTarget", view: "journey-review" };
          }
          // それ以外は従来どおり review へ戻して再挑戦させる（revision は据え置き）。
        }

        // RC4 Final: Review note を Rework history へ trace させる（review → rework → revision explanation）。
        const reviewNote = s.reviews[stepId]?.noteText;

        const reworked = rework(s.progress, stepId, "return", trigger, targetedDefectIds, reviewNote);
        // RC4 Phase 3: 戻った step を journey-review で再表示するので materialize 記録（idempotent）。
        const progress = markMaterialized(reworked, reworked.currentStepId);
        // 戻った step の review はクリアして再レビューさせる（corrected 本文を新規に再評価）。
        const reviews = { ...s.reviews };
        const reviewDrafts = { ...s.reviewDrafts };
        const clearedFromIdx = JOURNEY_STEP_IDS.indexOf(stepId);
        for (const id of JOURNEY_STEP_IDS) {
          if (JOURNEY_STEP_IDS.indexOf(id) >= clearedFromIdx) {
            delete reviews[id];
            // G1: 再レビュー対象 step の古い下書きも破棄（artifact revision が変わるため）。
            delete reviewDrafts[id];
          }
        }
        // RC6 P1-A: 差し戻し対象 step 以降で付けた step-level 条件は再レビューで作り直すためクリアする。
        // review をクリアするのと同じ範囲（戻る step 以降）に揃える。これにより「解決したのに古い条件が残る」
        // 不整合を防ぐ（条件は再 submit で新しい評価に基づいて再生成される）。
        const conditionalApprovals = s.conditionalApprovals.filter(
          (c) => JOURNEY_STEP_IDS.indexOf(c.sourceStepId) < clearedFromIdx,
        );
        return { ...s, progress, reviews, reviewDrafts, conditionalApprovals, lastEvaluation: undefined, mustFix: false, reworkRejection: undefined, view: "journey-review" };
      }, { persist: true });
    },
    [update],
  );

  const dismissReworkRejection = useCallback(() => {
    update((s) => (s.reworkRejection === undefined ? s : { ...s, reworkRejection: undefined }));
  }, [update]);

  const decideCompletion = useCallback(
    (decision: ApprovalDecision, conditions?: readonly ConditionalApprovalInput[]) => {
      update((s) => {
        // P1-3 N1: Completion decision を実 workflow transition へ反映する。
        if (decision === "return") {
          // Return → 直近の review 工程（J6 等）へ rework。Release へは進めない。
          const target: JourneyStepId = "j6-test-evidence";
          // RC4 Phase 2: J6 の caught defect を解決対象へ（review が残っていれば）。
          const targetedDefectIds = computeReworkTargets(s, target);
          const reviewNote = s.reviews[target]?.noteText;
          const reworked = rework(s.progress, target, "return", "approval-prerequisite-changed", targetedDefectIds, reviewNote);
          // RC4 Phase 3: Completion Return で target を journey-review 表示するので materialize 記録。
          const progress = markMaterialized(reworked, reworked.currentStepId);
          const reviews = { ...s.reviews };
          const reviewDrafts = { ...s.reviewDrafts };
          for (const id of JOURNEY_STEP_IDS) {
            if (JOURNEY_STEP_IDS.indexOf(id) >= JOURNEY_STEP_IDS.indexOf(target)) {
              delete reviews[id];
              delete reviewDrafts[id];
            }
          }
          return {
            ...s,
            completionDecision: decision,
            progress,
            reviews,
            reviewDrafts,
            lastEvaluation: undefined,
            mustFix: false,
            view: "journey-review",
          };
        }
        if (decision === "block") {
          // Block → Release へ進めない。completion decision を記録して Result（blocked）へ。
          return { ...s, completionDecision: decision, journeyComplete: true, view: "journey-result" };
        }
        // Approve / Approve with Conditions → Release transition（interstitial 経由）。
        // RC5 P1-D: approve-with-conditions のときは構造化条件を first-class state へ記録する。
        const conditionalApprovals =
          decision === "approve-with-conditions"
            ? [
                ...s.conditionalApprovals,
                ...buildConditionalApprovals(s, "j7-completion-approval", conditions ?? []),
              ]
            : s.conditionalApprovals;
        const progress = advance(s.progress); // j7 -> j8
        return {
          ...s,
          completionDecision: decision,
          conditionalApprovals,
          progress,
          view: "journey-interstitial",
        };
      }, { persist: true });
    },
    [update],
  );

  const toRelease = useCallback(() => {
    update((s) => ({ ...s, view: "journey-release" }));
  }, [update]);

  const decideRelease = useCallback(
    (decision: ApprovalDecision, conflated: boolean, conditions?: readonly ConditionalApprovalInput[]) => {
      update((s) => {
        const progress = advance(s.progress);
        // RC5 P1-D: Release の approve-with-conditions も条件を記録（Result まで保持）。
        const conditionalApprovals =
          decision === "approve-with-conditions"
            ? [
                ...s.conditionalApprovals,
                ...buildConditionalApprovals(s, "j8-release-approval", conditions ?? []),
              ]
            : s.conditionalApprovals;
        return {
          ...s,
          releaseDecision: decision,
          releaseConflated: conflated,
          conditionalApprovals,
          progress,
          journeyComplete: true,
          view: "journey-result",
        };
      }, { persist: true });
    },
    [update],
  );

  const finalResult = useCallback((): JourneyFinalResult => {
    return computeJourneyResult(currentRunInput(state));
  }, [state]);

  const completionSummary = useCallback((): CompletionSummary => {
    const input = currentRunInput(state);
    const result = computeJourneyResult(input);
    const byStep = new Map<JourneyStepId, ReviewEvaluation>();
    for (const { stepId, evaluation } of evaluateAllReviews(input)) byStep.set(stepId, evaluation);
    return buildCompletionSummary(result, state.progress, byStep);
  }, [state]);

  // RC4 Integrity（STEP 4）: Completion / Release / Result 共通の判断材料。
  const decisionReadiness = useCallback((): DecisionReadinessSummary => {
    const input = currentRunInput(state);
    const result = computeJourneyResult(input);
    const byStep = new Map<JourneyStepId, ReviewEvaluation>();
    for (const { stepId, evaluation } of evaluateAllReviews(input)) byStep.set(stepId, evaluation);
    // Ground Truth severity の引き当て（missed item → defect.expectedSeverity）。
    const defects = buildDefectSet(state.profile.context.structured, state.profile.profileDefectRules);
    const severityOfMissedItem = (stepId: JourneyStepId, itemId: string): Severity | undefined =>
      defects.find((d) => d.itemId === itemId && d.journeyStepId === stepId)?.expectedSeverity;
    return buildDecisionReadinessSummary({
      result,
      progress: state.progress,
      reviewEvaluationsByStep: byStep,
      severityOfMissedItem,
      completionDecision: state.completionDecision,
      conditionalApprovals: state.conditionalApprovals,
      // RC6 Parameter Sensitivity: 承認体制・リリース影響・可逆性を判断材料へ反映。
      approvalRegime: state.profile.context.structured.approvalRequirement,
      releaseImpactLevel: state.profile.context.structured.releaseImpact,
      reversibilityLevel: state.profile.context.structured.reversibility,
    });
  }, [state]);

  // RC5 P1-D: 未解決の承認条件（下流・Completion・Release・Result で共通参照）。
  const openConditions = useCallback((): readonly ConditionalApproval[] => {
    return computeOpenConditions(state.conditionalApprovals);
  }, [state]);

  const causalSummary = useCallback((): readonly CausalLearningEntry[] => {
    return buildCausalLearningSummary(computeJourneyResult(currentRunInput(state)));
  }, [state]);

  // RC4 Final（STEP I）: Result 上部サマリ。
  const resultHighlights = useCallback((): ResultHighlights => {
    const result = computeJourneyResult(currentRunInput(state));
    const causal = buildCausalLearningSummary(result);
    return buildResultHighlights(result, causal, state.completionDecision, state.releaseDecision);
  }, [state]);

  // RC5 P1-A: delivery outcome と learner evaluation を分離した Result view model。
  const outcomeSummary = useCallback((): JourneyOutcomeSummary => {
    const result = computeJourneyResult(currentRunInput(state));
    // 残存リスクの origin step 集合（決定的順序 = consequences 由来）。
    const originSet = new Set<JourneyStepId>();
    const originStepIds: JourneyStepId[] = [];
    for (const c of result.consequences) {
      if (!originSet.has(c.sourceStepId)) {
        originSet.add(c.sourceStepId);
        originStepIds.push(c.sourceStepId);
      }
    }
    return buildJourneyOutcomeSummary({
      result,
      completionDecision: state.completionDecision,
      releaseDecision: state.releaseDecision,
      releaseConflated: state.releaseConflated,
      journeyComplete: state.journeyComplete,
      riskOriginStepIds: originStepIds,
    });
  }, [state]);

  // P1-1 H2/H4: 直近 review の human-readable feedback view model。
  const feedbackViewModel = useCallback((): FeedbackViewModel | undefined => {
    const ev = state.lastEvaluation;
    if (ev === undefined) return undefined;
    const defects = buildDefectSet(state.profile.context.structured, state.profile.profileDefectRules);
    const artifact = buildArtifactForStep(currentRunInput(state), state.progress.currentStepId);
    return buildFeedbackViewModel(artifact, defects, ev);
  }, [state]);

  // RC4 Final（STEP H）: Adoption 向け derived output。
  const adoptionOutput = useCallback((): AdoptionOutput => {
    return buildAdoptionOutput(computeJourneyResult(currentRunInput(state)), state.progress);
  }, [state]);

  // P2-4 N5: rework 回数の single source of truth。
  const reworkCount = useCallback((): number => state.progress.reworkHistory.length, [state]);

  // P1-4: Home へ戻る。Journey は破棄せず保持（Resume で復帰可能）。domain state を変えない。
  const goHome = useCallback(() => {
    update((s) => ({ ...s, view: "journey-home" }));
  }, [update]);

  const exit = goHome;

  // P1-2: 保存済み journey を復元して復帰する。
  const resume = useCallback(() => {
    update((s) => {
      try {
        const loaded = app.store.load(s.locale);
        const pj = loaded.progress.journey;
        if (pj === null) return s;
        const restored = restoreJourney(pj);
        if (restored === null) return s;
        return {
          ...s,
          mode: restored.mode,
          profile: restored.profile,
          progress: restored.progress,
          reviews: restored.reviews,
          completionDecision: restored.completionDecision,
          releaseDecision: restored.releaseDecision,
          releaseConflated: restored.releaseConflated,
          // F1: Setup 下書きも復元。
          draftUserAuthored: restored.draftUserAuthored,
          draftStructured: restored.draftStructured,
          // F3/F4: 学習履歴を復元。
          learningHistory: restored.learningHistory,
          // RC5 P1-D: Conditional Approval を復元。
          conditionalApprovals: restored.conditionalApprovals,
          journeyComplete: restored.journeyComplete,
          // G1: 未 submit の Review 下書きを復元。
          reviewDrafts: restored.reviewDrafts,
          lastEvaluation: undefined,
          mustFix: false,
          resumable: true,
          view: resumeViewFor(restored),
        };
      } catch {
        return s;
      }
    });
  }, [update, app]);

  // P1-4: 論理的な前画面へ戻る（presentation only。revision / completed / rework history を変えない）。
  const goBack = useCallback(() => {
    update((s) => {
      switch (s.view) {
        case "journey-feedback":
          // feedback → 直前の review 入力へ戻る（domain progress は不変）。
          return { ...s, view: "journey-review", lastEvaluation: undefined, mustFix: false };
        case "journey-setup":
        case "journey-review":
        case "journey-completion":
        case "journey-interstitial":
        case "journey-release":
        case "journey-result":
          // これらは Home へ丸める（Journey は保持）。
          return { ...s, view: "journey-home" };
        default:
          return { ...s, view: "journey-home" };
      }
    });
  }, [update]);

  const backKind: "back" | "home" | "none" = useMemo(() => {
    switch (state.view) {
      case "journey-home":
        return "none";
      case "journey-feedback":
        return "back";
      default:
        return "home";
    }
  }, [state.view]);

  const policy = useMemo(() => journeyModePolicyFor(state.mode), [state.mode]);

  return useMemo(
    () => ({
      state,
      policy,
      startGuided,
      startSimulation,
      startAdoption,
      setDraftUserAuthored,
      setDraftStructured,
      beginJourney,
      currentArtifact,
      localReworkDiff,
      propagationDiff,
      setReviewDraft,
      submitReview,
      proceedAfterFeedback,
      reworkTo,
      dismissReworkRejection,
      decideCompletion,
      toRelease,
      decideRelease,
      finalResult,
      completionSummary,
      decisionReadiness,
      openConditions,
      causalSummary,
      resultHighlights,
      outcomeSummary,
      feedbackViewModel,
      adoptionOutput,
      reworkCount,
      goHome,
      resume,
      goBack,
      backKind,
      exit,
    }),
    [
      state,
      policy,
      startGuided,
      startSimulation,
      startAdoption,
      setDraftUserAuthored,
      setDraftStructured,
      beginJourney,
      currentArtifact,
      localReworkDiff,
      propagationDiff,
      setReviewDraft,
      submitReview,
      proceedAfterFeedback,
      reworkTo,
      dismissReworkRejection,
      decideCompletion,
      toRelease,
      decideRelease,
      finalResult,
      completionSummary,
      decisionReadiness,
      openConditions,
      causalSummary,
      resultHighlights,
      outcomeSummary,
      feedbackViewModel,
      adoptionOutput,
      reworkCount,
      goHome,
      resume,
      goBack,
      backKind,
      exit,
    ],
  );
}

/**
 * 学習履歴に今回の miss / false positive を finding-level で累積する（F4）。
 * 同一 stable key は 1 度だけ列挙（dedup）。aggregate count は実発生回数を加算。
 */
function mergeLearningHistory(prev: LearningHistory, vm: FeedbackViewModel): LearningHistory {
  const byKey = new Map<string, LearningHistoryEntry>();
  for (const e of prev.entries) byKey.set(historyEntryKey(e), e);

  const addEntry = (
    vmItem: FeedbackViewModel["missed"][number],
    mistakeType: LearningHistoryEntry["mistakeType"],
  ): void => {
    const entry: LearningHistoryEntry = {
      itemTitleKey: vmItem.itemTitleKey,
      itemBodyKey: vmItem.itemBodyKey,
      mistakeType,
      ...(vmItem.severity !== undefined ? { severity: vmItem.severity } : {}),
      ...(vmItem.whyItMattersKey !== undefined ? { whyItMattersKey: vmItem.whyItMattersKey } : {}),
      ...(vmItem.originStepId !== undefined ? { originStepId: vmItem.originStepId } : {}),
      ...(vmItem.affectedLaterStepId !== undefined ? { affectedLaterStepId: vmItem.affectedLaterStepId } : {}),
      ...(vmItem.consequenceKey !== undefined ? { consequenceKey: vmItem.consequenceKey } : {}),
      ...(vmItem.revisitStepId !== undefined ? { revisitStepId: vmItem.revisitStepId } : {}),
    };
    byKey.set(historyEntryKey(entry), entry);
  };

  for (const m of vm.missed) addEntry(m, "missed");
  for (const f of vm.falsePositives) addEntry(f, "false-positive");

  // 決定的順序（entries は mistakeType→title で安定ソート）。
  const entries = [...byKey.values()].sort((a, b) => {
    if (a.mistakeType !== b.mistakeType) return a.mistakeType < b.mistakeType ? -1 : 1;
    return a.itemTitleKey < b.itemTitleKey ? -1 : a.itemTitleKey > b.itemTitleKey ? 1 : 0;
  });

  return {
    entries,
    totalMissed: prev.totalMissed + vm.missed.length,
    totalFalse: prev.totalFalse + vm.falsePositives.length,
  };
}

/**
 * review 提出後、次の状態へ進める（決定的）。
 * - j1..j6: advance して次 review。ただし j7 に到達したら completion view。
 * - critical fix（Simulation）は submitReview の feedback 段で扱うためここでは純粋に advance。
 */
function advanceOrApprove(s: JourneyState): JourneyState {
  const progress = advance(s.progress);
  const nextStep = progress.currentStepId;
  if (nextStep === "j7-completion-approval") {
    // G2: completion step へ（再）到達したので stale な completion decision をクリアする。
    // 直前の Return → rework → 再到達で "return" が残っていると resume が review へ誤誘導するため。
    return {
      ...s,
      progress,
      completionDecision: undefined,
      lastEvaluation: undefined,
      mustFix: false,
      view: "journey-completion",
    };
  }
  if (isJourneyComplete(progress)) {
    return { ...s, progress, lastEvaluation: undefined, mustFix: false, view: "journey-result" };
  }
  // RC4 Phase 3: 次 step を journey-review で表示するので materialize 記録（idempotent・legacy は undefined 維持）。
  const shown = markMaterialized(progress, nextStep);
  return { ...s, progress: shown, lastEvaluation: undefined, mustFix: false, view: "journey-review" };
}

/** Consequence の件数（result 表示補助）。 */
export function journeyConsequenceCount(result: JourneyFinalResult): number {
  return result.consequences.length;
}

// re-export for view convenience
export { defectsForStep, computeConsequences, revisionOf };
