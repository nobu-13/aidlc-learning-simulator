// JourneyModePolicy — RC3 の 3 Mode を実体的に差別化する policy（Design §Mode Policy / Human Decision 6）。
//
// RC2 の experience-policy.ts は UI が boolean をほぼ参照しておらず差別化が弱かった。RC3 では UI が
// 実際に参照する policy を明示する。評価 Ground Truth は mode で不変（BR5.2 踏襲）— policy は
// 「いつ・何を提示するか」だけを決める。pure・決定的。
import type { ExperienceMode } from "../entities.ts";

/** feedback をいつ出すか（Simulation = 各 Stage / Adoption = 最後のみ）。 */
export type FeedbackTiming = "immediate" | "stage-gate" | "final-only";

export interface JourneyModePolicy {
  readonly mode: ExperienceMode;
  /** Sample Project を使うか（Guided）/ User 入力から始めるか（Simulation/Adoption）。 */
  readonly usesSampleProject: boolean;
  /** hint 提示レベル。 */
  readonly hints: "high" | "low" | "none";
  /** provenance 提示レベル。 */
  readonly provenance: "high" | "normal";
  /** feedback / correctness 開示のタイミング。 */
  readonly feedbackTiming: FeedbackTiming;
  /** journey 途中で「正解 / 見逃し」を開示するか（Adoption は false）。 */
  readonly discloseCorrectnessDuringJourney: boolean;
  /** 見逃した重大 finding を次に進む前に必ず修正させるか（Simulation）。 */
  readonly requireCriticalFix: boolean;
  /** 見逃しを後続 Artifact へ実際に伝播させるか（Adoption）。 */
  readonly propagateConsequences: boolean;
  /** would-have consequence preview（Simulation の gate 前）。 */
  readonly showWouldHaveConsequence: boolean;
  /** consequence を説明として提示するか（Guided）。 */
  readonly explainConsequence: boolean;
  /** assisted rework（Guided: 差し戻し方を案内）。 */
  readonly assistedRework: boolean;
  /** better review example の提示（Guided）。 */
  readonly showBetterReviewExample: boolean;
}

const POLICIES: Record<ExperienceMode, JourneyModePolicy> = {
  // Guided = Learn
  guided: {
    mode: "guided",
    usesSampleProject: true,
    hints: "high",
    provenance: "high",
    feedbackTiming: "immediate",
    discloseCorrectnessDuringJourney: true,
    requireCriticalFix: false,
    propagateConsequences: false,
    showWouldHaveConsequence: false,
    explainConsequence: true,
    assistedRework: true,
    showBetterReviewExample: true,
  },
  // Simulation = Practice
  simulation: {
    mode: "simulation",
    usesSampleProject: false,
    hints: "low",
    provenance: "normal",
    feedbackTiming: "stage-gate",
    discloseCorrectnessDuringJourney: true,
    requireCriticalFix: true,
    propagateConsequences: false,
    showWouldHaveConsequence: true,
    explainConsequence: false,
    assistedRework: false,
    showBetterReviewExample: false,
  },
  // Adoption Review = Apply
  "adoption-review": {
    mode: "adoption-review",
    usesSampleProject: false,
    hints: "none",
    provenance: "normal",
    feedbackTiming: "final-only",
    discloseCorrectnessDuringJourney: false,
    requireCriticalFix: false,
    propagateConsequences: true,
    showWouldHaveConsequence: false,
    explainConsequence: false,
    assistedRework: false,
    showBetterReviewExample: false,
  },
};

export function journeyModePolicyFor(mode: ExperienceMode): JourneyModePolicy {
  return POLICIES[mode];
}

/**
 * critical learning blocker があるとき、その mode で「次工程へ進む前に必ず修正させる」か（P1-3）。
 * - Simulation（requireCriticalFix=true）のみ強制ブロック。
 * - Guided は assisted learning、Adoption は final-only evaluation なので強制しない（mode policy 維持）。
 */
export function mustBlockOnCriticalMiss(mode: ExperienceMode, hasCriticalBlocker: boolean): boolean {
  if (!hasCriticalBlocker) return false;
  return journeyModePolicyFor(mode).requireCriticalFix;
}
