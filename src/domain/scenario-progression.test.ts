import { describe, it, expect } from "vitest";
import { buildTestScenario } from "./test-fixtures.ts";
import {
  advanceStage,
  completeScenario,
  recordDecision,
  safeReset,
  startScenario,
} from "./scenario-progression.ts";
import { DomainInvariantError } from "./errors.ts";

const scenario = buildTestScenario();

describe("ScenarioProgression", () => {
  it("start は not-started → in-progress（最初の Stage を currentStageId に）", () => {
    const s = startScenario(scenario);
    expect(s.session.status).toBe("in-progress");
    expect(s.session.currentStageId).toBe("stage-1");
    expect(s.decisionRecords).toHaveLength(0);
  });

  it("decision を stable-ID で記録し、note は保持するが順序 index を持つ（BR2.3/BR2.5）", () => {
    let s = startScenario(scenario);
    s = recordDecision(scenario, s, "dp1", "o1a", "私のメモ");
    expect(s.decisionRecords).toHaveLength(1);
    const r = s.decisionRecords[0]!;
    expect(r.chosenDecisionOptionId).toBe("o1a");
    expect(r.note).toBe("私のメモ");
    expect(r.orderIndex).toBe(0);
    expect(r.decisionRecordId).toContain("dp1");
  });

  it("runtime semantic ID は決定的（同一 scenario で同一 sessionId・BR8.2）", () => {
    const a = startScenario(scenario);
    const b = startScenario(scenario);
    expect(a.session.sessionId).toBe(b.session.sessionId);
  });

  it("存在しない DecisionPoint への記録は DomainInvariantError（BR2.2）", () => {
    const s = startScenario(scenario);
    expect(() => recordDecision(scenario, s, "nope", "o1a")).toThrow(DomainInvariantError);
  });

  it("DecisionPoint に属さない option は DomainInvariantError（BR2.2）", () => {
    const s = startScenario(scenario);
    expect(() => recordDecision(scenario, s, "dp1", "o3a")).toThrow(DomainInvariantError);
  });

  it("advanceStage は次順 Stage へ、最終超えで completed（BR2.1）", () => {
    let s = startScenario(scenario);
    s = advanceStage(scenario, s); // stage-1 → stage-2
    expect(s.session.currentStageId).toBe("stage-2");
    s = advanceStage(scenario, s); // stage-2 を超え → completed
    expect(s.session.status).toBe("completed");
    expect(s.session.currentStageId).toBeUndefined();
  });

  it("completed session への decision 記録は DomainInvariantError（silent に進めない・BR2.2）", () => {
    let s = startScenario(scenario);
    s = completeScenario(s);
    expect(() => recordDecision(scenario, s, "dp1", "o1a")).toThrow(DomainInvariantError);
  });

  it("safeReset は not-started に戻す（BR2.1）", () => {
    const s = safeReset(scenario);
    expect(s.session.status).toBe("not-started");
    expect(s.decisionRecords).toHaveLength(0);
  });
});
