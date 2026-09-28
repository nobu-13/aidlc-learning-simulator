import { describe, it, expect } from "vitest";
import { diffBundleKeys } from "../../i18n/locale-resources.ts";
import { practiceLocales } from "./practice-locale.ts";
import { PRACTICES } from "./practice-catalog.ts";
import { getPracticeProvenance } from "./practice-provenance.ts";
import type { Practice } from "./practice-entities.ts";

describe("practice locale bundles（ja/en）", () => {
  it("ja と en は同一 key 集合を持つ（片言語混在なし・§24）", () => {
    const { missingInA, missingInB } = diffBundleKeys(practiceLocales.ja, practiceLocales.en);
    expect(missingInA).toEqual([]);
    expect(missingInB).toEqual([]);
  });

  it("en bundle に日本語文字を含まない（English 出力に日本語混入なし・§24）", () => {
    const jaChar = /[぀-ゟ゠-ヿ一-鿿]/; // Hiragana/Katakana/CJK
    for (const [key, value] of Object.entries(practiceLocales.en)) {
      expect(jaChar.test(value), `en[${key}] contains JP text: ${value}`).toBe(false);
    }
  });
});

/** practice 定義が参照する全 locale key を収集する。 */
function collectKeys(p: Practice): string[] {
  const keys = [p.titleKey, p.summaryKey, p.objectiveKey];
  if (p.notEvaluatedNoteKey !== undefined) keys.push(p.notEvaluatedNoteKey);
  switch (p.kind) {
    case "requirement":
      for (const f of p.fields) keys.push(f.labelKey);
      break;
    case "evidence-review":
      for (const it of p.items) keys.push(it.labelKey, it.descriptionKey, it.rationaleKey);
      break;
    case "classification":
      for (const a of p.actions) keys.push(a.labelKey, a.contextKey, a.rationaleKey);
      break;
    case "traceability":
      for (const c of p.chains)
        keys.push(c.requirementKey, c.acceptanceCriterionKey, c.implementationKey, c.testKey, c.rationaleKey);
      break;
    case "change-control":
      for (const c of p.cases) keys.push(c.promptKey, c.contextKey, c.rationaleKey);
      break;
  }
  return keys;
}

describe("practice catalog key resolvability", () => {
  it("全 practice の参照 locale key が ja/en 双方に存在する", () => {
    for (const p of PRACTICES) {
      for (const key of collectKeys(p)) {
        expect(practiceLocales.ja[key], `ja missing ${key}`).toBeDefined();
        expect(practiceLocales.en[key], `en missing ${key}`).toBeDefined();
      }
    }
  });

  it("全 practice の provenanceRef が解決できる", () => {
    for (const p of PRACTICES) {
      for (const ref of p.provenanceRefs) {
        const pv = getPracticeProvenance(ref);
        expect(pv, `provenance ${ref} missing`).toBeDefined();
        // provenance note key も locale に存在する。
        expect(practiceLocales.ja[pv!.noteKey]).toBeDefined();
        expect(practiceLocales.en[pv!.noteKey]).toBeDefined();
      }
    }
  });
});
