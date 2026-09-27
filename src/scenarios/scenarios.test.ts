import { describe, it, expect } from "vitest";
import { scenarioModules } from "./index.ts";
import { validateScenarioSet, buildScenarioCatalog } from "../data/scenario-loader.ts";
import { diffBundleKeys } from "../i18n/locale-resources.ts";

// JSON fixture 健全性テスト（Testing Contract 必須・パラメタライズド）。
// 同梱する全 Scenario を境界 schema で実ロード・検証し、データ追加時の壊れを CI で捕捉する。
describe("scenario fixtures 健全性", () => {
  it("同梱 Scenario が 1 本以上ある（MVP 初期セット）", () => {
    expect(scenarioModules.length).toBeGreaterThanOrEqual(1);
  });

  for (const m of scenarioModules) {
    describe(m.ref, () => {
      it("境界 schema + 意味検証を通る（妥当な Scenario）", () => {
        expect(() => validateScenarioSet({ ref: m.ref, raw: m.raw })).not.toThrow();
      });

      it("参照される全 locale key が ja/en 双方に存在する（片言語混在なし・FR10.4/FR10.5）", () => {
        const v = validateScenarioSet({ ref: m.ref, raw: m.raw });
        // Scenario 内で参照される locale key を収集。
        const keys = new Set<string>();
        keys.add(v.scenario.titleKey);
        keys.add(v.scenario.summaryKey);
        for (const s of v.stages.values()) keys.add(s.titleKey);
        for (const dp of v.decisionPoints.values()) keys.add(dp.promptKey);
        for (const o of v.decisionOptions.values()) keys.add(o.labelKey);
        for (const lp of v.learningPoints.values()) {
          keys.add(lp.titleKey);
          keys.add(lp.bodyKey);
        }
        for (const pv of v.provenanceEntries.values()) keys.add(pv.noteKey);
        for (const er of v.effectRules.values()) if (er.rationaleKey) keys.add(er.rationaleKey);

        const ja = m.localeBundles.ja;
        const en = m.localeBundles.en;
        for (const key of keys) {
          expect(ja[key], `ja missing ${key}`).toBeTruthy();
          expect(en[key], `en missing ${key}`).toBeTruthy();
        }
      });

      it("ja と en の locale bundle は同一 key 集合を持つ", () => {
        const { missingInA, missingInB } = diffBundleKeys(m.localeBundles.ja, m.localeBundles.en);
        expect(missingInA).toEqual([]);
        expect(missingInB).toEqual([]);
      });
    });
  }

  it("全 Scenario で Catalog を構築でき unavailable が無い", () => {
    const cat = buildScenarioCatalog(scenarioModules.map((m) => ({ ref: m.ref, raw: m.raw })));
    expect(cat.unavailable).toEqual([]);
    expect(cat.orderedScenarioIds.length).toBe(scenarioModules.length);
  });

  // AC5.2 / AC5.3: v2.10.0 の必須 Topic（checkpoint review / refusal-recovery）を扱う
  // Focus Scenario が存在し、その根拠が ai-dlc-spec（v2.10.0 一次情報）で識別できること。
  it("checkpoint-review Focus Scenario が ai-dlc-spec provenance を持つ（AC5.2.1/AC5.2.2）", () => {
    const m = scenarioModules.find((x) => x.ref === "focus-checkpoint-review.json");
    expect(m).toBeDefined();
    const v = validateScenarioSet({ ref: m!.ref, raw: m!.raw });
    expect(v.scenario.kind).toBe("focus");
    const cats = [...v.provenanceEntries.values()].map((p) => p.category);
    expect(cats).toContain("ai-dlc-spec");
    // 一次情報 reference を持つ（v2.10.0 由来と識別可能）。
    const spec = [...v.provenanceEntries.values()].find((p) => p.category === "ai-dlc-spec");
    expect(spec?.reference ?? "").toContain("v2.10.0");
  });

  it("refusal-recovery Focus Scenario が ai-dlc-spec provenance を持つ（AC5.3.1/AC5.3.2）", () => {
    const m = scenarioModules.find((x) => x.ref === "focus-refusal-recovery.json");
    expect(m).toBeDefined();
    const v = validateScenarioSet({ ref: m!.ref, raw: m!.raw });
    expect(v.scenario.kind).toBe("focus");
    const spec = [...v.provenanceEntries.values()].find((p) => p.category === "ai-dlc-spec");
    expect(spec).toBeDefined();
    expect(spec?.reference ?? "").toContain("v2.10.0");
    // recovery が next step を示す学習ポイントを持つ。
    expect(v.learningPoints.size).toBeGreaterThanOrEqual(1);
  });
});
