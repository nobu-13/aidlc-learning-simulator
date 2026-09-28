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
  StructuredControlInput,
} from "../domain/journey/journey-entities.ts";
import { JOURNEY_STEP_IDS } from "../domain/journey/journey-entities.ts";
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
   * Simulation の critical miss で強制 rework が必要な状態（P1-3）。
   * feedback view でこれが true のとき、Next を出さず Return for rework を促す。
   */
  readonly mustFix: boolean;
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
    })),
    reviews,
    ...(s.completionDecision !== undefined ? { completionDecision: s.completionDecision } : {}),
    ...(s.releaseDecision !== undefined ? { releaseDecision: s.releaseDecision } : {}),
    releaseConflated: s.releaseConflated,
  };
}

/** PersistedJourney → 復元用の JourneyState 断片（P1-2）。不正なら null（controlled fallback）。 */
interface RestoredJourney {
  readonly mode: ExperienceMode;
  readonly profile: JourneyProfile;
  readonly progress: JourneyProgress;
  readonly reviews: Readonly<Partial<Record<JourneyStepId, ArtifactReview>>>;
  readonly completionDecision?: ApprovalDecision | undefined;
  readonly releaseDecision?: ApprovalDecision | undefined;
  readonly releaseConflated: boolean;
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
  const profile =
    mode === "guided"
      ? CANONICAL_SAMPLE_PROFILE
      : buildUserProfile("user", persisted.userAuthored, structured as unknown as StructuredControlInput);

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
    })),
    completedStepIds,
  };

  return {
    mode,
    profile,
    progress,
    reviews,
    ...(isApproval(persisted.completionDecision) ? { completionDecision: persisted.completionDecision } : {}),
    ...(isApproval(persisted.releaseDecision) ? { releaseDecision: persisted.releaseDecision } : {}),
    releaseConflated: persisted.releaseConflated === true,
  };
}

/** 復元した JourneyState 断片からどの view で再開するかを決める。 */
function resumeViewFor(r: RestoredJourney): JourneyView {
  if (r.releaseDecision !== undefined) return "journey-result";
  if (r.completionDecision !== undefined) return "journey-release";
  if (r.progress.currentStepId === "j7-completion-approval") return "journey-completion";
  if (r.progress.currentStepId === "j8-release-approval") return "journey-release";
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
    };
    // 起動時に保存済み journey を検出して Resume 可能にする（P1-2）。domain へ壊れた state を渡さない。
    try {
      const loaded = app.store.load(app.locale);
      const pj = loaded.progress.journey;
      if (pj !== null) {
        const restored = restoreJourney(pj);
        if (restored !== null) {
          return { ...defaults, locale: loaded.progress.locale, resumable: true };
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
        draftStructured: defaultStructuredInput(),
        draftUserAuthored: {},
        view: "journey-setup",
      }));
    },
    [update],
  );

  const startSimulation = useCallback(() => startFromUser("simulation"), [startFromUser]);
  const startAdoption = useCallback(() => startFromUser("adoption-review"), [startFromUser]);

  const setDraftUserAuthored = useCallback(
    (field: string, text: string) => {
      update((s) => ({ ...s, draftUserAuthored: { ...s.draftUserAuthored, [field]: text } }));
    },
    [update],
  );

  const setDraftStructured = useCallback(
    (field: keyof StructuredControlInput, value: string) => {
      update((s) => ({
        ...s,
        draftStructured: { ...s.draftStructured, [field]: value } as StructuredControlInput,
      }));
    },
    [update],
  );

  const beginJourney = useCallback(() => {
    update((s) => {
      const profile = buildUserProfile("user", s.draftUserAuthored, s.draftStructured);
      return { ...s, profile, progress: initialProgress(), reviews: {}, resumable: true, view: "journey-review" };
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
          const policy = journeyModePolicyFor(s.mode);
          const next: JourneyState = { ...s, reviews };
          if (policy.feedbackTiming === "final-only") {
            // Adoption: 途中で正解を開示しない。そのまま次工程へ進める。
            return advanceOrApprove({ ...next });
          }
          // Guided / Simulation: 直近 review を評価して feedback を表示。
          const defects = buildDefectSet(s.profile.context.structured, s.profile.profileDefectRules);
          const artifact = buildArtifactForStep(currentRunInput(next), s.progress.currentStepId);
          const evaluation = evaluateArtifactReview(artifact, defects, review);
          // P1-3: Simulation で critical learning blocker があれば must-fix（Next を出さない）。
          const mustFix = mustBlockOnCriticalMiss(s.mode, hasCriticalLearningBlocker(evaluation));
          return { ...next, lastEvaluation: evaluation, mustFix, view: "journey-feedback" };
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
        const progress = rework(s.progress, stepId, "return", trigger);
        // 戻った step の review はクリアして再レビューさせる。
        const reviews = { ...s.reviews };
        for (const id of JOURNEY_STEP_IDS) {
          if (JOURNEY_STEP_IDS.indexOf(id) >= JOURNEY_STEP_IDS.indexOf(stepId)) delete reviews[id];
        }
        return { ...s, progress, reviews, lastEvaluation: undefined, mustFix: false, view: "journey-review" };
      }, { persist: true });
    },
    [update],
  );

  const decideCompletion = useCallback(
    (decision: ApprovalDecision) => {
      update((s) => {
        const progress = advance(s.progress); // j7 completed -> j8
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
        return { ...s, releaseDecision: decision, releaseConflated: conflated, progress, view: "journey-result" };
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
      submitReview,
      proceedAfterFeedback,
      reworkTo,
      decideCompletion,
      toRelease,
      decideRelease,
      finalResult,
      completionSummary,
      causalSummary,
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
      submitReview,
      proceedAfterFeedback,
      reworkTo,
      decideCompletion,
      toRelease,
      decideRelease,
      finalResult,
      completionSummary,
      causalSummary,
      goHome,
      resume,
      goBack,
      backKind,
      exit,
    ],
  );
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
    return { ...s, progress, lastEvaluation: undefined, mustFix: false, view: "journey-completion" };
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
