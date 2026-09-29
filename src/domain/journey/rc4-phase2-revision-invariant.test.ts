// RC4 Phase 2 修正テスト — Revision = Artifact Version invariant。
//
// hard invariant: revision increases IFF Artifact content actually changes.
// Phase 2 では content change 条件 = newlyResolvedDefectIds.length > 0（hasArtifactChange）。
//
// 検証:
//  - real defect selected → revision N→N+1 / corrected body
//  - false positive only → revision unchanged / artifactId unchanged / body unchanged / resolved unchanged
//  - mandatory critical miss の初回 rework（valid target なし）→ revision unchanged、Review へ戻る
//  - その後 real defect 選択 → Return → revision +1 / corrected
//  - partial rework / monotonic
import { describe, it, expect } from "vitest";
import type { StructuredControlInput } from "./journey-entities.ts";
import { buildArtifactForStep, type JourneyRunInput } from "./journey-engine.ts";
import { buildUserProfile } from "./journey-profiles.ts";
import {
  hasArtifactChange,
  initialProgress,
  rework,
  revisionOf,
  resolvedDefectIdsOf,
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

function progressAtJ3(): JourneyProgress {
  return { ...initialProgress(), currentStepId: "j3-design" };
}
function input(progress: JourneyProgress): JourneyRunInput {
  return {
    profile: buildUserProfile("t", {}, HEAVY, "internal-api-workflow"),
    mode: "simulation",
    progress,
    reviews: {},
  };
}
function nfrItem(progress: JourneyProgress) {
  const art = buildArtifactForStep(input(progress), "j3-design");
  const item = art.items.find((i) => i.itemId === "design-item-missing-nfr");
  return { art, item };
}

describe("hasArtifactChange helper", () => {
  it("true iff there is at least one newly resolved defect", () => {
    expect(hasArtifactChange({ newlyResolvedDefectIds: [] })).toBe(false);
    expect(hasArtifactChange({ newlyResolvedDefectIds: ["d-j3-missing-nfr"] })).toBe(true);
  });
});

describe("RC4 Phase 2 revision invariant — real defect", () => {
  it("1/2/8. real defect selected -> revision N->N+1 + corrected body; only selected resolved", () => {
    const p0 = progressAtJ3();
    const before = nfrItem(p0);
    expect(before.art.revision).toBe(0);
    expect(before.item?.contentState).toBe("defective");

    const p1 = rework(p0, "j3-design", "return", "critical-finding", ["d-j3-missing-nfr"]);
    const after = nfrItem(p1);
    expect(after.art.revision).toBe(1);
    expect(after.item?.contentState).toBe("corrected");
    expect(after.item?.bodyKey).toBe("rc4.iaw.j3.missingNfr.corrected");
    // partial: 選択した defect のみ resolved。
    expect(resolvedDefectIdsOf(p1, "j3-design")).toEqual(["d-j3-missing-nfr"]);
  });
});

describe("RC4 Phase 2 revision invariant — false positive only (no-op)", () => {
  it("3/4/5. false positive only -> revision/artifactId/body unchanged, resolved unchanged", () => {
    const p0 = progressAtJ3();
    const before = nfrItem(p0);
    // valid target なし（false positive のみ = targeted が空、あるいは defect でない id）。
    const p1 = rework(p0, "j3-design", "return", "critical-finding", []);
    const after = nfrItem(p1);

    // revision 据え置き。
    expect(revisionOf(p1, "j3-design")).toBe(0);
    // artifactId 不変（revision が同じ = identity 同じ）。
    expect(after.art.artifactId).toBe(before.art.artifactId);
    // 本文不変（defective のまま）。
    expect(after.item?.contentState).toBe("defective");
    expect(after.item?.bodyKey).toBe(before.item?.bodyKey);
    // resolved 不変。
    expect(resolvedDefectIdsOf(p1, "j3-design")).toEqual([]);
    // ただし Review へ戻る遷移は行われる（currentStepId は target）。
    expect(p1.currentStepId).toBe("j3-design");
    // no-op attempt として履歴に記録され、revision entry とは分離される。
    const lastEntry = p1.reworkHistory[p1.reworkHistory.length - 1];
    expect(lastEntry?.isNoOpAttempt).toBe(true);
    expect(lastEntry?.atRevision).toBe(0);
  });
});

describe("RC4 Phase 2 revision invariant — mandatory rework then correct selection", () => {
  it("6/7. initial mandatory rework (no valid target) keeps revision; later real selection bumps revision", () => {
    const p0 = progressAtJ3();
    // 初回 mandatory rework: まだ重大 defect を特定していない = valid target なし。
    const p1 = rework(p0, "j3-design", "return", "critical-finding", []);
    expect(revisionOf(p1, "j3-design")).toBe(0); // revision 進めない。
    expect(nfrItem(p1).item?.contentState).toBe("defective"); // 本文も変わらない。

    // その後 real defect を選択して Return。
    const p2 = rework(p1, "j3-design", "return", "critical-finding", ["d-j3-missing-nfr"]);
    expect(revisionOf(p2, "j3-design")).toBe(1); // ここで初めて +1。
    expect(nfrItem(p2).item?.contentState).toBe("corrected");
    expect(resolvedDefectIdsOf(p2, "j3-design")).toEqual(["d-j3-missing-nfr"]);
  });
});

describe("RC4 Phase 2 revision invariant — monotonic & no-op does not double-bump", () => {
  it("9. resolved monotonic; re-returning an already-resolved defect is a no-op (no revision bump)", () => {
    const p0 = progressAtJ3();
    const p1 = rework(p0, "j3-design", "return", "critical-finding", ["d-j3-missing-nfr"]);
    expect(revisionOf(p1, "j3-design")).toBe(1);
    // 既に resolved の defect を再度 target にしても newlyResolved=0 → no-op（revision 据え置き）。
    const p2 = rework(p1, "j3-design", "return", "critical-finding", ["d-j3-missing-nfr"]);
    expect(revisionOf(p2, "j3-design")).toBe(1);
    expect(resolvedDefectIdsOf(p2, "j3-design")).toEqual(["d-j3-missing-nfr"]);
    // 別の real defect を追加すると revision +1。
    const p3 = rework(p2, "j3-design", "return", "critical-finding", ["d-j3-unsafe-delegation"]);
    expect(revisionOf(p3, "j3-design")).toBe(2);
    expect(resolvedDefectIdsOf(p3, "j3-design")).toEqual(
      ["d-j3-missing-nfr", "d-j3-unsafe-delegation"].sort(),
    );
  });
});
