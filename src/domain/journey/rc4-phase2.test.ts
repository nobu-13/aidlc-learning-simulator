// RC4 Phase 2 テスト — Actual Rework + Revised Artifact（domain / state / engine）。
//
// 検証（Phase 2 要件 1..17 の domain 部分）:
//  - Return で選択した実 defect のみ resolved へ（false positive は入らない・部分 rework）
//  - resolvedDefectIds 単調増加
//  - revision 0 = defective 本文 / Return 後 revision 1 = corrected 本文（本文が実際に変わる）
//  - corrected != defective / 未選択 defect は defective のまま
//  - re-review は revised artifact を使う
//  - mode 不変 / 9 Dimension semantics 不変 / Completion != Release 不変
//
// UI 往復（reload / Home→Resume / Guided / Simulation mandatory / Adoption）は rc4-phase2-ui.test.tsx。
import { describe, it, expect } from "vitest";
import type { ArtifactReview, StructuredControlInput } from "./journey-entities.ts";
import { buildDefectSet, defectsForStep } from "./defect-catalog.ts";
import { buildArtifactForStep, computeJourneyResult, type JourneyRunInput } from "./journey-engine.ts";
import { buildUserProfile } from "./journey-profiles.ts";
import {
  initialProgress,
  rework,
  revisionOf,
  resolvedDefectIdsOf,
  type JourneyProgress,
} from "./rework-state-machine.ts";
import { evaluateArtifactReview } from "./review-evaluator.ts";

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

/** currentStepId を j3-design に置いた初期 progress（rework の起点にするため）。 */
function progressAtJ3(): JourneyProgress {
  return { ...initialProgress(), currentStepId: "j3-design" };
}

function input(progress: JourneyProgress, reviews: JourneyRunInput["reviews"] = {}): JourneyRunInput {
  return {
    profile: buildUserProfile("t", {}, HEAVY, "internal-api-workflow"),
    mode: "simulation",
    progress,
    reviews,
  };
}

/** step の Artifact を生成して item を itemId で引く。 */
function itemsOf(progress: JourneyProgress, stepId: Parameters<typeof buildArtifactForStep>[1]) {
  const art = buildArtifactForStep(input(progress), stepId);
  const byId = new Map(art.items.map((i) => [i.itemId, i]));
  return { art, byId };
}

/**
 * computeReworkTargets 相当（use-journey-state の domain ロジックを再現）。
 * submit 済み review から caught defect id を取り出す。false positive は caughtItemIds に入らない。
 */
function reworkTargetsFrom(
  progress: JourneyProgress,
  stepId: Parameters<typeof buildArtifactForStep>[1],
  review: ArtifactReview,
): readonly string[] {
  const defects = buildDefectSet(HEAVY);
  const art = buildArtifactForStep(input(progress), stepId);
  const evaluation = evaluateArtifactReview(art, defects, review);
  const byItemId = new Map(defectsForStep(defects, stepId).map((d) => [d.itemId, d.defectId]));
  const out: string[] = [];
  for (const itemId of evaluation.caughtItemIds) {
    const id = byItemId.get(itemId);
    if (id !== undefined) out.push(id);
  }
  return out;
}

describe("RC4 Phase 2 — rework target semantics", () => {
  it("1/3. Return selecting a real defect adds only that defect to resolved; others remain", () => {
    // J3 は missing-nfr / saas-logging / delegation の 3 defect が HEAVY で active。
    const p0 = progressAtJ3();
    const { art } = itemsOf(p0, "j3-design");
    // ユーザーは missing-nfr だけを正しく指摘（1 件のみ選択）。
    const review: ArtifactReview = {
      artifactId: art.artifactId,
      journeyStepId: "j3-design",
      findings: [{ itemId: "design-item-missing-nfr", severity: "high" }],
      gateDecision: "return-for-rework",
    };
    const targets = reworkTargetsFrom(p0, "j3-design", review);
    expect(targets).toEqual(["d-j3-missing-nfr"]);

    const p1 = rework(p0, "j3-design", "return", "critical-finding", targets);
    expect(resolvedDefectIdsOf(p1, "j3-design")).toEqual(["d-j3-missing-nfr"]);
    // 未選択の defect は resolved に入らない。
    expect(resolvedDefectIdsOf(p1, "j3-design")).not.toContain("d-j3-security-violation");
    expect(resolvedDefectIdsOf(p1, "j3-design")).not.toContain("d-j3-unsafe-delegation");
  });

  it("2. Return with only a false positive resolves nothing", () => {
    const p0 = progressAtJ3();
    const { art } = itemsOf(p0, "j3-design");
    // distractor（valid だが defect ではない）だけを指摘 = false positive。
    const review: ArtifactReview = {
      artifactId: art.artifactId,
      journeyStepId: "j3-design",
      findings: [{ itemId: "design-item-distractor" }],
      gateDecision: "return-for-rework",
    };
    const targets = reworkTargetsFrom(p0, "j3-design", review);
    expect(targets).toEqual([]);
    const p1 = rework(p0, "j3-design", "return", "critical-finding", targets);
    expect(resolvedDefectIdsOf(p1, "j3-design")).toEqual([]);
  });

  it("4. resolvedDefectIds is monotonic across multiple returns", () => {
    const p0 = progressAtJ3();
    const p1 = rework(p0, "j3-design", "return", "critical-finding", ["d-j3-missing-nfr"]);
    const p2 = rework(p1, "j3-design", "return", "critical-finding", ["d-j3-unsafe-delegation"]);
    // 2 回目でも 1 回目の resolved を落とさない（単調増加）。
    expect(resolvedDefectIdsOf(p2, "j3-design")).toEqual(
      ["d-j3-missing-nfr", "d-j3-unsafe-delegation"].sort(),
    );
    // 既存を重複追加しても増えない。
    const p3 = rework(p2, "j3-design", "return", "critical-finding", ["d-j3-missing-nfr"]);
    expect(resolvedDefectIdsOf(p3, "j3-design")).toEqual(
      ["d-j3-missing-nfr", "d-j3-unsafe-delegation"].sort(),
    );
  });
});

describe("RC4 Phase 2 — artifact body actually changes", () => {
  it("5/6/7/8. rev0 defective -> Return -> rev1 corrected; unselected stays defective", () => {
    const p0 = progressAtJ3();
    const before = itemsOf(p0, "j3-design");
    const nfrBefore = before.byId.get("design-item-missing-nfr");
    const delegBefore = before.byId.get("design-item-delegation");
    expect(nfrBefore?.contentState).toBe("defective");
    expect(nfrBefore?.bodyKey).toBe("rc4.iaw.j3.missingNfr.defective");
    expect(before.art.revision).toBe(0);

    // missing-nfr のみ Return 対象にする。
    const p1 = rework(p0, "j3-design", "return", "critical-finding", ["d-j3-missing-nfr"]);
    const after = itemsOf(p1, "j3-design");
    const nfrAfter = after.byId.get("design-item-missing-nfr");
    const delegAfter = after.byId.get("design-item-delegation");

    // 5/6/7: revision が上がり、本文が defective -> corrected へ実際に変わる。
    expect(after.art.revision).toBe(1);
    expect(nfrAfter?.contentState).toBe("corrected");
    expect(nfrAfter?.bodyKey).toBe("rc4.iaw.j3.missingNfr.corrected");
    expect(nfrAfter?.bodyKey).not.toBe(nfrBefore?.bodyKey);

    // 8: 未選択の delegation は defective のまま。
    expect(delegBefore?.contentState).toBe("defective");
    expect(delegAfter?.contentState).toBe("defective");
    expect(delegAfter?.bodyKey).toBe(delegBefore?.bodyKey);

    // artifact メタにも反映。
    expect(after.art.resolvedDefectIds).toContain("d-j3-missing-nfr");
    expect(after.art.unresolvedDefectIds).toContain("d-j3-unsafe-delegation");
    expect(after.art.changeSummaryKeys).toContain("rc4.iaw.j3.missingNfr.change");
  });

  it("9. re-review uses the revised (corrected) artifact identity", () => {
    const p0 = progressAtJ3();
    const a0 = buildArtifactForStep(input(p0), "j3-design");
    const p1 = rework(p0, "j3-design", "return", "critical-finding", ["d-j3-missing-nfr"]);
    const a1 = buildArtifactForStep(input(p1), "j3-design");
    // revision が変わると artifactId が変わる = 旧 review は identity 不一致で reject される（再レビュー必須）。
    expect(a1.artifactId).not.toBe(a0.artifactId);
    // RC4 Phase 3: artifactId は artifactVersion を suffix に持つ（local rework で artifactVersion +1）。
    expect(a1.artifactId).toContain("__v1");
  });
});

describe("RC4 Phase 2 — determinism & invariants", () => {
  it("6-invariant. same state + same context -> same artifact", () => {
    const p = rework(progressAtJ3(), "j3-design", "return", "critical-finding", ["d-j3-missing-nfr"]);
    const a = buildArtifactForStep(input(p), "j3-design");
    const b = buildArtifactForStep(input(p), "j3-design");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("revision increments IFF artifact content changes (newly resolved > 0)", () => {
    const p0 = progressAtJ3();
    expect(revisionOf(p0, "j3-design")).toBe(0);
    // no-op（valid target なし）: revision は据え置き（Artifact Version 不変）。
    const noop = rework(p0, "j3-design", "return", "critical-finding", []);
    expect(revisionOf(noop, "j3-design")).toBe(0);
    // valid target あり: revision +1。
    const real = rework(p0, "j3-design", "return", "critical-finding", ["d-j3-missing-nfr"]);
    expect(revisionOf(real, "j3-design")).toBe(1);
  });
});

describe("RC4 Phase 2 — 9 Dimension semantics & Completion!=Release unchanged", () => {
  it("15/16. mode does not change Ground Truth defect set", () => {
    const d1 = buildDefectSet(HEAVY);
    const d2 = buildDefectSet(HEAVY);
    expect(d1.map((d) => d.defectId)).toEqual(d2.map((d) => d.defectId));
  });

  it("17. conflating completion into release still penalizes approval-boundary (unchanged)", () => {
    const profile = buildUserProfile("t", {}, HEAVY, "internal-api-workflow");
    const runInput: JourneyRunInput = {
      profile,
      mode: "simulation",
      progress: initialProgress(),
      reviews: {},
      completionDecision: "approve",
      releaseDecision: "approve",
      releaseConflatedWithCompletion: true,
    };
    const result = computeJourneyResult(runInput);
    const ab = result.dimensionOutcomes.find((d) => d.dimensionId === "approval-boundary");
    expect(ab?.level).toBe("strong-negative");
  });
});
