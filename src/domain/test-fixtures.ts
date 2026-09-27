// domain テスト共通 fixture。決定的評価の検証に使う小さな ValidatedScenario を構築する。
import { validateScenarioSet } from "../data/scenario-loader.ts";
import type { ValidatedScenario } from "./entities.ts";

/**
 * 2 Stage / 3 DecisionPoint の評価用 Scenario。
 * - dp1: approval-boundary（非単調）へ o1a=positive / o1b=negative
 * - dp2: delegation-quality（非単調）へ o2a=strong-positive（過剰） / o2b=neutral
 * - dp3: evidence-quality（単調）へ o3a=positive / o3b=negative
 */
export function buildTestScenario(): ValidatedScenario {
  const raw = {
    schemaVersion: 1,
    scenario: {
      scenarioId: "core-1",
      kind: "core",
      titleKey: "core-1.title",
      summaryKey: "core-1.summary",
      learningObjectiveIds: ["obj-boundary"],
      stageIds: ["stage-1", "stage-2"],
      learningPointIds: ["lp-1"],
      tags: ["approval"],
      provenanceRefs: ["pv-spec"],
    },
    stages: [
      { stageId: "stage-1", titleKey: "stage-1.title", decisionPointIds: ["dp1", "dp2"] },
      { stageId: "stage-2", titleKey: "stage-2.title", decisionPointIds: ["dp3"] },
    ],
    decisionPoints: [
      {
        decisionPointId: "dp1",
        promptKey: "dp1.prompt",
        optionIds: ["o1a", "o1b"],
        learningPointRefs: ["lp-1"],
        important: true,
        provenanceRefs: ["pv-spec"],
      },
      {
        decisionPointId: "dp2",
        promptKey: "dp2.prompt",
        optionIds: ["o2a", "o2b"],
        learningPointRefs: [],
        important: false,
        provenanceRefs: [],
      },
      {
        decisionPointId: "dp3",
        promptKey: "dp3.prompt",
        optionIds: ["o3a", "o3b"],
        learningPointRefs: [],
        important: false,
        provenanceRefs: [],
      },
    ],
    decisionOptions: [
      { optionId: "o1a", labelKey: "o1a.label", effectRuleRefs: ["er-ab-pos"], provenanceRefs: [] },
      { optionId: "o1b", labelKey: "o1b.label", effectRuleRefs: ["er-ab-neg"], provenanceRefs: [] },
      { optionId: "o2a", labelKey: "o2a.label", effectRuleRefs: ["er-dq-strongpos"], provenanceRefs: [] },
      { optionId: "o2b", labelKey: "o2b.label", effectRuleRefs: [], provenanceRefs: [] },
      { optionId: "o3a", labelKey: "o3a.label", effectRuleRefs: ["er-eq-pos"], provenanceRefs: [] },
      { optionId: "o3b", labelKey: "o3b.label", effectRuleRefs: ["er-eq-neg"], provenanceRefs: [] },
    ],
    learningPoints: [
      { learningPointId: "lp-1", conceptId: "approval-boundary", titleKey: "lp-1.t", bodyKey: "lp-1.b", provenanceRefs: ["pv-spec"] },
    ],
    effectRules: [
      { effectRuleId: "er-ab-pos", dimensionId: "approval-boundary", contribution: "positive" },
      { effectRuleId: "er-ab-neg", dimensionId: "approval-boundary", contribution: "negative" },
      { effectRuleId: "er-dq-strongpos", dimensionId: "delegation-quality", contribution: "strong-positive" },
      { effectRuleId: "er-eq-pos", dimensionId: "evidence-quality", contribution: "positive" },
      { effectRuleId: "er-eq-neg", dimensionId: "evidence-quality", contribution: "negative" },
    ],
    provenanceEntries: [
      { provenanceId: "pv-spec", category: "ai-dlc-spec", reference: "AI-DLC v2.10.0 Release Notes", noteKey: "pv-spec.note" },
    ],
  };
  return validateScenarioSet({ ref: "core-1", raw });
}
