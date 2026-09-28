// RC3 Final Stabilization — domain 回帰テスト（feedback view model / learning traceability）。
import { describe, it, expect } from "vitest";
import type { ArtifactReview, StructuredControlInput } from "./journey-entities.ts";
import { buildDefectSet, defectsForStep } from "./defect-catalog.ts";
import { buildArtifactForStep, type JourneyRunInput } from "./journey-engine.ts";
import { evaluateArtifactReview } from "./review-evaluator.ts";
import { buildFeedbackViewModel } from "./feedback-viewmodel.ts";
import { buildUserProfile } from "./journey-profiles.ts";
import { initialProgress } from "./rework-state-machine.ts";

const HEAVY: StructuredControlInput = {
  workload: "data-heavy",
  dataSensitivity: "personal-info",
  availability: "critical",
  externalDependency: "heavy",
  operationalCriticality: "high",
  releaseImpact: "high",
  reversibility: "irreversible",
  approvalRequirement: "committee",
};

function input(): JourneyRunInput {
  return { profile: buildUserProfile("t", {}, HEAVY), mode: "simulation", progress: initialProgress(), reviews: {} };
}

// 1. false positive feedback に internal ID が出ない（view model は locale key のみ）
describe("Feedback view model — no internal IDs (P1-1 H2/H4)", () => {
  it("caught/missed/false items expose locale keys, never itemId/defectId/artifactId", () => {
    const inp = input();
    const defects = buildDefectSet(HEAVY);
    const art = buildArtifactForStep(inp, "j3-design");
    const defectIds = art.items.filter((i) => i.defectId !== undefined).map((i) => i.itemId);
    const distractor = art.items.find((i) => i.distractor === true)?.itemId as string;
    const review: ArtifactReview = {
      artifactId: art.artifactId,
      journeyStepId: "j3-design",
      findings: [{ itemId: defectIds[0] as string }, { itemId: distractor }],
      gateDecision: "approve",
    };
    const ev = evaluateArtifactReview(art, defects, review);
    const vm = buildFeedbackViewModel(art, defects, ev);
    const all = [...vm.caught, ...vm.missed, ...vm.falsePositives];
    for (const f of all) {
      // すべて locale key（rc3.item.* / rc3.defect.*）または undefined。生 ID や artifactId を含まない。
      expect(f.itemTitleKey).not.toContain(art.artifactId);
      expect(f.itemTitleKey).not.toMatch(/^art__/);
      expect(f.itemTitleKey).not.toMatch(/^d-j/); // defectId prefix
      expect(f.itemTitleKey.startsWith("rc3.")).toBe(true);
      expect(f.itemBodyKey.startsWith("rc3.")).toBe(true);
    }
  });

  // 2,3. caught / missed に title/body/severity
  it("caught & missed carry itemTitle / itemBody / severity", () => {
    const inp = input();
    const defects = buildDefectSet(HEAVY);
    const art = buildArtifactForStep(inp, "j3-design");
    const highDefect = defectsForStep(defects, "j3-design").find((d) => d.expectedSeverity === "high")!;
    const review: ArtifactReview = {
      artifactId: art.artifactId,
      journeyStepId: "j3-design",
      findings: [{ itemId: highDefect.itemId, severity: "high" }],
      gateDecision: "return-for-rework",
    };
    const vm = buildFeedbackViewModel(art, defects, evaluateArtifactReview(art, defects, review));
    const caught = vm.caught.find((c) => c.severity === "high");
    expect(caught).toBeDefined();
    expect(caught?.itemTitleKey).toBeTruthy();
    expect(caught?.itemBodyKey).toBeTruthy();
    expect(caught?.whyItMattersKey).toBeTruthy();
  });

  // 4. feedback item が source artifact item と一致
  it("feedback item titleKey matches the source artifact item labelKey (1:1)", () => {
    const inp = input();
    const defects = buildDefectSet(HEAVY);
    const art = buildArtifactForStep(inp, "j3-design");
    const review: ArtifactReview = {
      artifactId: art.artifactId,
      journeyStepId: "j3-design",
      findings: [],
      gateDecision: "approve",
    };
    const vm = buildFeedbackViewModel(art, defects, evaluateArtifactReview(art, defects, review));
    // すべての missed の titleKey は artifact 内のいずれかの item.labelKey と一致する。
    const labelKeys = new Set(art.items.map((i) => i.labelKey));
    for (const m of vm.missed) expect(labelKeys.has(m.itemTitleKey)).toBe(true);
  });

  // 7. consequence origin / affected step
  it("missed defect with downstream manifestation exposes origin & affected step", () => {
    const inp = input();
    const defects = buildDefectSet(HEAVY);
    const art = buildArtifactForStep(inp, "j3-design");
    const review: ArtifactReview = {
      artifactId: art.artifactId,
      journeyStepId: "j3-design",
      findings: [],
      gateDecision: "approve",
    };
    const vm = buildFeedbackViewModel(art, defects, evaluateArtifactReview(art, defects, review));
    const withDownstream = vm.missed.find((m) => m.affectedLaterStepId !== undefined);
    expect(withDownstream).toBeDefined();
    expect(withDownstream?.originStepId).toBe("j3-design");
  });
});
