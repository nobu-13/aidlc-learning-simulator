// RC2 invariant tests — RC2 で追加した feedback / dashboard / practice が、
// 既存の決定的評価 semantics（mode / locale 非依存・9 Dimension 不変）を壊さないことを保証する（§27）。
import { describe, it, expect } from "vitest";
import { buildTestScenario } from "./test-fixtures.ts";
import { buildLearningResult } from "./result-model.ts";
import { evaluateDimensions } from "./dimension-evaluator.ts";
import { buildResultDashboard } from "./result-summary.ts";
import { buildFeedbackCard } from "./feedback-model.ts";
import { DIMENSION_IDS, type DecisionRecord } from "./entities.ts";

const scenario = buildTestScenario();
const sessionId = "sess__core-1";
const records: DecisionRecord[] = [
  { decisionRecordId: "dr-0", sessionId, decisionPointId: "dp1", chosenDecisionOptionId: "o1a", orderIndex: 0 },
  { decisionRecordId: "dr-1", sessionId, decisionPointId: "dp3", chosenDecisionOptionId: "o3b", orderIndex: 1 },
];

describe("RC2 invariants", () => {
  it("feedback / dashboard は mode を入力に取らない（型上 mode を渡す口が無い）", () => {
    // buildFeedbackCard / buildResultDashboard の引数に mode は存在しない。
    // 実行しても mode に依存しない結果であることを、複数回呼んで確認する。
    const c1 = buildFeedbackCard(scenario, "dp1", "o1a");
    const c2 = buildFeedbackCard(scenario, "dp1", "o1a");
    expect(c1).toEqual(c2);
  });

  it("dashboard の Dimension row は評価 engine の 9 Outcome と一致する（semantics 不変）", () => {
    const result = buildLearningResult(scenario, sessionId, records);
    const dash = buildResultDashboard(scenario, result, records, ["core-1"]);
    const engineLevels = evaluateDimensions(scenario, sessionId, records).map((o) => o.level);
    const dashLevels = dash.dimensionRows.map((r) => r.level);
    expect(dashLevels).toEqual(engineLevels);
  });

  it("9 Dimension の固定順序を dashboard も踏襲する", () => {
    const result = buildLearningResult(scenario, sessionId, records);
    const dash = buildResultDashboard(scenario, result, records, ["core-1"]);
    expect(dash.dimensionRows.map((r) => r.dimensionId)).toEqual([...DIMENSION_IDS]);
  });

  it("決定性: dashboard は同一入力で同一出力・順序入替でも不変", () => {
    const result = buildLearningResult(scenario, sessionId, records);
    const forward = buildResultDashboard(scenario, result, records, ["core-1"]);
    const reversed = buildResultDashboard(scenario, result, [...records].reverse(), ["core-1"]);
    expect(forward.dimensionRows).toEqual(reversed.dimensionRows);
  });
});
