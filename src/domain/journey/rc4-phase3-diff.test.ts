// RC4 Phase 3 Step 6 — Diff Engine tests。
//
// structural deterministic diff（text diff アルゴリズム不使用）と、2 種類の Journey diff
// （Local Rework Diff / Propagation Diff）を検証する。決定的。
import { describe, it, expect } from "vitest";
import type { GeneratedArtifact, ArtifactItem, StructuredControlInput, JourneyStepId } from "./journey-entities.ts";
import { diffArtifacts } from "./diff-engine.ts";
import { localReworkDiff, propagationDiff } from "./journey-diff.ts";
import { type JourneyRunInput } from "./journey-engine.ts";
import { buildUserProfile } from "./journey-profiles.ts";
import { initialProgress, markMaterialized, rework, type JourneyProgress } from "./rework-state-machine.ts";

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

/** 最小の合成 Artifact（structural diff の単体テスト用）。 */
function artifact(id: string, items: ArtifactItem[]): GeneratedArtifact {
  return {
    artifactId: id,
    journeyStepId: "j3-design",
    kind: "design",
    titleKey: "t",
    summaryKey: "s",
    items,
    quotedUserText: {},
    provenanceRefs: [],
    revision: 0,
    artifactVersion: 0,
    status: "under-review",
    archetypeId: "internal-api-workflow",
    resolvedDefectIds: [],
    unresolvedDefectIds: [],
    changeSummaryKeys: [],
    carriedConditionKeys: [],
    acceptedFacts: [],
  };
}
function item(itemId: string, bodyKey: string, contentState: ArtifactItem["contentState"]): ArtifactItem {
  return {
    itemId,
    labelKey: `${itemId}.label`,
    bodyKey,
    reviewability: "finding-candidate",
    userDerived: false,
    contentState,
    variantKey: `${itemId}::${contentState}`,
  };
}

// ============================================================
// 1. local rework: defective -> corrected は "changed"
// ============================================================
describe("Diff — 1. defective -> corrected is detected as changed", () => {
  it("same itemId, body changes -> changeType changed with before/after body", () => {
    const before = artifact("a__v0", [item("slot-x", "body.defective", "defective")]);
    const after = artifact("a__v1", [item("slot-x", "body.corrected", "corrected")]);
    const d = diffArtifacts(before, after);
    expect(d.hasChanges).toBe(true);
    expect(d.changes).toHaveLength(1);
    const c = d.changes[0]!;
    expect(c.changeType).toBe("changed");
    expect(c.itemId).toBe("slot-x");
    expect(c.beforeBodyKey).toBe("body.defective");
    expect(c.afterBodyKey).toBe("body.corrected");
    expect(c.beforeContentState).toBe("defective");
    expect(c.afterContentState).toBe("corrected");
  });
});

// ============================================================
// 2. item removal -> "removed"
// ============================================================
describe("Diff — 2. item removal", () => {
  it("item present only in before -> removed with before body", () => {
    const before = artifact("a__v0", [item("keep", "keep.body", "baseline"), item("gone", "gone.body", "baseline")]);
    const after = artifact("a__v1", [item("keep", "keep.body", "baseline")]);
    const d = diffArtifacts(before, after);
    const removed = d.changes.filter((c) => c.changeType === "removed");
    expect(removed).toHaveLength(1);
    expect(removed[0]!.itemId).toBe("gone");
    expect(removed[0]!.beforeBodyKey).toBe("gone.body");
    expect(removed[0]!.afterBodyKey).toBeUndefined();
  });
});

// ============================================================
// 3. item addition -> "added"
// ============================================================
describe("Diff — 3. item addition", () => {
  it("item present only in after -> added with after body", () => {
    const before = artifact("a__v0", [item("keep", "keep.body", "baseline")]);
    const after = artifact("a__v1", [item("keep", "keep.body", "baseline"), item("new", "new.body", "corrected")]);
    const d = diffArtifacts(before, after);
    const added = d.changes.filter((c) => c.changeType === "added");
    expect(added).toHaveLength(1);
    expect(added[0]!.itemId).toBe("new");
    expect(added[0]!.afterBodyKey).toBe("new.body");
    expect(added[0]!.beforeBodyKey).toBeUndefined();
  });
});

// ============================================================
// 4. propagation unresolved -> resolved: bad downstream effect removal detected
// ============================================================
describe("Diff — 4. propagation unresolved -> resolved removes bad downstream effect", () => {
  it("J4 propagation diff shows the change caused by resolving a J3 upstream defect", () => {
    // J3 の real defect を rework で解決 → J4（direct downstream）の伝播 content が変わる。
    let progress: JourneyProgress = { ...initialProgress(), currentStepId: "j4-implementation-traceability" };
    progress = markMaterialized(progress, "j4-implementation-traceability");
    progress = rework(progress, "j3-design", "return", "critical-finding", ["d-j3-security-violation"]);

    const result = propagationDiff(input(progress), "j4-implementation-traceability");
    expect(result.originStepId).toBe("j3-design");
    expect(result.diff).toBeDefined();
    expect(result.diff!.hasChanges).toBe(true);
    // before（upstream unresolved 相当）と after（resolved）で content が異なる。
    expect(result.before).toBeDefined();
    expect(result.after).toBeDefined();
    // 変化に improved（corrected）由来の consequence 変化が含まれる。
    const touchesConsequence = result.diff!.changes.some((c) => c.itemId.startsWith("consequence-"));
    expect(touchesConsequence).toBe(true);
  });
});

// ============================================================
// 5. identical artifact -> empty diff
// ============================================================
describe("Diff — 5. identical artifact yields empty diff", () => {
  it("same items -> no changes", () => {
    const items = [item("a", "a.body", "baseline"), item("b", "b.body", "defective")];
    const before = artifact("x__v0", items.map((i) => ({ ...i })));
    const after = artifact("x__v0", items.map((i) => ({ ...i })));
    const d = diffArtifacts(before, after);
    expect(d.hasChanges).toBe(false);
    expect(d.changes).toHaveLength(0);
  });

  it("propagationDiff with no upstream resolution is empty (no fabricated impact)", () => {
    // upstream(J3) に resolved が無い → J4 の propagation diff は空。
    const progress: JourneyProgress = { ...initialProgress(), currentStepId: "j4-implementation-traceability" };
    const result = propagationDiff(input(progress), "j4-implementation-traceability");
    expect(result.diff).toBeUndefined();
  });

  it("localReworkDiff with no rework (revision 0) has no before / no diff", () => {
    const progress: JourneyProgress = { ...initialProgress(), currentStepId: "j3-design" };
    const result = localReworkDiff(input(progress), "j3-design");
    expect(result.before).toBeUndefined();
    expect(result.diff).toBeUndefined();
  });
});

// ============================================================
// 6. deterministic: same input -> same diff
// ============================================================
describe("Diff — 6. deterministic", () => {
  it("same before/after -> byte-identical diff result", () => {
    const before = artifact("a__v0", [item("slot-x", "body.defective", "defective")]);
    const after = artifact("a__v1", [item("slot-x", "body.corrected", "corrected")]);
    const d1 = diffArtifacts(before, after);
    const d2 = diffArtifacts(before, after);
    expect(JSON.stringify(d1)).toBe(JSON.stringify(d2));
  });

  it("localReworkDiff is deterministic for the same journey state", () => {
    let progress: JourneyProgress = { ...initialProgress(), currentStepId: "j3-design" };
    progress = rework(progress, "j3-design", "return", "critical-finding", ["d-j3-missing-nfr"]);
    const step: JourneyStepId = "j3-design";
    const d1 = localReworkDiff(input(progress), step);
    const d2 = localReworkDiff(input(progress), step);
    expect(JSON.stringify(d1.diff)).toBe(JSON.stringify(d2.diff));
    // local rework で defective -> corrected になった slot が changed として出る。
    expect(d1.diff).toBeDefined();
    const changed = d1.diff!.changes.find((c) => c.itemId === "design-item-missing-nfr");
    expect(changed?.changeType).toBe("changed");
    expect(changed?.beforeContentState).toBe("defective");
    expect(changed?.afterContentState).toBe("corrected");
  });
});
