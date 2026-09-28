import { describe, it, expect } from "vitest";
import { buildTestScenario } from "./test-fixtures.ts";
import { buildLearningResult } from "./result-model.ts";
import { buildResultDashboard } from "./result-summary.ts";
import type { DecisionRecord } from "./entities.ts";

const scenario = buildTestScenario();
const sessionId = "sess__core-1";

function rec(orderIndex: number, decisionPointId: string, optionId: string, note?: string): DecisionRecord {
  return {
    decisionRecordId: `dr-${orderIndex}`,
    sessionId,
    decisionPointId,
    chosenDecisionOptionId: optionId,
    orderIndex,
    ...(note !== undefined ? { note } : {}),
  };
}

describe("buildResultDashboard", () => {
  it("positive / review dimensions を決定的に分類する", () => {
    // o3b は evidence-quality(negative) → review へ。
    const records = [rec(0, "dp3", "o3b")];
    const result = buildLearningResult(scenario, sessionId, records);
    const dash = buildResultDashboard(scenario, result, records, ["core-1"]);
    expect(dash.reviewDimensions).toContain("evidence-quality");
    expect(dash.dimensionRows).toHaveLength(9);
  });

  it("Decision Timeline は orderIndex 昇順で、選択・judgment・note を持つ", () => {
    const records = [rec(1, "dp3", "o3a"), rec(0, "dp1", "o1a", "私のメモ")];
    const result = buildLearningResult(scenario, sessionId, records);
    const dash = buildResultDashboard(scenario, result, records, ["core-1"]);
    expect(dash.timeline.map((r) => r.orderIndex)).toEqual([0, 1]);
    expect(dash.timeline[0]?.note).toBe("私のメモ");
    expect(dash.timeline[0]?.judgment.status).toBe("context-dependent");
  });

  it("Decision → Stage 対応を timeline に含む（Decision→Dimension traceability・§14）", () => {
    const records = [rec(0, "dp1", "o1a")];
    const result = buildLearningResult(scenario, sessionId, records);
    const dash = buildResultDashboard(scenario, result, records, ["core-1"]);
    expect(dash.timeline[0]?.stageId).toBe("stage-1");
    // 寄与 Dimension が judgment.impacts で説明される。
    expect(dash.timeline[0]?.judgment.impacts.length).toBeGreaterThan(0);
  });

  it("Next Focus 推薦は決定的 mapping（弱 evidence-quality → focus-evidence）のみ", () => {
    const records = [rec(0, "dp3", "o3b")]; // evidence-quality negative
    const result = buildLearningResult(scenario, sessionId, records);
    // focus-evidence が available なら推薦。
    const dash = buildResultDashboard(scenario, result, records, ["core-1", "focus-evidence"]);
    expect(dash.nextFocus.map((f) => f.focusScenarioId)).toContain("focus-evidence");
  });

  it("mapping 先が available でなければ推薦しない（推測しない・§10.F）", () => {
    const records = [rec(0, "dp3", "o3b")];
    const result = buildLearningResult(scenario, sessionId, records);
    const dash = buildResultDashboard(scenario, result, records, ["core-1"]);
    expect(dash.nextFocus).toHaveLength(0);
  });
});
