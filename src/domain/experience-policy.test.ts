import { describe, it, expect } from "vitest";
import { buildTestScenario } from "./test-fixtures.ts";
import { presentationPolicyFor } from "./experience-policy.ts";
import { evaluateDimensions } from "./dimension-evaluator.ts";
import { COMPLETION_APPROVAL, RELEASE_APPROVAL, isSameApproval } from "./approval-semantics.ts";
import type { DecisionRecord, ExperienceMode } from "./entities.ts";

const scenario = buildTestScenario();
const sessionId = "sess__core-1";
const records: DecisionRecord[] = [
  { decisionRecordId: "dr-0", sessionId, decisionPointId: "dp1", chosenDecisionOptionId: "o1a", orderIndex: 0 },
  { decisionRecordId: "dr-1", sessionId, decisionPointId: "dp3", chosenDecisionOptionId: "o3b", orderIndex: 1 },
];

describe("ExperiencePolicy", () => {
  it("mode ごとに提示ポリシーが変わる（Guided は概念先出し・Simulation はヒント無し）", () => {
    expect(presentationPolicyFor("guided").showConceptBeforeDecision).toBe(true);
    expect(presentationPolicyFor("simulation").showHints).toBe(false);
    expect(presentationPolicyFor("adoption-review").emphasizeAdoptionReview).toBe(true);
  });

  it("mode を変えても評価（DimensionOutcome）は不変（BR5.2）", () => {
    const modes: ExperienceMode[] = ["guided", "simulation", "adoption-review"];
    const baseline = evaluateDimensions(scenario, sessionId, records);
    for (const mode of modes) {
      // policy は取得するが評価入力には一切渡さない（mode 非依存の証左）。
      presentationPolicyFor(mode);
      const again = evaluateDimensions(scenario, sessionId, records);
      expect(again).toEqual(baseline);
    }
  });
});

describe("ApprovalSemantics", () => {
  it("Completion Approval と Release Approval は別概念（C6/BR7.3）", () => {
    expect(isSameApproval(COMPLETION_APPROVAL, RELEASE_APPROVAL)).toBe(false);
    expect(isSameApproval(COMPLETION_APPROVAL, COMPLETION_APPROVAL)).toBe(true);
  });
});
