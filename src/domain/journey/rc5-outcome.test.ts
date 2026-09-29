// RC5 P1-A: JourneyOutcome / LearnerEvaluation 分離モデルの決定的テスト。
//
// RESULT MODEL TEST（RC5 必須）:
//  - Correct Block:        Outcome = Blocked,          Learner = Strong
//  - Bad Approve:          Outcome = Completed/Released, Learner = Needs Practice
//  - Correct Release Reject: Outcome = Release Rejected, Learner = Strong
import { describe, it, expect } from "vitest";
import {
  deriveJourneyOutcome,
  deriveLearnerEvaluation,
  buildJourneyOutcomeSummary,
  type JourneyOutcome,
  type LearnerEvaluation,
} from "./journey-outcome.ts";
import type { JourneyFinalResult } from "./journey-engine.ts";

/** clean な result（見逃し無し・consequence 無し）。 */
function cleanResult(): JourneyFinalResult {
  return {
    dimensionOutcomes: [],
    consequences: [],
    reviewEvaluations: [],
    totalCaught: 3,
    totalMissed: 0,
    totalFalse: 0,
    openConditions: [],
  };
}

/** 残存リスクありの result（見逃し + 後工程顕在化）。 */
function riskyResult(): JourneyFinalResult {
  return {
    dimensionOutcomes: [],
    consequences: [
      {
        sourceDefectId: "d-x",
        sourceStepId: "j1-requirements",
        atStepId: "j4-implementation-traceability",
        manifestItemKey: "some.key",
        addsRiskDimensionIds: [],
      },
    ],
    reviewEvaluations: [],
    totalCaught: 1,
    totalMissed: 2,
    totalFalse: 0,
    openConditions: [],
  };
}

describe("RC5 P1-A — deriveJourneyOutcome (delivery/journey の帰結)", () => {
  const cases: ReadonlyArray<
    [string, Parameters<typeof deriveJourneyOutcome>[0], JourneyOutcome]
  > = [
    ["Completion Block → blocked", { completionDecision: "block", journeyComplete: true }, "blocked"],
    ["Completion Return → returned", { completionDecision: "return", journeyComplete: false }, "returned"],
    [
      "Completion approve-with-conditions → conditionally-completed",
      { completionDecision: "approve-with-conditions", journeyComplete: false },
      "conditionally-completed",
    ],
    ["Completion approve → completed", { completionDecision: "approve", journeyComplete: false }, "completed"],
    [
      "Release approve → release-approved",
      { completionDecision: "approve", releaseDecision: "approve", journeyComplete: true },
      "release-approved",
    ],
    [
      "Release approve-with-conditions → release-conditional",
      { completionDecision: "approve", releaseDecision: "approve-with-conditions", journeyComplete: true },
      "release-conditional",
    ],
    [
      "Release block → release-rejected",
      { completionDecision: "approve", releaseDecision: "block", journeyComplete: true },
      "release-rejected",
    ],
    [
      "Release return → release-rejected",
      { completionDecision: "approve", releaseDecision: "return", journeyComplete: true },
      "release-rejected",
    ],
    ["未着手 → in-progress", { journeyComplete: false }, "in-progress"],
  ];
  for (const [name, inp, expected] of cases) {
    it(name, () => {
      expect(deriveJourneyOutcome(inp)).toBe(expected);
    });
  }
});

describe("RC5 P1-A — deriveLearnerEvaluation (学習者の判断品質)", () => {
  const cases: ReadonlyArray<
    [string, Parameters<typeof deriveLearnerEvaluation>[0], LearnerEvaluation]
  > = [
    [
      "正しい Block（clean review + block）→ strong",
      { result: cleanResult(), completionDecision: "block", releaseConflated: false },
      "strong",
    ],
    [
      "正しい Release Reject（clean + block）→ strong",
      {
        result: cleanResult(),
        completionDecision: "approve",
        releaseDecision: "block",
        releaseConflated: false,
      },
      "strong",
    ],
    [
      "残存リスクありで Approve → needs-practice（危険な承認）",
      { result: riskyResult(), completionDecision: "approve", releaseConflated: false },
      "needs-practice",
    ],
    [
      "残存リスクありで Release approve → needs-practice",
      {
        result: riskyResult(),
        completionDecision: "approve",
        releaseDecision: "approve",
        releaseConflated: false,
      },
      "needs-practice",
    ],
    [
      "conflation（無条件 release）→ needs-practice",
      {
        result: cleanResult(),
        completionDecision: "approve",
        releaseDecision: "approve",
        releaseConflated: true,
      },
      "needs-practice",
    ],
    [
      "見逃しはあるが危険な承認なし（block）→ ただし consequence 無し・missed のみ → mixed",
      {
        result: { ...cleanResult(), totalMissed: 1 },
        completionDecision: "block",
        releaseConflated: false,
      },
      "mixed",
    ],
    [
      "false positive のみ → mixed",
      {
        result: { ...cleanResult(), totalFalse: 1 },
        completionDecision: "approve",
        releaseConflated: false,
      },
      // 見逃し0・consequence0・危険承認なし（approve だが残存リスク無し）→ mixed（FP あり）。
      "mixed",
    ],
  ];
  for (const [name, inp, expected] of cases) {
    it(name, () => {
      expect(deriveLearnerEvaluation(inp)).toBe(expected);
    });
  }
});

describe("RC5 P1-A — buildJourneyOutcomeSummary（禁止: Block で肯定 terminal verdict）", () => {
  it("正しい Block: outcome=blocked, learner=strong, halted=true", () => {
    const s = buildJourneyOutcomeSummary({
      result: cleanResult(),
      completionDecision: "block",
      releaseConflated: false,
      journeyComplete: true,
      riskOriginStepIds: [],
    });
    expect(s.outcome).toBe("blocked");
    expect(s.learnerEvaluation).toBe("strong");
    expect(s.halted).toBe(true);
    expect(s.releaseReached).toBe(false);
    expect(s.hadDangerousApproval).toBe(false);
  });

  it("Bad Approve: outcome=release-approved, learner=needs-practice, dangerous", () => {
    const s = buildJourneyOutcomeSummary({
      result: riskyResult(),
      completionDecision: "approve",
      releaseDecision: "approve",
      releaseConflated: false,
      journeyComplete: true,
      riskOriginStepIds: ["j1-requirements"],
    });
    expect(s.outcome).toBe("release-approved");
    expect(s.learnerEvaluation).toBe("needs-practice");
    expect(s.hadDangerousApproval).toBe(true);
    expect(s.releaseReached).toBe(true);
  });

  it("Correct Release Reject: outcome=release-rejected, learner=strong", () => {
    const s = buildJourneyOutcomeSummary({
      result: cleanResult(),
      completionDecision: "approve",
      releaseDecision: "block",
      releaseConflated: false,
      journeyComplete: true,
      riskOriginStepIds: [],
    });
    expect(s.outcome).toBe("release-rejected");
    expect(s.learnerEvaluation).toBe("strong");
    expect(s.halted).toBe(true);
  });
});
