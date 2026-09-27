import { describe, it, expect } from "vitest";
import { scenarioSetSchema } from "./schema.ts";

// 妥当な最小 ScenarioSet（テスト fixture）。
function validSet(): unknown {
  return {
    schemaVersion: 1,
    scenario: {
      scenarioId: "s1",
      kind: "core",
      titleKey: "s1.title",
      summaryKey: "s1.summary",
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
      { optionId: "o1", labelKey: "o1.label", effectRuleRefs: ["er1"], provenanceRefs: [] },
      { optionId: "o2", labelKey: "o2.label", effectRuleRefs: [], provenanceRefs: [] },
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

describe("scenarioSetSchema", () => {
  it("妥当な ScenarioSet を通す", () => {
    const r = scenarioSetSchema.safeParse(validSet());
    expect(r.success).toBe(true);
  });

  it("unknown フィールドを reject する（BR1.2）", () => {
    const bad = { ...(validSet() as object), unexpectedField: 1 };
    const r = scenarioSetSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("未対応 schemaVersion を reject する（BR1.7）", () => {
    const bad = { ...(validSet() as Record<string, unknown>), schemaVersion: 99 };
    const r = scenarioSetSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("DecisionPoint の option が 2 未満なら reject する（cardinality・BR1.5）", () => {
    const base = validSet() as Record<string, unknown>;
    const dps = base.decisionPoints as Array<Record<string, unknown>>;
    const first = dps[0];
    expect(first).toBeDefined();
    const bad = {
      ...base,
      decisionPoints: [{ ...(first as Record<string, unknown>), optionIds: ["o1"] }],
    };
    const r = scenarioSetSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("contribution の範囲外値を reject する（BR3.3）", () => {
    const base = validSet() as Record<string, unknown>;
    const bad = {
      ...base,
      effectRules: [{ effectRuleId: "er1", dimensionId: "approval-boundary", contribution: "amazing" }],
    };
    const r = scenarioSetSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("LearningPoint に provenanceRefs が無ければ reject する（BR1.5/BR4.3）", () => {
    const base = validSet() as Record<string, unknown>;
    const bad = {
      ...base,
      learningPoints: [
        { learningPointId: "lp1", conceptId: "c1", titleKey: "lp1.t", bodyKey: "lp1.b", provenanceRefs: [] },
      ],
    };
    const r = scenarioSetSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("category=ai-dlc-spec で reference 欠落なら reject する（BR1.6）", () => {
    const base = validSet() as Record<string, unknown>;
    const bad = {
      ...base,
      provenanceEntries: [{ provenanceId: "pv1", category: "ai-dlc-spec", noteKey: "pv1.note" }],
    };
    const r = scenarioSetSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });
});
