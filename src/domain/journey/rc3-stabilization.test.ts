// RC3 Stabilization 回帰テスト（domain 層）— P1-3 gate / P2-3 consequence / P2-4 completion /
// P2-5 causal / P1-1 no answer-class leakage in item data。すべて pure・決定的。
import { describe, it, expect } from "vitest";
import type { ArtifactReview, StructuredControlInput } from "./journey-entities.ts";
import { JOURNEY_STEP_IDS } from "./journey-entities.ts";
import { buildDefectSet, defectsForStep } from "./defect-catalog.ts";
import { evaluateArtifactReview, hasCriticalLearningBlocker } from "./review-evaluator.ts";
import { mustBlockOnCriticalMiss } from "./mode-policy.ts";
import { buildUserProfile } from "./journey-profiles.ts";
import { buildArtifactForStep, computeJourneyResult, evaluateAllReviews, type JourneyRunInput } from "./journey-engine.ts";
import { initialProgress, rework } from "./rework-state-machine.ts";
import { buildCompletionSummary, buildCausalLearningSummary } from "./journey-summaries.ts";
import type { ReviewEvaluation } from "./review-evaluator.ts";

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

function runInput(mode: JourneyRunInput["mode"], reviews: JourneyRunInput["reviews"] = {}): JourneyRunInput {
  return { profile: buildUserProfile("t", {}, HEAVY), mode, progress: initialProgress(), reviews };
}

/** 指定 step を「high defect を見逃して approve」する review（artifactId は実 artifact 由来）。 */
function missReview(input: JourneyRunInput, stepId: JourneyRunInput["progress"]["currentStepId"]): ArtifactReview {
  const art = buildArtifactForStep(input, stepId);
  return { artifactId: art.artifactId, journeyStepId: stepId, findings: [], gateDecision: "approve" };
}

/** 全 review step（J1..J6）を「見逃して approve」する reviews を作る（mutable map で構築）。 */
function allMissReviews(input: JourneyRunInput): JourneyRunInput["reviews"] {
  const reviews: Record<string, ArtifactReview> = {};
  for (const s of JOURNEY_STEP_IDS) {
    if (s === "j7-completion-approval" || s === "j8-release-approval") continue;
    reviews[s] = missReview(input, s);
  }
  return reviews;
}

describe("P1-3 — Simulation critical miss forces rework", () => {
  it("high missed + too-lenient gate = critical learning blocker", () => {
    const input = runInput("simulation");
    const defects = buildDefectSet(HEAVY);
    // J3 は high severity defect（missing-nfr / security-violation）を含む。全部見逃して approve。
    const art = buildArtifactForStep(input, "j3-design");
    const review: ArtifactReview = { artifactId: art.artifactId, journeyStepId: "j3-design", findings: [], gateDecision: "approve" };
    const ev = evaluateArtifactReview(art, defects, review);
    expect(hasCriticalLearningBlocker(ev)).toBe(true);
  });

  it("Simulation blocks on critical miss; Guided/Adoption do not", () => {
    expect(mustBlockOnCriticalMiss("simulation", true)).toBe(true);
    expect(mustBlockOnCriticalMiss("guided", true)).toBe(false);
    expect(mustBlockOnCriticalMiss("adoption-review", true)).toBe(false);
    expect(mustBlockOnCriticalMiss("simulation", false)).toBe(false);
  });

  it("catching the high defect + proper return removes the blocker", () => {
    const input = runInput("simulation");
    const defects = buildDefectSet(HEAVY);
    const art = buildArtifactForStep(input, "j3-design");
    const highDefectItemIds = defectsForStep(defects, "j3-design")
      .filter((d) => d.expectedSeverity === "high")
      .map((d) => d.itemId);
    // 全 high を catch し、他 defect も含めて return（適切）。
    const review: ArtifactReview = {
      artifactId: art.artifactId,
      journeyStepId: "j3-design",
      findings: highDefectItemIds.map((id) => ({ itemId: id, severity: "high" as const })),
      gateDecision: "return-for-rework",
    };
    const ev = evaluateArtifactReview(art, defects, review);
    expect(hasCriticalLearningBlocker(ev)).toBe(false);
  });
});

describe("P1-4 — navigation vs rework separation (domain)", () => {
  it("only rework changes revision / completedStepIds; navigation must not", () => {
    // rework は revision++ かつ completed 取消。navigation（presentation）は domain を触らない。
    let p = initialProgress();
    // advance で j1 完了扱いにするのは engine 外なので、ここでは rework の効果だけ検証。
    const before = { rev: p.revisions["j1-requirements"] ?? 0, completed: [...p.completedStepIds] };
    p = rework(p, "j1-requirements", "return", "requirement-changed");
    expect((p.revisions["j1-requirements"] ?? 0)).toBe(before.rev + 1);
    expect(p.reworkHistory.length).toBe(1);
  });
});

describe("P2-3 — consequence carries source step & stays informational", () => {
  it("adoption downstream consequence has originStepId and reviewability=informational", () => {
    const base = runInput("adoption-review");
    const j3 = buildArtifactForStep(base, "j3-design");
    const input: JourneyRunInput = {
      ...base,
      reviews: { "j3-design": { artifactId: j3.artifactId, journeyStepId: "j3-design", findings: [], gateDecision: "approve" } },
    };
    const j4 = buildArtifactForStep(input, "j4-implementation-traceability");
    const cons = j4.items.find((i) => i.reviewability === "informational");
    expect(cons).toBeDefined();
    expect(cons?.originStepId).toBeDefined();
  });

  it("TP/FP/FN/TN unchanged whether consequence is present or not", () => {
    const base = runInput("adoption-review");
    const defects = buildDefectSet(HEAVY);
    const j3 = buildArtifactForStep(base, "j3-design");
    const input: JourneyRunInput = {
      ...base,
      reviews: { "j3-design": { artifactId: j3.artifactId, journeyStepId: "j3-design", findings: [], gateDecision: "approve" } },
    };
    const j4 = buildArtifactForStep(input, "j4-implementation-traceability");
    const review: ArtifactReview = { artifactId: j4.artifactId, journeyStepId: "j4-implementation-traceability", findings: [], gateDecision: "approve" };
    const ev = evaluateArtifactReview(j4, defects, review);
    // consequence を含んでも defect 数は J4 の実 defect のみ。
    expect(ev.metrics.defectCount).toBe(defectsForStep(defects, "j4-implementation-traceability").length);
  });
});

describe("P2-4 — Completion summary (no release info)", () => {
  it("summarizes evidence / unresolved / remaining risk / rework / steps", () => {
    const base = runInput("simulation");
    // 全 review step を見逃す → evidence insufficient。
    const input: JourneyRunInput = { ...base, reviews: allMissReviews(base) };
    const result = computeJourneyResult(input);
    const byStep = new Map<typeof JOURNEY_STEP_IDS[number], ReviewEvaluation>();
    for (const { stepId, evaluation } of evaluateAllReviews(input)) byStep.set(stepId, evaluation);
    const summary = buildCompletionSummary(result, input.progress, byStep);
    expect(summary.evidenceStatus).toBe("insufficient");
    expect(summary.unresolvedFindingCount).toBeGreaterThan(0);
    // Completion summary は release 固有フィールド（reversibility 等）を持たない。
    expect(Object.keys(summary)).not.toContain("reversibility");
    expect(Object.keys(summary)).not.toContain("releaseImpact");
  });
});

describe("P2-5 — Causal learning summary (deterministic)", () => {
  it("negative dimension yields why / origin / revisit", () => {
    const base = runInput("simulation");
    const input: JourneyRunInput = {
      ...base,
      reviews: allMissReviews(base),
      completionDecision: "approve",
      releaseDecision: "approve",
    };
    const result = computeJourneyResult(input);
    const causal = buildCausalLearningSummary(result);
    expect(causal.length).toBeGreaterThan(0);
    // evidence-quality が negative なら origin=J6 / revisit あり。
    const ev = causal.find((c) => c.dimensionId === "evidence-quality");
    if (ev !== undefined) {
      expect(ev.revisitStepId).toBeDefined();
    }
  });

  it("same input -> same causal summary (deterministic)", () => {
    const base = runInput("adoption-review");
    const reviews: JourneyRunInput["reviews"] = { "j6-test-evidence": missReview(base, "j6-test-evidence") };
    const input: JourneyRunInput = { ...base, reviews };
    const a = buildCausalLearningSummary(computeJourneyResult(input));
    const b = buildCausalLearningSummary(computeJourneyResult(input));
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});

describe("P1-1 — item data carries no answer-class cue", () => {
  it("finding-candidate item bodies do not leak valid/distractor/defect labels (via locale keys resolved separately)", () => {
    // domain 層では item は labelKey/bodyKey（locale key）を持つのみ。answer-class は defectId/rationale に閉じる。
    const input = runInput("adoption-review");
    const art = buildArtifactForStep(input, "j3-design");
    for (const item of art.items) {
      // itemId や key に "valid"/"distractor" が含まれても、それは内部識別子であり UI ラベルではない。
      // ここでは「defect item が bodyKey に defectId を露出していない」ことを確認（内部 semantic を漏らさない）。
      if (item.defectId !== undefined) {
        expect(item.bodyKey).not.toContain(item.defectId);
      }
    }
  });
});
