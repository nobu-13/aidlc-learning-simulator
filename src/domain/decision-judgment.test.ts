import { describe, it, expect } from "vitest";
import { buildTestScenario } from "./test-fixtures.ts";
import { deriveOptionJudgment } from "./decision-judgment.ts";

const scenario = buildTestScenario();

describe("deriveOptionJudgment", () => {
  it("負の寄与を含む option は risky", () => {
    // o1b は approval-boundary(negative)。
    const j = deriveOptionJudgment(scenario, "dp1", "o1b");
    expect(j.status).toBe("risky");
    expect(j.impacts.some((i) => i.delta < 0)).toBe(true);
  });

  it("単調 Dimension への正寄与のみは recommended", () => {
    // o3a は evidence-quality(positive)（単調）。
    const j = deriveOptionJudgment(scenario, "dp3", "o3a");
    expect(j.status).toBe("recommended");
  });

  it("非単調 Dimension への正寄与は context-dependent（過剰も negative になりうる）", () => {
    // o1a は approval-boundary(positive)（非単調）。
    const j = deriveOptionJudgment(scenario, "dp1", "o1a");
    expect(j.status).toBe("context-dependent");
  });

  it("寄与が無い option は context-dependent（良否を断定しない）", () => {
    // o2b は effectRuleRefs 空。
    const j = deriveOptionJudgment(scenario, "dp2", "o2b");
    expect(j.status).toBe("context-dependent");
    expect(j.impacts).toHaveLength(0);
  });

  it("delta は内部数値表現と一致する（strong-positive=+2）", () => {
    // o2a は delegation-quality(strong-positive)。
    const j = deriveOptionJudgment(scenario, "dp2", "o2a");
    const imp = j.impacts.find((i) => i.dimensionId === "delegation-quality");
    expect(imp?.delta).toBe(2);
  });

  it("betterAlternative は DP の LearningPoint.betterAlternativeRef から導く", () => {
    // dp1 の lp-1 には betterAlternativeRef は無い（fixture）。→ undefined。
    const j = deriveOptionJudgment(scenario, "dp1", "o1a");
    expect(j.betterAlternativeOptionId).toBeUndefined();
  });

  it("存在しない option は例外を投げず context-dependent（防御的）", () => {
    const j = deriveOptionJudgment(scenario, "dp1", "does-not-exist");
    expect(j.status).toBe("context-dependent");
  });
});
