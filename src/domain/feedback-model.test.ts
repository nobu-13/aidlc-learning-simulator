import { describe, it, expect } from "vitest";
import { buildTestScenario } from "./test-fixtures.ts";
import { buildFeedbackCard } from "./feedback-model.ts";

const scenario = buildTestScenario();

describe("buildFeedbackCard", () => {
  it("選択に応じた Feedback Card を構築する（selected / judgment / impacts）", () => {
    const card = buildFeedbackCard(scenario, "dp1", "o1a");
    expect(card).toBeDefined();
    expect(card?.selectedOptionId).toBe("o1a");
    expect(card?.selectedOptionLabelKey).toBe("o1a.label");
    expect(card?.judgment.status).toBe("context-dependent");
  });

  it("LearningPoint を持つ DP は Why（LP 本文）を含む", () => {
    // dp1 は lp-1 を持つ。
    const card = buildFeedbackCard(scenario, "dp1", "o1a");
    expect(card?.learningPoints.map((lp) => lp.learningPointId)).toContain("lp-1");
  });

  it("LearningPoint を持たない DP でも meaningful feedback（judgment/impact/provenance）を返す（BUG 4.1）", () => {
    // dp3 は learningPointRefs 空。それでも card は成立し judgment を持つ。
    const card = buildFeedbackCard(scenario, "dp3", "o3a");
    expect(card).toBeDefined();
    expect(card?.learningPoints).toHaveLength(0);
    expect(card?.judgment.status).toBe("recommended");
    expect(card?.judgment.impacts.length).toBeGreaterThan(0);
  });

  it("DP に属さない option は undefined（error 扱いの入力）", () => {
    expect(buildFeedbackCard(scenario, "dp1", "o3a")).toBeUndefined();
  });

  it("選択に応じて内容が変わる（option 別 feedback・§9）", () => {
    const a = buildFeedbackCard(scenario, "dp1", "o1a");
    const b = buildFeedbackCard(scenario, "dp1", "o1b");
    expect(a?.judgment.status).not.toBe(b?.judgment.status);
  });
});
