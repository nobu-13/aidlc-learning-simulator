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
import { evaluateArtifactReview, type ReviewEvaluation } from "../domain/journey/review-evaluator.ts";
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
import { journeyModePolicyFor, type JourneyModePolicy } from "../domain/journey/mode-policy.ts";
import { computeConsequences } from "../domain/journey/consequence-engine.ts";
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

export function useJourneyState(app: Application): JourneyApi {
  const [state, setState] = useState<JourneyState>(() => ({
    view: "journey-home",
    locale: app.locale,
    mode: "guided",
    profile: CANONICAL_SAMPLE_PROFILE,
    progress: initialProgress(),
    reviews: {},
    releaseConflated: false,
    draftUserAuthored: {},
    draftStructured: defaultStructuredInput(),
  }));

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
      return { ...s, profile, progress: initialProgress(), reviews: {}, view: "journey-review" };
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
          return { ...next, lastEvaluation: evaluation, view: "journey-feedback" };
        },
        { persist: true },
      );
    },
    [update],
  );

  const proceedAfterFeedback = useCallback(() => {
    update((s) => advanceOrApprove(s), { persist: true });
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
        return { ...s, progress, reviews, lastEvaluation: undefined, view: "journey-review" };
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

  const exit = useCallback(() => {
    update((s) => ({ ...s, view: "journey-home" }));
  }, [update]);

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
    return { ...s, progress, lastEvaluation: undefined, view: "journey-completion" };
  }
  if (isJourneyComplete(progress)) {
    return { ...s, progress, lastEvaluation: undefined, view: "journey-result" };
  }
  return { ...s, progress, lastEvaluation: undefined, view: "journey-review" };
}

/** Consequence の件数（result 表示補助）。 */
export function journeyConsequenceCount(result: JourneyFinalResult): number {
  return result.consequences.length;
}

// re-export for view convenience
export { defectsForStep, computeConsequences, revisionOf };
