// RC4 Final テスト — Revision = Artifact Version invariant（data-driven multi-stage resolution）。
//
// hard invariant: revision increases IFF Artifact content actually changes.
// RC4 Final の content change 条件 = targeted defect のうち「次 resolution stage を持つ（terminal でない）」
// ものが 1 件以上ある（hasArtifactChange / anyStageAdvances）。
//
// 検証:
//  - real defect selected → 次 stage あり → revision N→N+1 / content 前進
//  - false positive only（targeted 空）→ revision unchanged / artifactId unchanged / body unchanged
//  - mandatory critical miss の初回 rework（valid target なし）→ revision unchanged、Review へ戻る
//  - multi-stage defect: v0(unresolved) → v1(partial) → v2(resolved)（Blind Audit 再現ケース）
//  - terminal 到達後の再 Return → no-op（revision unchanged）
//  - partial / resolved / monotonic
import { describe, it, expect } from "vitest";
import type { DefectDefinition, StructuredControlInput } from "./journey-entities.ts";
import { buildArtifactForStep, type JourneyRunInput } from "./journey-engine.ts";
import { buildUserProfile } from "./journey-profiles.ts";
import { buildDefectSet } from "./defect-catalog.ts";
import {
  hasArtifactChange,
  initialProgress,
  rework,
  revisionOf,
  resolvedDefectIdsOf,
  defectStageIndexOf,
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

const PROFILE = buildUserProfile("t", {}, HEAVY, "internal-api-workflow");

/** HEAVY プロファイルで有効な real defect を id で引く（Ground Truth）。 */
function defectById(id: string): DefectDefinition {
  const d = buildDefectSet(HEAVY, PROFILE.profileDefectRules).find((x) => x.defectId === id);
  if (d === undefined) throw new Error(`defect not found: ${id}`);
  return d;
}

const NFR = () => defectById("d-j3-missing-nfr"); // multi-stage（3 stage）。
const DELEGATION = () => defectById("d-j3-unsafe-delegation"); // binary。

function progressAtJ3(): JourneyProgress {
  return { ...initialProgress(), currentStepId: "j3-design" };
}
function input(progress: JourneyProgress): JourneyRunInput {
  return { profile: PROFILE, mode: "simulation", progress, reviews: {} };
}
function nfrItem(progress: JourneyProgress) {
  const art = buildArtifactForStep(input(progress), "j3-design");
  const item = art.items.find((i) => i.itemId === "design-item-missing-nfr");
  return { art, item };
}

describe("hasArtifactChange helper (multi-stage)", () => {
  it("true iff at least one targeted defect has a next resolution stage", () => {
    // 未着手（stage 0）の multi-stage defect は次 stage あり → true。
    expect(hasArtifactChange({ targetedDefects: [NFR()], currentStages: {} })).toBe(true);
    // targeted 空 → false。
    expect(hasArtifactChange({ targetedDefects: [], currentStages: {} })).toBe(false);
    // 既に terminal（NFR は stage 2 が terminal）→ false（no-op）。
    expect(
      hasArtifactChange({ targetedDefects: [NFR()], currentStages: { "d-j3-missing-nfr": 2 } }),
    ).toBe(false);
    // binary defect は stage 1 が terminal → 未着手なら true、resolved 済みなら false。
    expect(hasArtifactChange({ targetedDefects: [DELEGATION()], currentStages: {} })).toBe(true);
    expect(
      hasArtifactChange({ targetedDefects: [DELEGATION()], currentStages: { "d-j3-unsafe-delegation": 1 } }),
    ).toBe(false);
  });
});

describe("RC4 Final — binary defect resolution", () => {
  it("binary defect: v0 -> v1 resolved (single stage)", () => {
    const p0 = progressAtJ3();
    const before = buildArtifactForStep(input(p0), "j3-design");
    const del0 = before.items.find((i) => i.itemId === "design-item-delegation");
    expect(del0?.contentState).toBe("defective");

    const p1 = rework(p0, "j3-design", "return", "critical-finding", [DELEGATION()]);
    const after = buildArtifactForStep(input(p1), "j3-design");
    const del1 = after.items.find((i) => i.itemId === "design-item-delegation");
    expect(del1?.contentState).toBe("corrected");
    expect(revisionOf(p1, "j3-design")).toBe(1);
    expect(resolvedDefectIdsOf(p1, "j3-design")).toContain("d-j3-unsafe-delegation");
  });
});

describe("RC4 Final — multi-stage defect (Blind Audit NFR case)", () => {
  it("v0 unresolved -> v1 partial -> v2 resolved; revision 0->1->2", () => {
    const p0 = progressAtJ3();
    expect(nfrItem(p0).item?.contentState).toBe("defective");
    expect(revisionOf(p0, "j3-design")).toBe(0);

    // 1 回目 Return: partial へ前進。
    const p1 = rework(p0, "j3-design", "return", "critical-finding", [NFR()]);
    expect(revisionOf(p1, "j3-design")).toBe(1);
    expect(defectStageIndexOf(p1, "j3-design", "d-j3-missing-nfr")).toBe(1);
    expect(nfrItem(p1).item?.contentState).toBe("partial");
    expect(nfrItem(p1).item?.bodyKey).toBe("rc4.iaw.j3.missingNfr.partial");
    // partial はまだ resolved ではない。
    expect(resolvedDefectIdsOf(p1, "j3-design")).not.toContain("d-j3-missing-nfr");

    // 2 回目 Return: resolved へ前進。
    const p2 = rework(p1, "j3-design", "return", "critical-finding", [NFR()]);
    expect(revisionOf(p2, "j3-design")).toBe(2);
    expect(defectStageIndexOf(p2, "j3-design", "d-j3-missing-nfr")).toBe(2);
    expect(nfrItem(p2).item?.contentState).toBe("corrected");
    expect(nfrItem(p2).item?.bodyKey).toBe("rc4.iaw.j3.missingNfr.corrected");
    expect(resolvedDefectIdsOf(p2, "j3-design")).toContain("d-j3-missing-nfr");

    // 本文は v0 != v1 != v2。
    const b0 = nfrItem(p0).item?.bodyKey;
    const b1 = nfrItem(p1).item?.bodyKey;
    const b2 = nfrItem(p2).item?.bodyKey;
    expect(b0).not.toBe(b1);
    expect(b1).not.toBe(b2);
    expect(b0).not.toBe(b2);
  });

  it("resolved 到達後の再 Return は no-op（revision / stage unchanged）", () => {
    const p0 = progressAtJ3();
    const p1 = rework(p0, "j3-design", "return", "critical-finding", [NFR()]);
    const p2 = rework(p1, "j3-design", "return", "critical-finding", [NFR()]);
    expect(revisionOf(p2, "j3-design")).toBe(2);
    // 3 回目: 次 stage が無い → no-op。
    const p3 = rework(p2, "j3-design", "return", "critical-finding", [NFR()]);
    expect(revisionOf(p3, "j3-design")).toBe(2);
    expect(defectStageIndexOf(p3, "j3-design", "d-j3-missing-nfr")).toBe(2);
    const last = p3.reworkHistory[p3.reworkHistory.length - 1];
    expect(last?.isNoOpAttempt).toBe(true);
  });
});

describe("RC4 Final — false positive only (no-op)", () => {
  it("targeted 空 -> revision/artifactId/body unchanged", () => {
    const p0 = progressAtJ3();
    const before = nfrItem(p0);
    const p1 = rework(p0, "j3-design", "return", "critical-finding", []);
    const after = nfrItem(p1);

    expect(revisionOf(p1, "j3-design")).toBe(0);
    expect(after.art.artifactId).toBe(before.art.artifactId);
    expect(after.item?.contentState).toBe("defective");
    expect(after.item?.bodyKey).toBe(before.item?.bodyKey);
    expect(resolvedDefectIdsOf(p1, "j3-design")).toEqual([]);
    expect(p1.currentStepId).toBe("j3-design");
    const lastEntry = p1.reworkHistory[p1.reworkHistory.length - 1];
    expect(lastEntry?.isNoOpAttempt).toBe(true);
    expect(lastEntry?.atRevision).toBe(0);
  });
});

describe("RC4 Final — mandatory rework then correct selection", () => {
  it("初回 mandatory rework(no target) keeps revision; later real selection bumps", () => {
    const p0 = progressAtJ3();
    const p1 = rework(p0, "j3-design", "return", "critical-finding", []);
    expect(revisionOf(p1, "j3-design")).toBe(0);
    expect(nfrItem(p1).item?.contentState).toBe("defective");

    const p2 = rework(p1, "j3-design", "return", "critical-finding", [NFR()]);
    expect(revisionOf(p2, "j3-design")).toBe(1);
    expect(nfrItem(p2).item?.contentState).toBe("partial");
  });
});

describe("RC4 Final — monotonic across multiple defects", () => {
  it("解決は単調・別 defect 追加で revision +1", () => {
    const p0 = progressAtJ3();
    // NFR を terminal まで（2 回）。
    const p1 = rework(p0, "j3-design", "return", "critical-finding", [NFR()]);
    const p2 = rework(p1, "j3-design", "return", "critical-finding", [NFR()]);
    expect(revisionOf(p2, "j3-design")).toBe(2);
    expect(resolvedDefectIdsOf(p2, "j3-design")).toEqual(["d-j3-missing-nfr"]);
    // 別 real defect（binary）を追加 → revision +1。
    const p3 = rework(p2, "j3-design", "return", "critical-finding", [DELEGATION()]);
    expect(revisionOf(p3, "j3-design")).toBe(3);
    expect(resolvedDefectIdsOf(p3, "j3-design")).toEqual(
      ["d-j3-missing-nfr", "d-j3-unsafe-delegation"].sort(),
    );
  });
});
