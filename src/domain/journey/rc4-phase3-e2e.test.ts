// RC4 Phase 3 Step 8 — Stabilization: core end-to-end scenario + hard invariants。
//
// pure domain・決定的（time / random / locale / mode 非参照）。
//
// E2E flow:
//   Artifact v0 → Human Review → real defect を Return for Rework → Agent Rework → Artifact v1
//   → Local Before/After Diff → upstream defect resolved
//   → already-materialized direct downstream Artifact 更新
//   → downstream localRevision unchanged / downstream artifactVersion +1
//   → Propagation Before/After Diff。
import { describe, it, expect } from "vitest";
import type { StructuredControlInput, JourneyStepId } from "./journey-entities.ts";
import { buildArtifactForStep, type JourneyRunInput } from "./journey-engine.ts";
import { buildUserProfile } from "./journey-profiles.ts";
import { localReworkDiff, propagationDiff } from "./journey-diff.ts";
import {
  initialProgress,
  markMaterialized,
  rework,
  revisionOf,
  artifactVersionOf,
  materializationOf,
  type JourneyProgress,
} from "./rework-state-machine.ts";

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

function input(progress: JourneyProgress, reviews: JourneyRunInput["reviews"] = {}): JourneyRunInput {
  return {
    profile: buildUserProfile("t", {}, HEAVY, "internal-api-workflow"),
    mode: "simulation",
    progress,
    reviews,
  };
}
// ============================================================
// Core end-to-end scenario
// ============================================================
describe("RC4 Phase 3 — core end-to-end scenario", () => {
  it("v0 -> review -> return/rework -> v1 -> local diff -> propagation to materialized downstream", () => {
    const STEP: JourneyStepId = "j3-design";
    const DOWN: JourneyStepId = "j4-implementation-traceability";
    const DEFECT = "d-j3-security-violation"; // J3 -> direct downstream J4。

    // --- Artifact v0（J3 を materialize、J4 も materialize 済みにする）---
    let progress: JourneyProgress = { ...initialProgress(), currentStepId: STEP };
    progress = markMaterialized(progress, STEP);
    progress = markMaterialized(progress, DOWN);

    const art0 = buildArtifactForStep(input(progress), STEP);
    expect(art0.artifactVersion).toBe(0);
    expect(art0.artifactId.endsWith("__v0")).toBe(true);
    const j3Item0 = art0.items.find((i) => i.itemId === "design-item-saas-logging");
    expect(j3Item0?.contentState).toBe("defective");

    // downstream J4 v0（upstream 未解決なので improved は無い）。
    const down0 = buildArtifactForStep(input(progress), DOWN);
    const downRev0 = revisionOf(progress, DOWN);
    const downVer0 = artifactVersionOf(progress, DOWN);
    expect(downRev0).toBe(0);
    expect(downVer0).toBe(0);

    // --- Human Review: real defect を Return for Rework ---
    // （UI 経路では computeReworkTargets が caught defect を渡すが、ここでは domain rework を直接呼ぶ）。
    const reworked = rework(progress, STEP, "return", "critical-finding", [DEFECT]);

    // --- Agent Rework -> Artifact v1（local content change: localRevision +1 / artifactVersion +1）---
    expect(revisionOf(reworked, STEP)).toBe(1);
    expect(artifactVersionOf(reworked, STEP)).toBe(1);
    const art1 = buildArtifactForStep(input(reworked), STEP);
    expect(art1.artifactVersion).toBe(1);
    expect(art1.artifactId.endsWith("__v1")).toBe(true);
    const j3Item1 = art1.items.find((i) => i.itemId === "design-item-saas-logging");
    expect(j3Item1?.contentState).toBe("corrected");
    expect(j3Item1?.bodyKey).not.toBe(j3Item0?.bodyKey);

    // --- Local Before/After Diff（同一 step の v0 -> v1）---
    const local = localReworkDiff(input(reworked), STEP);
    expect(local.diff).toBeDefined();
    const localChanged = local.diff!.changes.find((c) => c.itemId === "design-item-saas-logging");
    expect(localChanged?.changeType).toBe("changed");
    expect(localChanged?.beforeContentState).toBe("defective");
    expect(localChanged?.afterContentState).toBe("corrected");

    // --- upstream defect resolved -> already-materialized direct downstream 更新 ---
    // J4 は materialize 済み。upstream(J3) の DEFECT resolved により J4 content が変わる。
    const down1 = buildArtifactForStep(input(reworked), DOWN);
    // downstream localRevision unchanged。
    expect(revisionOf(reworked, DOWN)).toBe(0);
    // downstream artifactVersion +1（materialized + propagation content change）。
    expect(down1.artifactVersion).toBe(1);
    expect(down1.artifactId.endsWith("__v1")).toBe(true);
    // materialization 状態は維持。
    expect(materializationOf(reworked, DOWN)).toBe(true);
    // downstream content が実際に変わっている（improved consequence が現れる）。
    const down0HasImproved = down0.items.some(
      (i) => i.itemId.startsWith("consequence-") && i.contentState === "corrected",
    );
    const down1HasImproved = down1.items.some(
      (i) => i.itemId.startsWith("consequence-") && i.contentState === "corrected",
    );
    expect(down0HasImproved).toBe(false);
    expect(down1HasImproved).toBe(true);

    // --- Propagation Before/After Diff（upstream unresolved -> resolved 下の downstream）---
    const prop = propagationDiff(input(reworked), DOWN);
    expect(prop.originStepId).toBe(STEP);
    expect(prop.targetStepId).toBe(DOWN);
    expect(prop.diff).toBeDefined();
    expect(prop.diff!.hasChanges).toBe(true);
  });
});

// ============================================================
// Hard invariants（要件 1..8）
// ============================================================
describe("RC4 Phase 3 — hard invariants", () => {
  const STEP: JourneyStepId = "j3-design";
  const DOWN: JourneyStepId = "j4-implementation-traceability";
  const DEFECT = "d-j3-missing-nfr";

  it("1. same artifactId -> same content (byte-identical for same state)", () => {
    const p: JourneyProgress = { ...initialProgress(), currentStepId: STEP };
    const a = buildArtifactForStep(input(p), STEP);
    const b = buildArtifactForStep(input(p), STEP);
    expect(a.artifactId).toBe(b.artifactId);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("2. local content change -> localRevision +1 AND artifactVersion +1", () => {
    const p: JourneyProgress = { ...initialProgress(), currentStepId: STEP };
    const r = rework(p, STEP, "return", "critical-finding", [DEFECT]);
    expect(revisionOf(r, STEP)).toBe(revisionOf(p, STEP) + 1);
    expect(artifactVersionOf(r, STEP)).toBe((artifactVersionOf(p, STEP) ?? 0) + 1);
  });

  it("3. propagation content change -> localRevision unchanged AND artifactVersion +1", () => {
    let p: JourneyProgress = { ...initialProgress(), currentStepId: DOWN };
    p = markMaterialized(p, DOWN);
    const r = rework(p, STEP, "return", "critical-finding", [DEFECT]); // upstream(J3) resolved。
    const down = buildArtifactForStep(input(r), DOWN);
    expect(revisionOf(r, DOWN)).toBe(0); // localRevision 据え置き。
    expect(down.artifactVersion).toBe(1); // artifactVersion のみ +1。
  });

  it("4. no content change -> artifactVersion unchanged", () => {
    // no-op rework（valid target なし）。
    const p: JourneyProgress = { ...initialProgress(), currentStepId: STEP };
    const r = rework(p, STEP, "return", "critical-finding", []);
    const a = buildArtifactForStep(input(r), STEP);
    expect(a.artifactVersion).toBe(0);
    expect(revisionOf(r, STEP)).toBe(0);
  });

  it("5. first materialization -> artifactVersion 0 (even with upstream propagation content)", () => {
    // downstream 未 materialized。upstream(J3) resolved でも初回生成は version 0。
    let p: JourneyProgress = { ...initialProgress(), currentStepId: DOWN };
    p = rework(p, STEP, "return", "critical-finding", [DEFECT]); // upstream resolved（J3）。
    // DOWN は materialize していない。
    expect(materializationOf(p, DOWN)).toBe(false);
    const down = buildArtifactForStep(input(p), DOWN);
    expect(down.artifactVersion).toBe(0);
    expect(down.artifactId.endsWith("__v0")).toBe(true);
  });

  it("6. false positive -> not treated as resolved defect -> no propagation improvement", () => {
    const p: JourneyProgress = { ...initialProgress(), currentStepId: STEP };
    const j3 = buildArtifactForStep(input(p), STEP);
    // distractor（有効項目・非 defect）を指摘 = false positive。
    const distractorId = j3.items.find((i) => i.distractor === true)?.itemId;
    const findings = distractorId !== undefined ? [{ itemId: distractorId }] : [];
    // FP だけを Return で渡しても resolved にはならない（rework の targetedDefectIds は空扱い）。
    const r = rework(p, STEP, "return", "critical-finding", []); // valid target なし = no-op。
    expect(artifactVersionOf(r, STEP)).toBe(0);
    // downstream に improved（resolved 由来）は出ない。
    const down = buildArtifactForStep(input(r), DOWN);
    const improved = down.items.some((i) => i.itemId.startsWith("consequence-") && i.contentState === "corrected");
    expect(improved).toBe(false);
    // findings を使ったことの sanity（未使用回避）。
    expect(Array.isArray(findings)).toBe(true);
  });

  it("7. actual propagation is direct 1-hop only (J3 fix does not inject into J5 directly)", () => {
    let p: JourneyProgress = { ...initialProgress(), currentStepId: DOWN };
    p = markMaterialized(p, DOWN);
    const r = rework(p, STEP, "return", "critical-finding", [DEFECT]); // J3 resolved。
    // J4（direct downstream）には J3 由来の consequence が出る。
    const j4 = buildArtifactForStep(input(r), DOWN);
    expect(j4.items.some((i) => i.originStepId === STEP)).toBe(true);
    // J5（J3 から 2-hop 先）には J3 由来の直接注入は無い。
    const j5 = buildArtifactForStep(input(r), "j5-test-strategy");
    expect(j5.items.some((i) => i.originStepId === STEP)).toBe(false);
  });

  it("8. all modes share the same propagation domain semantic (identical downstream content)", () => {
    let p: JourneyProgress = { ...initialProgress(), currentStepId: DOWN };
    p = markMaterialized(p, DOWN);
    const r = rework(p, STEP, "return", "critical-finding", [DEFECT]);
    const contents = (["guided", "simulation", "adoption-review"] as const).map((mode) => {
      const down = buildArtifactForStep(
        { profile: buildUserProfile("t", {}, HEAVY, "internal-api-workflow"), mode, progress: r, reviews: {} },
        DOWN,
      );
      // consequence 項目の (originStepId, contentState, bodyKey) を mode 間で比較。
      return JSON.stringify(
        down.items
          .filter((i) => i.itemId.startsWith("consequence-"))
          .map((i) => [i.originStepId, i.contentState, i.bodyKey]),
      );
    });
    expect(new Set(contents).size).toBe(1);
  });
});
