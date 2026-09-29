// Phase A domain foundation tests — 決定性 / defect injection / review 評価 / consequence /
// rework / mode 不変 Ground Truth / DimensionEffectAdapter。すべて pure・決定的。
import { describe, it, expect } from "vitest";
import type { ArtifactReview, StructuredControlInput } from "./journey-entities.ts";
import { JOURNEY_STEP_IDS } from "./journey-entities.ts";
import { buildDefectSet, defectsForStep } from "./defect-catalog.ts";
import { evaluateArtifactReview, judgeGateQuality } from "./review-evaluator.ts";
import { CANONICAL_SAMPLE_PROFILE, buildUserProfile } from "./journey-profiles.ts";
import {
  buildArtifactForStep,
  computeJourneyResult,
  evaluateAllReviews,
  type JourneyRunInput,
} from "./journey-engine.ts";
import { initialProgress, rework, advance, revisionOf, isJourneyComplete } from "./rework-state-machine.ts";

const CLEAN_INPUT: StructuredControlInput = {
  workload: "cpu-bound",
  dataSensitivity: "public",
  availability: "best-effort",
  externalDependency: "none",
  operationalCriticality: "low",
  releaseImpact: "low",
  reversibility: "reversible",
  approvalRequirement: "single",
};

const HEAVY_INPUT: StructuredControlInput = {
  workload: "data-heavy",
  dataSensitivity: "personal-info",
  availability: "critical",
  externalDependency: "heavy",
  operationalCriticality: "high",
  releaseImpact: "high",
  reversibility: "irreversible",
  approvalRequirement: "committee",
};

function baseInput(structured: StructuredControlInput, reviews: JourneyRunInput["reviews"] = {}): JourneyRunInput {
  return {
    profile: buildUserProfile("test", {}, structured),
    mode: "simulation",
    progress: initialProgress(),
    reviews,
  };
}

describe("Determinism", () => {
  it("same structured input -> same defect set", () => {
    const a = buildDefectSet(HEAVY_INPUT);
    const b = buildDefectSet(HEAVY_INPUT);
    expect(a.map((d) => d.defectId)).toEqual(b.map((d) => d.defectId));
  });

  it("same input -> byte-identical generated artifact", () => {
    const input = baseInput(HEAVY_INPUT);
    const a = buildArtifactForStep(input, "j3-design");
    const b = buildArtifactForStep(input, "j3-design");
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("same input -> same journey result", () => {
    const profile = buildUserProfile("test", {}, HEAVY_INPUT);
    const reviews = allEmptyReviews(profile);
    const input: JourneyRunInput = { profile, mode: "simulation", progress: initialProgress(), reviews };
    const a = computeJourneyResult(input);
    const b = computeJourneyResult(input);
    expect(JSON.stringify(a.dimensionOutcomes)).toEqual(JSON.stringify(b.dimensionOutcomes));
  });
});

describe("Defect injection (clean / distractor / no-defect)", () => {
  it("clean input yields fewer defects; some steps have no defect", () => {
    const clean = buildDefectSet(CLEAN_INPUT);
    const heavy = buildDefectSet(HEAVY_INPUT);
    expect(clean.length).toBeLessThan(heavy.length);
    // clean では J3 の security-violation / missing-nfr / unsafe-delegation が発火しない。
    expect(defectsForStep(clean, "j3-design").length).toBe(0);
  });

  it("artifact always includes at least one distractor where defined and marks defects", () => {
    const input = baseInput(HEAVY_INPUT);
    const art = buildArtifactForStep(input, "j3-design");
    expect(art.items.some((i) => i.distractor === true)).toBe(true);
    expect(art.items.some((i) => i.defectId !== undefined)).toBe(true);
  });

  it("a clean step artifact has zero defect items (no forced finding)", () => {
    const input = baseInput(CLEAN_INPUT);
    const art = buildArtifactForStep(input, "j3-design");
    expect(art.items.some((i) => i.defectId !== undefined)).toBe(false);
  });
});

describe("Review evaluation (TP/FP/FN, gate)", () => {
  it("catches, misses and false-flags correctly", () => {
    const defects = buildDefectSet(HEAVY_INPUT);
    const input = baseInput(HEAVY_INPUT);
    const art = buildArtifactForStep(input, "j3-design");
    const defectItemIds = art.items.filter((i) => i.defectId !== undefined).map((i) => i.itemId);
    const distractorId = art.items.find((i) => i.distractor === true)?.itemId as string;

    // 1 つ catch、残り miss、distractor を誤指摘（false）。
    const review: ArtifactReview = {
      artifactId: art.artifactId,
      journeyStepId: "j3-design",
      findings: [{ itemId: defectItemIds[0] as string }, { itemId: distractorId }],
      gateDecision: "approve",
    };
    const ev = evaluateArtifactReview(art, defects, review);
    expect(ev.metrics.truePositives).toBe(1);
    expect(ev.metrics.falsePositives).toBe(1);
    expect(ev.metrics.falseNegatives).toBe(defectItemIds.length - 1);
    // 未解決 defect を残して approve -> too-lenient。
    expect(ev.gateQuality).toBe("too-lenient");
  });

  it("clean artifact + approve with no findings -> sound gate, coverage 1", () => {
    const defects = buildDefectSet(CLEAN_INPUT);
    const input = baseInput(CLEAN_INPUT);
    const art = buildArtifactForStep(input, "j3-design");
    const review: ArtifactReview = {
      artifactId: art.artifactId,
      journeyStepId: "j3-design",
      findings: [],
      gateDecision: "approve",
    };
    const ev = evaluateArtifactReview(art, defects, review);
    expect(ev.hadDefects).toBe(false);
    expect(ev.metrics.reviewCoverage).toBe(1);
    expect(ev.gateQuality).toBe("sound");
  });

  it("blocking a clean artifact is too-strict", () => {
    const defects = buildDefectSet(CLEAN_INPUT);
    const input = baseInput(CLEAN_INPUT);
    const art = buildArtifactForStep(input, "j3-design");
    const review: ArtifactReview = {
      artifactId: art.artifactId,
      journeyStepId: "j3-design",
      findings: [],
      gateDecision: "block",
    };
    expect(evaluateArtifactReview(art, defects, review).gateQuality).toBe("too-strict");
  });
});

describe("Mode-invariant Ground Truth", () => {
  it("defect set does not depend on mode", () => {
    const profile = buildUserProfile("t", {}, HEAVY_INPUT);
    const g = buildDefectSet(profile.context.structured, profile.profileDefectRules);
    // mode を変えても buildDefectSet は mode を受け取らない = 不変。
    const modes = ["guided", "simulation", "adoption-review"] as const;
    for (const _m of modes) {
      expect(buildDefectSet(profile.context.structured, profile.profileDefectRules).map((d) => d.defectId)).toEqual(
        g.map((d) => d.defectId),
      );
    }
  });
});

describe("Consequence propagation (Adoption)", () => {
  it("missed defect with downstream manifestation appears in later artifact only in adoption", () => {
    // J3 の security-violation を見逃す review を用意（HEAVY で有効）。
    const defects = buildDefectSet(HEAVY_INPUT);
    const j3Defect = defectsForStep(defects, "j3-design").find(
      (d) => d.downstreamManifestation?.atStepId === "j4-implementation-traceability",
    );
    expect(j3Defect).toBeDefined();

    const adoptionBase: JourneyRunInput = {
      profile: buildUserProfile("t", {}, HEAVY_INPUT),
      mode: "adoption-review",
      progress: initialProgress(),
      reviews: {},
    };
    // J3 のすべての defect を見逃す review（artifactId は実 artifact から取得・FIX 3）。
    const j3Artifact = buildArtifactForStep(adoptionBase, "j3-design");
    const reviews: JourneyRunInput["reviews"] = {
      "j3-design": {
        artifactId: j3Artifact.artifactId,
        journeyStepId: "j3-design",
        findings: [],
        gateDecision: "approve",
      },
    };
    const adoption: JourneyRunInput = { ...adoptionBase, reviews };
    const simulation: JourneyRunInput = { ...adoption, mode: "simulation" };

    const j4Adoption = buildArtifactForStep(adoption, "j4-implementation-traceability");
    const j4Simulation = buildArtifactForStep(simulation, "j4-implementation-traceability");

    const hasConsequence = (a: typeof j4Adoption): boolean =>
      a.items.some((i) => i.itemId.startsWith("consequence-"));
    expect(hasConsequence(j4Adoption)).toBe(true); // 伝播する
    expect(hasConsequence(j4Simulation)).toBe(false); // 伝播しない
  });

  it("journey result records consequences from missed findings", () => {
    const base: JourneyRunInput = {
      profile: buildUserProfile("t", {}, HEAVY_INPUT),
      mode: "adoption-review",
      progress: initialProgress(),
      reviews: {},
    };
    const j3Artifact = buildArtifactForStep(base, "j3-design");
    const input: JourneyRunInput = {
      ...base,
      reviews: {
        "j3-design": {
          artifactId: j3Artifact.artifactId,
          journeyStepId: "j3-design",
          findings: [],
          gateDecision: "approve",
        },
      },
    };
    const result = computeJourneyResult(input);
    expect(result.consequences.length).toBeGreaterThan(0);
    expect(result.totalMissed).toBeGreaterThan(0);
  });
});

describe("Rework state machine", () => {
  it("return -> revision increment -> re-review, completed after target cleared", () => {
    let p = initialProgress();
    p = advance(p); // j1 approved -> j2
    p = advance(p); // j2 approved -> j3
    expect(p.completedStepIds).toContain("j1-requirements");
    expect(p.currentStepId).toBe("j3-design");

    // j3 で critical finding -> j1 へ return。
    // RC4 Phase 2: revision は content change（valid target 解決）時のみ増える → valid target を渡す。
    p = rework(p, "j1-requirements", "return", "critical-finding", ["d-j1-req-omission"]);
    expect(p.currentStepId).toBe("j1-requirements");
    expect(revisionOf(p, "j1-requirements")).toBe(1);
    // j1 以降の completed は取り消される。
    expect(p.completedStepIds).not.toContain("j1-requirements");
    expect(p.reworkHistory.length).toBe(1);
    expect(p.reworkHistory[0]?.trigger).toBe("critical-finding");
  });

  it("cannot rework to a future step (no-op)", () => {
    const p = initialProgress(); // at j1
    const after = rework(p, "j3-design", "return", "scope-changed");
    expect(after).toBe(p); // no-op
  });

  it("isJourneyComplete only when all steps completed", () => {
    let p = initialProgress();
    expect(isJourneyComplete(p)).toBe(false);
    for (const _ of JOURNEY_STEP_IDS) p = advance(p);
    expect(isJourneyComplete(p)).toBe(true);
  });
});

describe("Completion != Release (approval effects)", () => {
  it("conflating completion into release penalizes approval-boundary", () => {
    const profile = buildUserProfile("t", {}, HEAVY_INPUT);
    const reviews = allEmptyReviews(profile);
    const input: JourneyRunInput = {
      profile,
      mode: "simulation",
      progress: initialProgress(),
      reviews,
      completionDecision: "approve",
      releaseDecision: "approve",
      releaseConflatedWithCompletion: true,
    };
    const result = computeJourneyResult(input);
    const ab = result.dimensionOutcomes.find((d) => d.dimensionId === "approval-boundary");
    expect(ab).toBeDefined();
    expect(["strong-negative", "negative"]).toContain(ab?.level);
  });
});

describe("Canonical sample profile (Guided)", () => {
  it("activates the teaching defects (security / nfr / evidence)", () => {
    const defects = buildDefectSet(
      CANONICAL_SAMPLE_PROFILE.context.structured,
      CANONICAL_SAMPLE_PROFILE.profileDefectRules,
    );
    const ids = defects.map((d) => d.defectId);
    expect(ids).toContain("d-j3-security-violation");
    expect(ids).toContain("d-j3-missing-nfr");
    expect(ids).toContain("d-j6-insufficient-evidence");
  });
});

/** 全 step に「何も指摘せず approve」する review を作る（テスト補助・artifactId は実 artifact 由来）。 */
function allEmptyReviews(profile: ReturnType<typeof buildUserProfile>): JourneyRunInput["reviews"] {
  const base: JourneyRunInput = { profile, mode: "simulation", progress: initialProgress(), reviews: {} };
  const out: Record<string, ArtifactReview> = {};
  for (const s of JOURNEY_STEP_IDS) {
    if (s === "j7-completion-approval" || s === "j8-release-approval") continue;
    const artifact = buildArtifactForStep(base, s);
    out[s] = { artifactId: artifact.artifactId, journeyStepId: s, findings: [], gateDecision: "approve" };
  }
  return out;
}

// evaluateAllReviews が空 review を無視することの sanity。
describe("evaluateAllReviews", () => {
  it("ignores steps without a review", () => {
    const input = baseInput(HEAVY_INPUT, {});
    expect(evaluateAllReviews(input).length).toBe(0);
  });
});

// ===== FIX 1: consequence items must not be scored as FP/TN =====
describe("FIX 1 — consequence items are informational (not scored)", () => {
  function adoptionWithMissedJ3(): JourneyRunInput {
    const base: JourneyRunInput = {
      profile: buildUserProfile("t", {}, HEAVY_INPUT),
      mode: "adoption-review",
      progress: initialProgress(),
      reviews: {},
    };
    const j3 = buildArtifactForStep(base, "j3-design");
    return {
      ...base,
      reviews: {
        "j3-design": { artifactId: j3.artifactId, journeyStepId: "j3-design", findings: [], gateDecision: "approve" },
      },
    };
  }

  it("1. adoption consequence item exists in a later artifact", () => {
    const input = adoptionWithMissedJ3();
    const j4 = buildArtifactForStep(input, "j4-implementation-traceability");
    expect(j4.items.some((i) => i.itemId.startsWith("consequence-"))).toBe(true);
  });

  it("2. consequence item is reviewability=informational (not distractor)", () => {
    const input = adoptionWithMissedJ3();
    const j4 = buildArtifactForStep(input, "j4-implementation-traceability");
    const c = j4.items.find((i) => i.itemId.startsWith("consequence-"));
    expect(c?.reviewability).toBe("informational");
    expect(c?.distractor).toBeUndefined();
  });

  it("3. consequence does not increase TN, and 4. is not FP even if selected", () => {
    const input = adoptionWithMissedJ3();
    const defects = buildDefectSet(HEAVY_INPUT);
    const j4 = buildArtifactForStep(input, "j4-implementation-traceability");
    const consequence = j4.items.find((i) => i.itemId.startsWith("consequence-"))!;
    // consequence を「指摘」しても FP にならない。
    const review: ArtifactReview = {
      artifactId: j4.artifactId,
      journeyStepId: "j4-implementation-traceability",
      findings: [{ itemId: consequence.itemId }],
      gateDecision: "approve",
    };
    const ev = evaluateArtifactReview(j4, defects, review);
    // consequence は母集団外 → FP に数えない。
    expect(ev.falseItemIds).not.toContain(consequence.itemId);
    expect(ev.metrics.falsePositives).toBe(0);
    // TN 母集団にも入らない（consequence を除いた finding-candidate のみ）。
    const findingCandidates = j4.items.filter((i) => i.reviewability === "finding-candidate").length;
    expect(ev.metrics.truePositives + ev.metrics.falsePositives + ev.metrics.falseNegatives + ev.metrics.trueNegatives)
      .toBe(findingCandidates);
  });

  it("5. defect metrics unchanged (consequence presence does not shift defect counts)", () => {
    const input = adoptionWithMissedJ3();
    const defects = buildDefectSet(HEAVY_INPUT);
    const j4 = buildArtifactForStep(input, "j4-implementation-traceability");
    const emptyReview: ArtifactReview = {
      artifactId: j4.artifactId,
      journeyStepId: "j4-implementation-traceability",
      findings: [],
      gateDecision: "approve",
    };
    const ev = evaluateArtifactReview(j4, defects, emptyReview);
    // J4 の実 defect 数（consequence を含まない）。
    const j4Defects = defectsForStep(defects, "j4-implementation-traceability").length;
    expect(ev.metrics.defectCount).toBe(j4Defects);
  });
});

// ===== FIX 2: GateQuality clean + false positive =====
describe("FIX 2 — judgeGateQuality Ground-Truth based (A–E)", () => {
  it("A. defect 0 / findings 0 / approve -> sound", () => {
    expect(judgeGateQuality({ gate: "approve", defectCount: 0, caughtCount: 0, missedCount: 0, missedHighCount: 0, falseCount: 0 })).toBe("sound");
  });
  it("B. defect 0 / FP>0 / block -> too-strict", () => {
    expect(judgeGateQuality({ gate: "block", defectCount: 0, caughtCount: 0, missedCount: 0, missedHighCount: 0, falseCount: 2 })).toBe("too-strict");
  });
  it("C. defect 0 / FP>0 / return-for-rework -> too-strict", () => {
    expect(judgeGateQuality({ gate: "return-for-rework", defectCount: 0, caughtCount: 0, missedCount: 0, missedHighCount: 0, falseCount: 1 })).toBe("too-strict");
  });
  it("D. defect present / high unresolved / approve -> too-lenient", () => {
    expect(judgeGateQuality({ gate: "approve", defectCount: 2, caughtCount: 1, missedCount: 1, missedHighCount: 1, falseCount: 0 })).toBe("too-lenient");
  });
  it("E. defect caught / appropriate return -> sound", () => {
    expect(judgeGateQuality({ gate: "return-for-rework", defectCount: 2, caughtCount: 2, missedCount: 0, missedHighCount: 0, falseCount: 0 })).toBe("sound");
  });
  it("clean artifact end-to-end: block a clean artifact is too-strict", () => {
    const input = baseInput(CLEAN_INPUT);
    const defects = buildDefectSet(CLEAN_INPUT);
    const art = buildArtifactForStep(input, "j3-design");
    // clean な項目を誤指摘して block。
    const validItem = art.items.find((i) => i.reviewability === "finding-candidate")!;
    const review: ArtifactReview = {
      artifactId: art.artifactId,
      journeyStepId: "j3-design",
      findings: [{ itemId: validItem.itemId }],
      gateDecision: "block",
    };
    expect(evaluateArtifactReview(art, defects, review).gateQuality).toBe("too-strict");
  });
});

// ===== FIX 3: Review / Artifact revision + profile identity integrity =====
describe("FIX 3 — artifact identity + revision integrity", () => {
  it("1. same project + same step + same revision -> same artifactId", () => {
    const a = baseInput(HEAVY_INPUT);
    const b = baseInput(HEAVY_INPUT);
    expect(buildArtifactForStep(a, "j3-design").artifactId).toBe(buildArtifactForStep(b, "j3-design").artifactId);
  });

  it("2. different project/profile + same step/revision -> different artifactId", () => {
    const a = baseInput(HEAVY_INPUT);
    const b = baseInput(CLEAN_INPUT);
    expect(buildArtifactForStep(a, "j3-design").artifactId).not.toBe(
      buildArtifactForStep(b, "j3-design").artifactId,
    );
  });

  it("3. review r0 + artifact r0 -> valid", () => {
    const input = baseInput(HEAVY_INPUT);
    const defects = buildDefectSet(HEAVY_INPUT);
    const art = buildArtifactForStep(input, "j3-design");
    const review: ArtifactReview = { artifactId: art.artifactId, journeyStepId: "j3-design", findings: [], gateDecision: "approve" };
    expect(() => evaluateArtifactReview(art, defects, review)).not.toThrow();
  });

  it("4. rework creates r1 (revision increments)", () => {
    let p = initialProgress();
    p = advance(p);
    p = advance(p); // at j3
    // RC4 Phase 2: valid target 解決で revision++（Artifact Version 変化）。
    p = rework(p, "j1-requirements", "return", "critical-finding", ["d-j1-req-omission"]);
    expect(revisionOf(p, "j1-requirements")).toBe(1);
    // r1 の artifactId は r0 と異なる。
    const inputR0: JourneyRunInput = { profile: buildUserProfile("t", {}, HEAVY_INPUT), mode: "simulation", progress: initialProgress(), reviews: {} };
    const inputR1: JourneyRunInput = { ...inputR0, progress: p };
    expect(buildArtifactForStep(inputR0, "j1-requirements").artifactId).not.toBe(
      buildArtifactForStep(inputR1, "j1-requirements").artifactId,
    );
  });

  it("5. review r0 + artifact r1 -> reject (DomainInvariantError)", () => {
    const profile = buildUserProfile("t", {}, HEAVY_INPUT);
    const defects = buildDefectSet(HEAVY_INPUT);
    const r0Input: JourneyRunInput = { profile, mode: "simulation", progress: initialProgress(), reviews: {} };
    const r0Artifact = buildArtifactForStep(r0Input, "j1-requirements");
    const r0Review: ArtifactReview = { artifactId: r0Artifact.artifactId, journeyStepId: "j1-requirements", findings: [], gateDecision: "approve" };

    let p = initialProgress();
    p = rework(p, "j1-requirements", "return", "critical-finding", ["d-j1-req-omission"]); // r1
    const r1Input: JourneyRunInput = { profile, mode: "simulation", progress: p, reviews: {} };
    const r1Artifact = buildArtifactForStep(r1Input, "j1-requirements");
    expect(() => evaluateArtifactReview(r1Artifact, defects, r0Review)).toThrow();
  });

  it("6. review with wrong step -> reject", () => {
    const input = baseInput(HEAVY_INPUT);
    const defects = buildDefectSet(HEAVY_INPUT);
    const art = buildArtifactForStep(input, "j3-design");
    // journeyStepId を偽装（artifactId は正しくても step が食い違えば reject）。
    const badReview: ArtifactReview = { artifactId: art.artifactId, journeyStepId: "j2-acceptance-scope", findings: [], gateDecision: "approve" };
    expect(() => evaluateArtifactReview(art, defects, badReview)).toThrow();
  });

  it("7. after rework, only current-revision review is evaluated (engine uses current revision)", () => {
    const profile = buildUserProfile("t", {}, HEAVY_INPUT);
    let p = initialProgress();
    p = rework(p, "j1-requirements", "return", "requirement-changed", ["d-j1-req-omission"]); // j1 -> r1
    // 現在 revision (r1) の artifact に対する review を用意すれば評価される。
    const input: JourneyRunInput = { profile, mode: "simulation", progress: p, reviews: {} };
    const r1Artifact = buildArtifactForStep(input, "j1-requirements");
    const withReview: JourneyRunInput = {
      ...input,
      reviews: {
        "j1-requirements": { artifactId: r1Artifact.artifactId, journeyStepId: "j1-requirements", findings: [], gateDecision: "approve" },
      },
    };
    const evals = evaluateAllReviews(withReview);
    expect(evals.length).toBe(1);
    expect(evals[0]?.stepId).toBe("j1-requirements");
  });
});
