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
  rework,
  revisionOf,
  type JourneyProgress,
  type ReworkTrigger,
} from "../domain/journey/rework-state-machine.ts";
import {
  journeyModePolicyFor,
  mustBlockOnCriticalMiss,
  type JourneyModePolicy,
} from "../domain/journey/mode-policy.ts";
import { computeConsequences } from "../domain/journey/consequence-engine.ts";
import {
  buildCompletionSummary,
  buildCausalLearningSummary,
  type CompletionSummary,
  type CausalLearningEntry,
} from "../domain/journey/journey-summaries.ts";
import { evaluateAllReviews } from "../domain/journey/journey-engine.ts";
import { buildFeedbackViewModel, type FeedbackViewModel } from "../domain/journey/feedback-viewmodel.ts";
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
  /** 未 submit の Review 下書きを保存する（G1）。 */
  setReviewDraft(draft: ReviewDraft): void;
  submitReview(review: ArtifactReview): void;
  proceedAfterFeedback(): void;
  reworkTo(stepId: JourneyStepId, trigger: ReworkTrigger): void;
  decideCompletion(decision: ApprovalDecision): void;
  toRelease(): void;
  decideRelease(decision: ApprovalDecision, conflated: boolean): void;
  finalResult(): JourneyFinalResult;
  /** Completion 判断材料（P2-4）。 */
  completionSummary(): CompletionSummary;
  /** Result の因果学習サマリ（P2-5）。 */
  causalSummary(): readonly CausalLearningEntry[];
  /** 直近 review の human-readable feedback view model（P1-1 H2/H4）。 */
  feedbackViewModel(): FeedbackViewModel | undefined;
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
function computeReworkTargets(state: JourneyState, stepId: JourneyStepId): readonly string[] {
  const review = state.reviews[stepId];
  if (review === undefined) return [];
  const defects = buildDefectSet(state.profile.context.structured, state.profile.profileDefectRules);
  const artifact = buildArtifactForStep(currentRunInput(state), stepId);
  // review の artifactId が現在の artifact と一致しないと evaluateArtifactReview は reject するため、
  // identity 不一致（revision ずれ）のときは安全に no-op。
  if (review.artifactId !== artifact.artifactId) return [];
  const evaluation = evaluateArtifactReview(artifact, defects, review);
  const stepDefects = defectsForStep(defects, stepId);
  const byItemId = new Map(stepDefects.map((d) => [d.itemId, d.defectId]));
  const targets: string[] = [];
  for (const itemId of evaluation.caughtItemIds) {
    const defectId = byItemId.get(itemId);
    if (defectId !== undefined) targets.push(defectId);
  }
  return targets;
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
    })),
    // RC4 Phase 2: 解決済み defect（step → id[]）を保存。reload/Resume で corrected を維持。
    resolvedDefectIds: serializeResolvedDefectIds(s.progress.resolvedDefectIds),
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

  // reviews を復元（gate / severity を型検証）。
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
    reviews[stepId] = {
      artifactId: `art__${profile.profileId}__${stepId}__r${persisted.revisions[stepId] ?? 0}`,
      journeyStepId: stepId,
      findings,
      gateDecision: gate,
      ...(r.noteText !== undefined ? { noteText: r.noteText } : {}),
    };
  }

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
    })),
    completedStepIds,
    // RC4 Phase 2: 解決済み defect を復元（missing/不正 = 空 = RC3 挙動）。
    resolvedDefectIds: restoreResolvedDefectIds(persisted.resolvedDefectIds),
  };

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
  };
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
    update((s) => ({
      ...s,
      mode: "guided",
      profile: CANONICAL_SAMPLE_PROFILE,
      progress: initialProgress(),
      reviews: {},
      completionDecision: undefined,
      releaseDecision: undefined,
      releaseConflated: false,
      mustFix: false,
      resumable: true,
      learningHistory: emptyLearningHistory(),
      journeyComplete: false,
      reviewDrafts: {},
      view: "journey-review",
    }), { persist: true });
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
      return {
        ...s,
        profile,
        progress: initialProgress(),
        reviews: {},
        resumable: true,
        learningHistory: emptyLearningHistory(),
        journeyComplete: false,
        reviewDrafts: {},
        view: "journey-review",
      };
    }, { persist: true });
  }, [update]);

  const currentArtifact = useCallback((): GeneratedArtifact => {
    return buildArtifactForStep(currentRunInput(state), state.progress.currentStepId);
  }, [state]);

  const submitReview = useCallback(
    (review: ArtifactReview) => {
      update(
        (s) => {
          const reviews = { ...s.reviews, [s.progress.currentStepId]: review };
          // G1: submit したので当該 step の下書きは破棄（確定 review が source of truth）。
          const reviewDrafts = { ...s.reviewDrafts };
          delete reviewDrafts[s.progress.currentStepId];
          const policy = journeyModePolicyFor(s.mode);
          const next: JourneyState = { ...s, reviews, reviewDrafts };

          // 全モードで評価し、学習履歴（miss/FP）を累積する（P1-5 N3）。
          // current review は正解へ直せるが、履歴は消さない。
          const defects = buildDefectSet(s.profile.context.structured, s.profile.profileDefectRules);
          const artifact = buildArtifactForStep(currentRunInput(next), s.progress.currentStepId);
          const evaluation = evaluateArtifactReview(artifact, defects, review);
          const vm = buildFeedbackViewModel(artifact, defects, evaluation);
          const learningHistory = mergeLearningHistory(s.learningHistory, vm);
          const withHistory: JourneyState = { ...next, learningHistory };

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

        const progress = rework(s.progress, stepId, "return", trigger, targetedDefectIds);
        // 戻った step の review はクリアして再レビューさせる（corrected 本文を新規に再評価）。
        const reviews = { ...s.reviews };
        const reviewDrafts = { ...s.reviewDrafts };
        for (const id of JOURNEY_STEP_IDS) {
          if (JOURNEY_STEP_IDS.indexOf(id) >= JOURNEY_STEP_IDS.indexOf(stepId)) {
            delete reviews[id];
            // G1: 再レビュー対象 step の古い下書きも破棄（artifact revision が変わるため）。
            delete reviewDrafts[id];
          }
        }
        return { ...s, progress, reviews, reviewDrafts, lastEvaluation: undefined, mustFix: false, view: "journey-review" };
      }, { persist: true });
    },
    [update],
  );

  const decideCompletion = useCallback(
    (decision: ApprovalDecision) => {
      update((s) => {
        // P1-3 N1: Completion decision を実 workflow transition へ反映する。
        if (decision === "return") {
          // Return → 直近の review 工程（J6 等）へ rework。Release へは進めない。
          const target: JourneyStepId = "j6-test-evidence";
          // RC4 Phase 2: J6 の caught defect を解決対象へ（review が残っていれば）。
          const targetedDefectIds = computeReworkTargets(s, target);
          const progress = rework(s.progress, target, "return", "approval-prerequisite-changed", targetedDefectIds);
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
        const progress = advance(s.progress); // j7 -> j8
        return { ...s, completionDecision: decision, progress, view: "journey-interstitial" };
      }, { persist: true });
    },
    [update],
  );

  const toRelease = useCallback(() => {
    update((s) => ({ ...s, view: "journey-release" }));
  }, [update]);

  const decideRelease = useCallback(
    (decision: ApprovalDecision, conflated: boolean) => {
      update((s) => {
        const progress = advance(s.progress);
        return {
          ...s,
          releaseDecision: decision,
          releaseConflated: conflated,
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

  const causalSummary = useCallback((): readonly CausalLearningEntry[] => {
    return buildCausalLearningSummary(computeJourneyResult(currentRunInput(state)));
  }, [state]);

  // P1-1 H2/H4: 直近 review の human-readable feedback view model。
  const feedbackViewModel = useCallback((): FeedbackViewModel | undefined => {
    const ev = state.lastEvaluation;
    if (ev === undefined) return undefined;
    const defects = buildDefectSet(state.profile.context.structured, state.profile.profileDefectRules);
    const artifact = buildArtifactForStep(currentRunInput(state), state.progress.currentStepId);
    return buildFeedbackViewModel(artifact, defects, ev);
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
      setReviewDraft,
      submitReview,
      proceedAfterFeedback,
      reworkTo,
      decideCompletion,
      toRelease,
      decideRelease,
      finalResult,
      completionSummary,
      causalSummary,
      feedbackViewModel,
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
      setReviewDraft,
      submitReview,
      proceedAfterFeedback,
      reworkTo,
      decideCompletion,
      toRelease,
      decideRelease,
      finalResult,
      completionSummary,
      causalSummary,
      feedbackViewModel,
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
  return { ...s, progress, lastEvaluation: undefined, mustFix: false, view: "journey-review" };
}

/** Consequence の件数（result 表示補助）。 */
export function journeyConsequenceCount(result: JourneyFinalResult): number {
  return result.consequences.length;
}

// re-export for view convenience
export { defectsForStep, computeConsequences, revisionOf };
