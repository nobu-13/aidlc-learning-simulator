import { describe, it, expect } from "vitest";
import { buildScenarioCatalog, validateScenarioSet, type RawScenarioSource } from "./scenario-loader.ts";
import { ScenarioValidationError } from "../domain/errors.ts";

function validRaw(scenarioId = "s1"): unknown {
  return {
    schemaVersion: 1,
    scenario: {
      scenarioId,
      kind: "core",
      titleKey: `${scenarioId}.title`,
      summaryKey: `${scenarioId}.summary`,
      learningObjectiveIds: ["obj1"],
      stageIds: ["st1"],
      learningPointIds: ["lp1"],
      tags: [],
      provenanceRefs: [],
    },
    stages: [{ stageId: "st1", titleKey: "st1.title", decisionPointIds: ["dp1"] }],
    decisionPoints: [
      {
        decisionPointId: "dp1",
        promptKey: "dp1.prompt",
        optionIds: ["o1", "o2"],
        learningPointRefs: ["lp1"],
        important: true,
        provenanceRefs: ["pv1"],
      },
    ],
    decisionOptions: [
      { optionId: "o1", labelKey: "o1.label", effectRuleRefs: ["er1"], provenanceRefs: [], nextRef: "terminal" },
      { optionId: "o2", labelKey: "o2.label", effectRuleRefs: [], provenanceRefs: [], nextRef: "terminal" },
    ],
    learningPoints: [
      { learningPointId: "lp1", conceptId: "c1", titleKey: "lp1.t", bodyKey: "lp1.b", provenanceRefs: ["pv1"] },
    ],
    effectRules: [{ effectRuleId: "er1", dimensionId: "approval-boundary", contribution: "positive" }],
    provenanceEntries: [
      { provenanceId: "pv1", category: "ai-dlc-spec", reference: "AI-DLC v2.10.0 §x", noteKey: "pv1.note" },
    ],
  };
}

describe("validateScenarioSet", () => {
  it("妥当な ScenarioSet を ValidatedScenario に変換する", () => {
    const v = validateScenarioSet({ ref: "s1.json", raw: validRaw() });
    expect(v.scenario.scenarioId).toBe("s1");
    expect(v.orderedStageIds).toEqual(["st1"]);
    expect(v.decisionOptions.get("o1")?.nextRef).toBe("terminal");
  });

  it("stable-ID の重複を reject する（BR1.3）", () => {
    const raw = validRaw() as Record<string, unknown>;
    raw.stages = [
      { stageId: "st1", titleKey: "a", decisionPointIds: ["dp1"] },
      { stageId: "st1", titleKey: "b", decisionPointIds: [] },
    ];
    expect(() => validateScenarioSet({ ref: "r", raw })).toThrow(ScenarioValidationError);
  });

  it("dangling reference（未定義 DecisionOption）を reject する（BR1.4）", () => {
    const raw = validRaw() as Record<string, unknown>;
    (raw.decisionPoints as Array<Record<string, unknown>>)[0]!.optionIds = ["o1", "missing"];
    expect(() => validateScenarioSet({ ref: "r", raw })).toThrow(/未定義 DecisionOption/);
  });

  it("important DecisionPoint の provenance 欠落を reject する（BR1.6/BR4.3）", () => {
    const raw = validRaw() as Record<string, unknown>;
    const dp = (raw.decisionPoints as Array<Record<string, unknown>>)[0]!;
    dp.provenanceRefs = [];
    // provenanceRefs を消すと DecisionPoint 参照も壊れるが、important 検証が先に効くことを確認。
    expect(() => validateScenarioSet({ ref: "r", raw })).toThrow(ScenarioValidationError);
  });

  it("nextRef の dangling を reject する（BR1.4）", () => {
    const raw = validRaw() as Record<string, unknown>;
    (raw.decisionOptions as Array<Record<string, unknown>>)[0]!.nextRef = "nowhere";
    expect(() => validateScenarioSet({ ref: "r", raw })).toThrow(/nextRef/);
  });
});

describe("buildScenarioCatalog", () => {
  it("valid のみを catalog に載せ、順序を保つ", () => {
    const sources: RawScenarioSource[] = [
      { ref: "s1", raw: validRaw("s1") },
      { ref: "s2", raw: validRaw("s2") },
    ];
    const cat = buildScenarioCatalog(sources);
    expect(cat.orderedScenarioIds).toEqual(["s1", "s2"]);
    expect(cat.unavailable).toHaveLength(0);
  });

  it("一部 invalid でも valid を全滅させず、読めなかったものを明示する（BR1.8）", () => {
    const bad = validRaw("bad") as Record<string, unknown>;
    (bad.decisionPoints as Array<Record<string, unknown>>)[0]!.optionIds = ["only-one"]; // cardinality 違反
    const sources: RawScenarioSource[] = [
      { ref: "good", raw: validRaw("good") },
      { ref: "bad", raw: bad },
    ];
    const cat = buildScenarioCatalog(sources);
    expect(cat.orderedScenarioIds).toEqual(["good"]);
    expect(cat.unavailable).toHaveLength(1);
    expect(cat.unavailable[0]!.ref).toBeDefined();
    expect(cat.unavailable[0]!.detail.length).toBeGreaterThan(0);
  });

  it("全 invalid でも throw せず空 catalog + unavailable を返す（BR1.8 / FR12）", () => {
    const bad = validRaw("bad") as Record<string, unknown>;
    delete bad.scenario;
    const cat = buildScenarioCatalog([{ ref: "bad", raw: bad }]);
    expect(cat.orderedScenarioIds).toHaveLength(0);
    expect(cat.unavailable).toHaveLength(1);
  });

  it("scenarioId 重複を unavailable として扱う", () => {
    const sources: RawScenarioSource[] = [
      { ref: "s1a", raw: validRaw("dup") },
      { ref: "s1b", raw: validRaw("dup") },
    ];
    const cat = buildScenarioCatalog(sources);
    expect(cat.orderedScenarioIds).toEqual(["dup"]);
    expect(cat.unavailable).toHaveLength(1);
  });
});
