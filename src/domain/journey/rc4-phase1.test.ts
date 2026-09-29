// RC4 Phase 1 テスト — Archetype Model + Artifact Generator v2 domain foundation。
//
// 検証:
//  - 4 archetype すべてが生成できる
//  - 決定的生成（同一入力 → 同一 artifact）
//  - archetype content isolation（archetype ごとに本文 key が変わる）
//  - Document Search は Inquiry 固有本文を出さない
//  - structured context を変えると NFR / evidence 本文が変わる
//  - defective != corrected（同 slot で本文が実際に異なる）
//  - revision / content-state の整合
//  - rc4 content の locale symmetry（ja/en）
//  - mode を変えても Ground Truth（defect set / 生成 item）は不変
import { describe, it, expect } from "vitest";
import {
  PROJECT_ARCHETYPE_IDS,
  isProjectArchetypeId,
  type JourneyStepId,
  type ProjectArchetypeId,
  type StructuredControlInput,
} from "./journey-entities.ts";
import { generateArtifactV2 } from "./artifact-generator-v2.ts";
import { buildDefectSet } from "./defect-catalog.ts";
import { loadArchetypeContentCatalog } from "../../content/index.ts";
import { validateArchetypeContent } from "../../content/content-loader.ts";
import { buildUserProfile } from "./journey-profiles.ts";
import { rc4ContentJa, rc4ContentEn } from "../../i18n/rc4-content.ts";
import { diffBundleKeys } from "../../i18n/locale-resources.ts";

const catalog = loadArchetypeContentCatalog();

/** high-signal な structured（多くの defect が activate する）。 */
const HEAVY: StructuredControlInput = {
  workload: "interactive",
  dataSensitivity: "personal-info",
  availability: "critical",
  externalDependency: "heavy",
  operationalCriticality: "high",
  releaseImpact: "high",
  reversibility: "irreversible",
  approvalRequirement: "committee",
};

/** low-signal な structured（多くの defect が activate しない）。 */
const LIGHT: StructuredControlInput = {
  workload: "cpu-bound",
  dataSensitivity: "public",
  availability: "best-effort",
  externalDependency: "none",
  operationalCriticality: "low",
  releaseImpact: "low",
  reversibility: "reversible",
  approvalRequirement: "single",
};

function gen(
  archetypeId: ProjectArchetypeId,
  structured: StructuredControlInput,
  stepId: JourneyStepId = "j3-design",
) {
  const profile = buildUserProfile("t", {}, structured, archetypeId);
  const defects = buildDefectSet(structured);
  return generateArtifactV2({
    stepId,
    profileId: profile.profileId,
    context: profile.context,
    defects,
    revision: 0,
    contentCatalog: catalog,
  });
}

describe("RC4 Phase 1 — archetype catalog", () => {
  it("catalog loads all 4 archetypes without error", () => {
    expect([...catalog.byArchetype.keys()].sort()).toEqual([...PROJECT_ARCHETYPE_IDS].sort());
  });

  it("malformed content is rejected (no silent fallback)", () => {
    expect(() => validateArchetypeContent({ ref: "bad", raw: { schemaVersion: 1 } })).toThrow();
    // defect slot が corrected を欠く → reject。
    expect(() =>
      validateArchetypeContent({
        ref: "bad2",
        raw: {
          schemaVersion: 1,
          archetypeId: "document-search",
          titleKey: "x",
          summaryKey: "x",
          steps: [],
        },
      }),
    ).toThrow(); // 必須 step 欠落。
  });

  it("isProjectArchetypeId type guard", () => {
    expect(isProjectArchetypeId("document-search")).toBe(true);
    expect(isProjectArchetypeId("nope")).toBe(false);
    expect(isProjectArchetypeId(123)).toBe(false);
  });
});

describe("RC4 Phase 1 — each archetype generation", () => {
  for (const archetypeId of PROJECT_ARCHETYPE_IDS) {
    it(`generates artifacts for all review steps: ${archetypeId}`, () => {
      for (const stepId of ["j1-requirements", "j2-acceptance-scope", "j3-design", "j4-implementation-traceability", "j5-test-strategy", "j6-test-evidence"] as const) {
        const art = gen(archetypeId, HEAVY, stepId);
        expect(art.archetypeId).toBe(archetypeId);
        expect(art.items.length).toBeGreaterThan(0);
        // 本文 key はすべて locale key（rc4.* もしくは consequence の rc3.*）。
        for (const it of art.items) {
          expect(it.bodyKey.startsWith("rc4.") || it.bodyKey.startsWith("rc3.")).toBe(true);
        }
      }
    });
  }
});

describe("RC4 Phase 1 — deterministic generation", () => {
  it("same input -> identical artifact (all fields)", () => {
    const a = gen("document-search", HEAVY);
    const b = gen("document-search", HEAVY);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("RC4 Phase 1 — archetype content isolation", () => {
  it("different archetypes produce different body keys for the same step", () => {
    const iaw = gen("internal-api-workflow", HEAVY, "j1-requirements");
    const ds = gen("document-search", HEAVY, "j1-requirements");
    const iawGoal = iaw.items.find((i) => i.itemId === "req-item-goal")?.bodyKey;
    const dsGoal = ds.items.find((i) => i.itemId === "req-item-goal")?.bodyKey;
    expect(iawGoal).toBeDefined();
    expect(dsGoal).toBeDefined();
    expect(iawGoal).not.toBe(dsGoal);
    expect(iawGoal).toBe("rc4.iaw.j1.goal.body");
    expect(dsGoal).toBe("rc4.ds.j1.goal.body");
  });

  it("Document Search does NOT emit Inquiry-management-specific content keys", () => {
    for (const stepId of ["j1-requirements", "j3-design"] as const) {
      const ds = gen("document-search", HEAVY, stepId);
      for (const it of ds.items) {
        // Inquiry management（iaw）固有 key を document-search が出さない。
        expect(it.bodyKey.startsWith("rc4.iaw.")).toBe(false);
        expect(it.labelKey.startsWith("rc4.iaw.")).toBe(false);
        // document-search の本文はすべて rc4.ds.*（consequence の rc3.* を除く）。
        if (it.reviewability === "finding-candidate") {
          expect(it.bodyKey.startsWith("rc4.ds.")).toBe(true);
        }
      }
    }
  });
});

describe("RC4 Phase 1 — structured context changes NFR/evidence", () => {
  it("HEAVY activates the availability-NFR defect (defective NFR body); LIGHT does not (baseline)", () => {
    const heavy = gen("customer-facing-app", HEAVY, "j3-design");
    const light = gen("customer-facing-app", LIGHT, "j3-design");
    const heavyNfr = heavy.items.find((i) => i.itemId === "design-item-missing-nfr");
    const lightNfr = light.items.find((i) => i.itemId === "design-item-missing-nfr");
    expect(heavyNfr?.contentState).toBe("defective");
    expect(heavyNfr?.bodyKey).toBe("rc4.cfa.j3.missingNfr.defective");
    // LIGHT は availability=best-effort なので missing-nfr defect が activate せず baseline。
    expect(lightNfr?.contentState).toBe("baseline");
    expect(lightNfr?.bodyKey).toBe("rc4.cfa.j3.missingNfr.baseline");
  });

  it("evidence step reflects criticality: HEAVY has active evidence defect", () => {
    const heavy = gen("internal-api-workflow", HEAVY, "j6-test-evidence");
    const ev = heavy.items.find((i) => i.itemId === "evidence-item-insufficient");
    // insufficient-evidence は常時 activate（教材）→ defective。
    expect(ev?.contentState).toBe("defective");
    expect(heavy.unresolvedDefectIds).toContain("d-j6-insufficient-evidence");
  });
});

describe("RC4 Phase 1 — defective != corrected", () => {
  it("resolving a defect switches the slot body from defective to corrected", () => {
    const profile = buildUserProfile("t", {}, HEAVY, "internal-api-workflow");
    const defects = buildDefectSet(HEAVY);
    const base = {
      stepId: "j3-design" as const,
      profileId: profile.profileId,
      context: profile.context,
      defects,
      contentCatalog: catalog,
    };
    const unresolved = generateArtifactV2({ ...base, revision: 0 });
    const resolved = generateArtifactV2({
      ...base,
      revision: 1,
      resolvedDefectIds: ["d-j3-missing-nfr"],
      previouslyResolvedDefectIds: [],
    });

    const before = unresolved.items.find((i) => i.itemId === "design-item-missing-nfr");
    const after = resolved.items.find((i) => i.itemId === "design-item-missing-nfr");

    expect(before?.contentState).toBe("defective");
    expect(after?.contentState).toBe("corrected");
    // 本文 key が実際に変わる（RC4 の核心）。
    expect(before?.bodyKey).not.toBe(after?.bodyKey);
    expect(before?.bodyKey).toBe("rc4.iaw.j3.missingNfr.defective");
    expect(after?.bodyKey).toBe("rc4.iaw.j3.missingNfr.corrected");
    // resolved 側は resolvedDefectIds / changeSummaryKeys を持つ。
    expect(resolved.resolvedDefectIds).toContain("d-j3-missing-nfr");
    expect(resolved.changeSummaryKeys).toContain("rc4.iaw.j3.missingNfr.change");
    expect(resolved.unresolvedDefectIds).not.toContain("d-j3-missing-nfr");
  });
});

describe("RC4 Phase 1 — revision / content-state consistency", () => {
  it("variantKey encodes slot + content state; artifactId encodes revision", () => {
    const art = gen("event-driven-processing", HEAVY, "j3-design");
    const nfr = art.items.find((i) => i.itemId === "design-item-missing-nfr");
    expect(nfr?.variantKey).toBe("design-item-missing-nfr::defective");
    expect(art.artifactId).toContain("__r0");
    const baselineItem = art.items.find((i) => i.itemId === "design-item-fd-valid");
    expect(baselineItem?.variantKey).toBe("design-item-fd-valid::baseline");
    expect(baselineItem?.contentState).toBe("baseline");
  });
});

describe("RC4 Phase 1 — rc4 content locale symmetry", () => {
  it("rc4 content ja / en have identical key sets", () => {
    const { missingInA, missingInB } = diffBundleKeys(rc4ContentJa, rc4ContentEn);
    expect(missingInA).toEqual([]);
    expect(missingInB).toEqual([]);
  });

  it("every body/label key referenced by every archetype exists in both locales", () => {
    for (const archetypeId of PROJECT_ARCHETYPE_IDS) {
      for (const stepId of ["j1-requirements", "j2-acceptance-scope", "j3-design", "j4-implementation-traceability", "j5-test-strategy", "j6-test-evidence"] as const) {
        // defect を全て activate させて defective/corrected 本文 key も参照させる。
        const profile = buildUserProfile("t", {}, HEAVY, archetypeId);
        const defects = buildDefectSet(HEAVY);
        const unresolved = generateArtifactV2({ stepId, profileId: profile.profileId, context: profile.context, defects, revision: 0, contentCatalog: catalog });
        const resolvedIds = defects.map((d) => d.defectId);
        const resolved = generateArtifactV2({ stepId, profileId: profile.profileId, context: profile.context, defects, revision: 1, resolvedDefectIds: resolvedIds, contentCatalog: catalog });
        for (const art of [unresolved, resolved]) {
          for (const it of art.items) {
            if (it.bodyKey.startsWith("rc4.")) {
              expect(rc4ContentJa[it.bodyKey], `${it.bodyKey} missing in ja`).toBeDefined();
              expect(rc4ContentEn[it.bodyKey], `${it.bodyKey} missing in en`).toBeDefined();
            }
            if (it.labelKey.startsWith("rc4.")) {
              expect(rc4ContentJa[it.labelKey], `${it.labelKey} missing in ja`).toBeDefined();
              expect(rc4ContentEn[it.labelKey], `${it.labelKey} missing in en`).toBeDefined();
            }
          }
          for (const k of art.changeSummaryKeys) {
            expect(rc4ContentJa[k], `${k} missing in ja`).toBeDefined();
            expect(rc4ContentEn[k], `${k} missing in en`).toBeDefined();
          }
        }
      }
    }
  });
});

describe("RC4 Phase 1 — mode-invariant Ground Truth (generator does not take mode)", () => {
  it("generateArtifactV2 produces identical items regardless of any mode context (it has no mode param)", () => {
    // v2 は mode を受け取らない = 生成は mode 不変。defect set も buildDefectSet が mode を取らない。
    const a = gen("document-search", HEAVY, "j3-design");
    const b = gen("document-search", HEAVY, "j3-design");
    expect(a.items.map((i) => `${i.itemId}:${i.contentState}`)).toEqual(
      b.items.map((i) => `${i.itemId}:${i.contentState}`),
    );
    // defect set は structured のみに依存。
    const d1 = buildDefectSet(HEAVY);
    const d2 = buildDefectSet(HEAVY);
    expect(d1.map((d) => d.defectId)).toEqual(d2.map((d) => d.defectId));
  });
});
