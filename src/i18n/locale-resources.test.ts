import { describe, it, expect } from "vitest";
import {
  createResolver,
  defaultLocaleFrom,
  diffBundleKeys,
  missingKeyMarker,
} from "./locale-resources.ts";
import { ja, en } from "./messages.ts";
import { buildTestScenario } from "../domain/test-fixtures.ts";
import { evaluateDimensions } from "../domain/dimension-evaluator.ts";
import type { DecisionRecord } from "../domain/entities.ts";

describe("createResolver", () => {
  it("存在する key を解決する", () => {
    const r = createResolver("ja", { "a.b": "値" });
    expect(r.t("a.b")).toBe("値");
    expect(r.missingKeys()).toHaveLength(0);
  });

  it("欠落 key は blank/undefined を出さずマーカーを返し、検出できる（BR5.3）", () => {
    const r = createResolver("en", { "a.b": "v" });
    const out = r.t("missing.key");
    expect(out).toBe(missingKeyMarker("missing.key"));
    expect(out).not.toBe("");
    expect(out).not.toContain("undefined");
    expect(r.missingKeys()).toEqual(["missing.key"]);
  });

  it("空文字も欠落として扱う（片言語混在を防ぐ・FR10.5）", () => {
    const r = createResolver("ja", { "a.b": "" });
    expect(r.t("a.b")).toBe(missingKeyMarker("a.b"));
    expect(r.missingKeys()).toEqual(["a.b"]);
  });
});

describe("defaultLocaleFrom", () => {
  it("ja* は ja、その他は en、未指定は en（FR10.2）", () => {
    expect(defaultLocaleFrom(["ja-JP", "en"])).toBe("ja");
    expect(defaultLocaleFrom(["fr-FR"])).toBe("en");
    expect(defaultLocaleFrom(undefined)).toBe("en");
    expect(defaultLocaleFrom([])).toBe("en");
  });
});

describe("chrome bundles（ja/en）", () => {
  it("ja と en は同一 key 集合を持つ（学習内容の一致・FR10.4）", () => {
    const { missingInA, missingInB } = diffBundleKeys(ja, en);
    expect(missingInA).toEqual([]);
    expect(missingInB).toEqual([]);
  });
});

describe("i18n 不変性", () => {
  it("locale を変えても semantic 評価（DimensionOutcome）は不変（BR5.1）", () => {
    const scenario = buildTestScenario();
    const sessionId = "sess__core-1";
    const records: DecisionRecord[] = [
      { decisionRecordId: "dr-0", sessionId, decisionPointId: "dp1", chosenDecisionOptionId: "o1a", orderIndex: 0 },
    ];
    // 評価は locale を入力にしない。resolver を切り替えても結果は同一であることを示す。
    const baseline = evaluateDimensions(scenario, sessionId, records);
    createResolver("ja", ja);
    createResolver("en", en);
    const again = evaluateDimensions(scenario, sessionId, records);
    expect(again).toEqual(baseline);
  });
});
