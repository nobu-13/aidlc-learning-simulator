// RC5 P1-A: Journey Outcome（delivery/journey の帰結）と Learner Evaluation（学習者の判断品質）を
// 明確に分離する domain model。
//
// 監査所見（P1-A）: Completion Block が正しい判断でも、Result が
// 「Good: no significant weaknesses remain」等の肯定的 terminal verdict になっていた。
// 根本原因: overall verdict が negative dimension 数だけで決まり、delivery outcome
// （blocked / released 等）を一切参照していなかった。
//
// このモジュールは 2 つの直交する概念を pure・決定的に導く:
//  - JourneyOutcome: この Journey の「配送/工程」の帰結（承認されたか・止まったか・差し戻されたか）。
//    学習者の巧拙とは独立。Block が正しくても outcome は "blocked"。
//  - LearnerEvaluation: 学習者の判断品質（strong / mixed / needs-practice）。
//    delivery が blocked でも、リスクを見て止めた判断が適切なら "strong" になりうる。
//
// runtime AI 不要。time/random/locale 非参照。表示文言は locale key で参照する。
import type { ApprovalDecision, JourneyStepId } from "./journey-entities.ts";
import type { JourneyFinalResult } from "./journey-engine.ts";

// ---------- Journey Outcome（delivery/journey の帰結） ----------

/**
 * Journey（工程/配送）の帰結。学習者評価とは独立。
 *  - blocked                : Completion または Release で Block された（配送は止まった）。
 *  - returned               : Completion で Return（差し戻し）され、まだ承認へ到達していない終端。
 *  - conditionally-completed: Completion を条件付き承認したが Release 未到達（条件が残る）。
 *  - completed              : Completion approve だが Release 未到達（工程完了・未リリース）。
 *  - release-approved       : Release を無条件承認した（最終ゲート通過）。
 *  - release-conditional    : Release を条件付き承認した（条件が残ったままリリース）。
 *  - release-rejected       : Release で Block/Return された（リリース却下）。
 *  - in-progress            : まだ Completion に到達していない（終端でない）。
 */
export type JourneyOutcome =
  | "blocked"
  | "returned"
  | "conditionally-completed"
  | "completed"
  | "release-approved"
  | "release-conditional"
  | "release-rejected"
  | "in-progress";

/** JourneyOutcome を導く入力（決定的）。 */
export interface JourneyOutcomeInput {
  readonly completionDecision?: ApprovalDecision | undefined;
  readonly releaseDecision?: ApprovalDecision | undefined;
  /** Journey が終端に達したか（use-journey-state.journeyComplete）。 */
  readonly journeyComplete: boolean;
}

/**
 * JourneyOutcome を決定的に導く。
 * Release decision があればそれが最終帰結。無ければ Completion decision で判定。
 */
export function deriveJourneyOutcome(input: JourneyOutcomeInput): JourneyOutcome {
  const { completionDecision, releaseDecision } = input;

  // Release まで到達している場合は Release decision が最終帰結。
  if (releaseDecision !== undefined) {
    switch (releaseDecision) {
      case "approve":
        return "release-approved";
      case "approve-with-conditions":
        return "release-conditional";
      case "return":
      case "block":
        return "release-rejected";
    }
  }

  // Release 未到達: Completion decision で判定。
  if (completionDecision !== undefined) {
    switch (completionDecision) {
      case "block":
        return "blocked";
      case "return":
        return "returned";
      case "approve-with-conditions":
        return "conditionally-completed";
      case "approve":
        return "completed";
    }
  }

  return "in-progress";
}

/** その Outcome が「delivery が前進/リリースへ進んだ」ことを意味するか（肯定文言可否の判定用ではない）。 */
export function outcomeReleaseReached(outcome: JourneyOutcome): boolean {
  return (
    outcome === "release-approved" ||
    outcome === "release-conditional" ||
    outcome === "release-rejected"
  );
}

/** その Outcome が「delivery が止まった/差し戻された」ことを意味するか。 */
export function outcomeIsHalted(outcome: JourneyOutcome): boolean {
  return outcome === "blocked" || outcome === "returned" || outcome === "release-rejected";
}

/** Outcome の見出し locale key（delivery/journey の帰結のみ・学習者評価を混ぜない）。 */
export function outcomeHeadlineKey(outcome: JourneyOutcome): string {
  return `rc5.outcome.${outcome}`;
}

// ---------- Learner Evaluation（学習者の判断品質） ----------

/**
 * 学習者の判断品質。delivery outcome とは独立。
 *  - strong        : 見逃しが無く、残存リスクを見逃さず、危険な承認をしていない。
 *  - mixed         : いくつかの弱点はあるが致命的でない。
 *  - needs-practice: 重大な見逃しや、リスクを認識せず承認した等、練習が必要。
 */
export type LearnerEvaluation = "strong" | "mixed" | "needs-practice";

/** LearnerEvaluation を導く入力。 */
export interface LearnerEvaluationInput {
  readonly result: JourneyFinalResult;
  readonly completionDecision?: ApprovalDecision | undefined;
  readonly releaseDecision?: ApprovalDecision | undefined;
  /** Completion 通過を理由に無条件 release した（conflation）か。 */
  readonly releaseConflated: boolean;
}

const APPROVING: ReadonlySet<ApprovalDecision> = new Set<ApprovalDecision>([
  "approve",
  "approve-with-conditions",
]);

/**
 * 学習者の判断品質を決定的に導く。
 *
 * 危険な承認（dangerous approval）の定義:
 *  - 残存リスク（consequences>0 または見逃し>0）があるのに Completion/Release を approve 系にした。
 *  - Completion=Release と混同して無条件 release した（conflation）。
 *
 * 判定:
 *  - needs-practice: 危険な承認をした、または high 相当の見逃し（後工程顕在化 consequence）が残った。
 *  - mixed        : 見逃し/false positive はあるが危険な承認はしていない。
 *  - strong       : 見逃しゼロ かつ 危険な承認なし（リスクを見て止めた/差し戻したも含む）。
 *
 * 重要: Block/Return は「危険な承認」ではない。リスクを見て止めた/差し戻した判断は、
 * 見逃しが無ければ strong になりうる（P1-A の要件: 正しい Block は learner=strong）。
 */
export function deriveLearnerEvaluation(input: LearnerEvaluationInput): LearnerEvaluation {
  const { result, completionDecision, releaseDecision, releaseConflated } = input;

  // RC6 P1-A: 未解決の Conditional Approval も残存リスクとして扱う。
  // 「条件付きで通した（条件は下流に残る）」を「問題なし」に退化させない。
  const hasOpenConditions = result.openConditions.length > 0;
  const hasOpenHighCondition = result.openConditions.some((c) => c.highestSeverity === "high");

  const hasRemainingRisk =
    result.consequences.length > 0 || result.totalMissed > 0 || hasOpenConditions;
  const approvedCompletion =
    completionDecision !== undefined && APPROVING.has(completionDecision);
  const approvedRelease = releaseDecision !== undefined && APPROVING.has(releaseDecision);

  const dangerousApproval =
    (hasRemainingRisk && (approvedCompletion || approvedRelease)) ||
    (releaseConflated && approvedRelease);

  // 後工程で顕在化した見逃し（consequence）は重い弱点とみなす。
  const hasManifestedRisk = result.consequences.length > 0;

  if (
    dangerousApproval ||
    (hasManifestedRisk && result.totalMissed > 0) ||
    // high severity を条件付きで通した open condition は重い弱点（無条件に strong にしない）。
    hasOpenHighCondition
  ) {
    return "needs-practice";
  }
  if (result.totalMissed > 0 || result.totalFalse > 0 || hasOpenConditions) {
    return "mixed";
  }
  return "strong";
}

/** LearnerEvaluation の見出し locale key。 */
export function learnerEvaluationKey(evaluation: LearnerEvaluation): string {
  return `rc5.learner.${evaluation}`;
}

// ---------- 結合ビュー（Result 表示用の決定的 view model） ----------

/**
 * Result の最上部に出す「帰結 × 学習者評価」の分離済み view model。
 * UI はこの 2 フィールドを別々の semantic として表示する（P1-A 必須要件）。
 */
export interface JourneyOutcomeSummary {
  readonly outcome: JourneyOutcome;
  readonly learnerEvaluation: LearnerEvaluation;
  /** delivery が止まった/差し戻されたか（肯定文言を抑止するためのフラグ）。 */
  readonly halted: boolean;
  /** Release へ到達したか。 */
  readonly releaseReached: boolean;
  /** 危険な承認があったか（learner=needs-practice の主要因）。 */
  readonly hadDangerousApproval: boolean;
  /** origin step 集合（残存リスク発生源・決定的順序は呼び出し側の result 由来）。 */
  readonly riskOriginStepIds: readonly JourneyStepId[];
}

/** Outcome と Learner Evaluation をまとめて導く（Result view の single source）。 */
export function buildJourneyOutcomeSummary(input: {
  readonly result: JourneyFinalResult;
  readonly completionDecision?: ApprovalDecision | undefined;
  readonly releaseDecision?: ApprovalDecision | undefined;
  readonly releaseConflated: boolean;
  readonly journeyComplete: boolean;
  readonly riskOriginStepIds: readonly JourneyStepId[];
}): JourneyOutcomeSummary {
  const outcome = deriveJourneyOutcome({
    completionDecision: input.completionDecision,
    releaseDecision: input.releaseDecision,
    journeyComplete: input.journeyComplete,
  });
  const learnerEvaluation = deriveLearnerEvaluation({
    result: input.result,
    completionDecision: input.completionDecision,
    releaseDecision: input.releaseDecision,
    releaseConflated: input.releaseConflated,
  });

  // RC6 P1-A: open conditions も残存リスクに含める（条件付き承認を「問題なし」にしない）。
  const hasRemainingRisk =
    input.result.consequences.length > 0 ||
    input.result.totalMissed > 0 ||
    input.result.openConditions.length > 0;
  const approving: ReadonlySet<ApprovalDecision> = APPROVING;
  const approvedCompletion =
    input.completionDecision !== undefined && approving.has(input.completionDecision);
  const approvedRelease =
    input.releaseDecision !== undefined && approving.has(input.releaseDecision);
  const hadDangerousApproval =
    (hasRemainingRisk && (approvedCompletion || approvedRelease)) ||
    (input.releaseConflated && approvedRelease);

  return {
    outcome,
    learnerEvaluation,
    halted: outcomeIsHalted(outcome),
    releaseReached: outcomeReleaseReached(outcome),
    hadDangerousApproval,
    riskOriginStepIds: input.riskOriginStepIds,
  };
}
