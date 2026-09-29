// RC6 — Grounded State Propagation の domain テスト。
//
// MANDATORY:
//  - P1-B: 上流で確定した accepted fact（可用性目標）が Design へ伝播し、Design が値を再要求しない。
//  - P1-C: structured input（data sensitivity）が artifact/評価の relevant semantic を変える。
//  - Parameter Contract: 各 structured dimension が宣言どおり observable output へ影響する。
import { describe, it, expect } from "vitest";
import {
  buildEffectiveScenarioState,
  deriveAcceptedUpstreamFacts,
  deriveDataSensitivityGrounding,
  acceptedFactsForStep,
} from "./effective-scenario-state.ts";
import { buildArtifactForStep, type JourneyRunInput } from "./journey-engine.ts";
import { buildDefectSet } from "./defect-catalog.ts";
import { buildUserProfile, defaultStructuredInput } from "./journey-profiles.ts";
import { initialProgress } from "./rework-state-machine.ts";
import { PARAMETER_SENSITIVITY_MATRIX } from "./parameter-sensitivity.ts";
import { STRUCTURED_INPUT_FIELD_IDS, type StructuredControlInput } from "./journey-entities.ts";

function runInput(structured: StructuredControlInput): JourneyRunInput {
  const profile = buildUserProfile("test", {}, structured, "internal-api-workflow");
  return { profile, mode: "simulation", progress: initialProgress(), reviews: {} };
}

/** structured を部分上書きして完全な入力を作る。 */
function withStructured(overrides: Partial<StructuredControlInput>): StructuredControlInput {
  return { ...defaultStructuredInput(), ...overrides };
}

// ============================================================
// P1-B — Accepted upstream fact propagation
// ============================================================
describe("RC6 P1-B — accepted upstream fact (availability target) propagation", () => {
  it("B: availability=critical/high は確定済み可用性目標を accepted fact として導く", () => {
    const factsCritical = deriveAcceptedUpstreamFacts(withStructured({ availability: "critical" }));
    expect(factsCritical.some((f) => f.factId === "availability-target")).toBe(true);

    const factsHigh = deriveAcceptedUpstreamFacts(withStructured({ availability: "high" }));
    expect(factsHigh.some((f) => f.factId === "availability-target")).toBe(true);
  });

  it("B: best-effort/standard は明示目標なし → accepted fact を作らない", () => {
    expect(deriveAcceptedUpstreamFacts(withStructured({ availability: "best-effort" }))).toHaveLength(0);
    expect(deriveAcceptedUpstreamFacts(withStructured({ availability: "standard" }))).toHaveLength(0);
  });

  it("B3: availability target fact は Design(j3) が前提として扱う（relevantAtStep=j3-design）", () => {
    const facts = deriveAcceptedUpstreamFacts(withStructured({ availability: "high" }));
    const forDesign = acceptedFactsForStep(facts, "j3-design");
    expect(forDesign).toHaveLength(1);
    expect(forDesign[0]!.sourceStepId).toBe("j1-requirements");
  });

  it("B3: Design artifact に accepted fact が載る（availability=high）", () => {
    const artifact = buildArtifactForStep(runInput(withStructured({ availability: "high" })), "j3-design");
    expect(artifact.acceptedFacts.some((f) => f.factId === "availability-target")).toBe(true);
  });

  it("B4: Design は確定済みの可用性目標に対し value 自体を再要求しない（accepted fact に value がある）", () => {
    const artifact = buildArtifactForStep(runInput(withStructured({ availability: "critical" })), "j3-design");
    const fact = artifact.acceptedFacts.find((f) => f.factId === "availability-target");
    expect(fact).toBeDefined();
    // fact は「確定済みの値」を持つ（valueLabelKey）→ 下流は「値がない」と扱わない。
    expect(fact!.valueLabelKey).toMatch(/availabilityTarget\.value\.(high|critical)/);
    expect(fact!.statementKey).toBe("rc6.fact.availabilityTarget.statement");
  });

  it("B5: availability=high では Design に missing-nfr defect が依然存在しうる（architecture/validation 評価）", () => {
    // 確定目標があっても、それを満たす architecture/validation は別途評価対象（defect は残る）。
    const defects = buildDefectSet(withStructured({ availability: "high" }));
    expect(defects.some((d) => d.defectId === "d-j3-missing-nfr")).toBe(true);
  });
});

// ============================================================
// P1-C — Simulation structured input grounding
// ============================================================
describe("RC6 P1-C — data sensitivity grounding changes relevant semantics", () => {
  it("C: PII/confidential は PII 境界を有効化、public/internal は無効", () => {
    expect(deriveDataSensitivityGrounding("personal-info").piiBoundaryActive).toBe(true);
    expect(deriveDataSensitivityGrounding("confidential").piiBoundaryActive).toBe(true);
    expect(deriveDataSensitivityGrounding("public").piiBoundaryActive).toBe(false);
    expect(deriveDataSensitivityGrounding("internal").piiBoundaryActive).toBe(false);
  });

  it("C1/C2: PII vs Public で Design artifact の data classification 本文が変わる（byte-identical でない）", () => {
    const pii = buildArtifactForStep(
      runInput(withStructured({ dataSensitivity: "personal-info", externalDependency: "none" })),
      "j3-design",
    );
    const pub = buildArtifactForStep(
      runInput(withStructured({ dataSensitivity: "public", externalDependency: "none" })),
      "j3-design",
    );
    const piiClass = pii.items.find((i) => i.itemId.startsWith("data-classification-"));
    const pubClass = pub.items.find((i) => i.itemId.startsWith("data-classification-"));
    expect(piiClass).toBeDefined();
    expect(pubClass).toBeDefined();
    // externalDependency=none でも data classification 本文が異なる（grounding が効く）。
    expect(piiClass!.bodyKey).not.toBe(pubClass!.bodyKey);
  });

  it("C3: Public + 外部依存だけでは PII 越境 security defect にしない", () => {
    const defects = buildDefectSet(withStructured({ dataSensitivity: "public", externalDependency: "heavy" }));
    expect(defects.some((d) => d.defectId === "d-j3-security-violation")).toBe(false);
  });

  it("C4: PII + 外部送信は security defect のまま", () => {
    const defects = buildDefectSet(withStructured({ dataSensitivity: "personal-info", externalDependency: "heavy" }));
    expect(defects.some((d) => d.defectId === "d-j3-security-violation")).toBe(true);
  });

  it("C: PII vs Public で finding validity（security defect の有無）が変わる（外部送信あり時）", () => {
    const piiDefects = buildDefectSet(withStructured({ dataSensitivity: "personal-info", externalDependency: "some" }));
    const pubDefects = buildDefectSet(withStructured({ dataSensitivity: "public", externalDependency: "some" }));
    const piiHasSec = piiDefects.some((d) => d.defectId === "d-j3-security-violation");
    const pubHasSec = pubDefects.some((d) => d.defectId === "d-j3-security-violation");
    expect(piiHasSec).toBe(true);
    expect(pubHasSec).toBe(false);
  });
});

// ============================================================
// Parameter Contract — 各 dimension が宣言どおり observable
// ============================================================
describe("RC6 Parameter Contract — every structured dimension has an observable effect", () => {
  it("matrix は全 structured dimension を網羅する", () => {
    const covered = new Set(PARAMETER_SENSITIVITY_MATRIX.map((m) => m.fieldId));
    for (const f of STRUCTURED_INPUT_FIELD_IDS) {
      expect(covered.has(f)).toBe(true);
    }
  });

  it("各 dimension は channels が空でない（UI 宣言との矛盾を禁じる）", () => {
    for (const m of PARAMETER_SENSITIVITY_MATRIX) {
      expect(m.channels.length).toBeGreaterThan(0);
      expect(m.contrastPair[0]).not.toBe(m.contrastPair[1]);
    }
  });

  it("defect-activation channel の dimension: contrast pair で defect 集合が変わる", () => {
    for (const m of PARAMETER_SENSITIVITY_MATRIX) {
      if (!m.channels.includes("defect-activation")) continue;
      const a = buildDefectSet(withStructured({ [m.fieldId]: m.contrastPair[0] } as Partial<StructuredControlInput>));
      const b = buildDefectSet(withStructured({ [m.fieldId]: m.contrastPair[1] } as Partial<StructuredControlInput>));
      const idsA = a.map((d) => d.defectId).sort().join(",");
      const idsB = b.map((d) => d.defectId).sort().join(",");
      expect(idsA).not.toBe(idsB);
    }
  });

  it("context-grounding channel の dimension: contrast pair で artifact の grounding 本文が変わる", () => {
    for (const m of PARAMETER_SENSITIVITY_MATRIX) {
      if (!m.channels.includes("context-grounding")) continue;
      const artA = buildArtifactForStep(
        runInput(withStructured({ [m.fieldId]: m.contrastPair[0] } as Partial<StructuredControlInput>)),
        "j3-design",
      );
      const artB = buildArtifactForStep(
        runInput(withStructured({ [m.fieldId]: m.contrastPair[1] } as Partial<StructuredControlInput>)),
        "j3-design",
      );
      const groundingA = artA.items.filter((i) => i.reviewability === "informational").map((i) => i.bodyKey).join("|");
      const groundingB = artB.items.filter((i) => i.reviewability === "informational").map((i) => i.bodyKey).join("|");
      expect(groundingA).not.toBe(groundingB);
    }
  });

  it("accepted-fact channel の dimension: contrast pair で accepted fact の有無が変わる", () => {
    for (const m of PARAMETER_SENSITIVITY_MATRIX) {
      if (!m.channels.includes("accepted-fact")) continue;
      const factsA = deriveAcceptedUpstreamFacts(withStructured({ [m.fieldId]: m.contrastPair[0] } as Partial<StructuredControlInput>));
      const factsB = deriveAcceptedUpstreamFacts(withStructured({ [m.fieldId]: m.contrastPair[1] } as Partial<StructuredControlInput>));
      expect(factsA.length).not.toBe(factsB.length);
    }
  });
});

// ============================================================
// EffectiveScenarioState — single derived model の整合
// ============================================================
describe("RC6 — EffectiveScenarioState aggregates the same state for all consumers", () => {
  it("同じ structured + conditions → 同じ EffectiveScenarioState（決定的）", () => {
    const structured = withStructured({ availability: "high", dataSensitivity: "personal-info" });
    const a = buildEffectiveScenarioState({ structured, conditionalApprovals: [] });
    const b = buildEffectiveScenarioState({ structured, conditionalApprovals: [] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.acceptedUpstreamFacts.some((f) => f.factId === "availability-target")).toBe(true);
    expect(a.dataSensitivityGrounding.piiBoundaryActive).toBe(true);
  });
});
