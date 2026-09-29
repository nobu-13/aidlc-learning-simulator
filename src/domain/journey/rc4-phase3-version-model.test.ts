// RC4 Phase 3 — Version Model tests。
//
// localRevision（revisions / revisionOf）と artifactVersion（artifactVersions / artifactVersionOf）を
// 別軸として扱い、materialization（materializedSteps / materializationOf / markMaterialized）の
// semantic と legacy unknown（undefined）維持、generator identity（artifactId の __v{n} suffix）、
// content-changing local rework の hard invariant（同一 artifactId で異なる content を作らない）を検証する。
//
// 決定的（time / random / locale 非参照）。既存 rc4-phase2 テストと同じ題材（HEAVY / internal-api-workflow /
// j3-design の d-j3-missing-nfr）を使い、Ground Truth に依存する挙動を安定させる。
import { describe, it, expect } from "vitest";
import type { StructuredControlInput } from "./journey-entities.ts";
import type { DefectDefinition } from "./journey-entities.ts";
import { buildArtifactForStep, type JourneyRunInput } from "./journey-engine.ts";
import { buildUserProfile } from "./journey-profiles.ts";
import { buildDefectSet } from "./defect-catalog.ts";
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

const STEP = "j3-design" as const;
const PROFILE = buildUserProfile("t", {}, HEAVY, "internal-api-workflow");

function defectById(id: string): DefectDefinition {
  const d = buildDefectSet(HEAVY, PROFILE.profileDefectRules).find((x) => x.defectId === id);
  if (d === undefined) throw new Error(`defect not found: ${id}`);
  return d;
}
// binary defect（1 段階で resolved）を version 軸のテストに使う（stage 挙動をシンプルに保つ）。
const BINARY_DEFECT = () => defectById("d-j3-unsafe-delegation");
const REAL_DEFECT = BINARY_DEFECT;
const OTHER_DEFECT = () => defectById("d-j3-security-violation");

function progressAtJ3(): JourneyProgress {
  return { ...initialProgress(), currentStepId: STEP };
}

function input(progress: JourneyProgress): JourneyRunInput {
  return { profile: PROFILE, mode: "simulation", progress, reviews: {} };
}

/** legacy state（Phase 3 version フィールドが undefined）を作る。 */
function legacyProgress(): JourneyProgress {
  const base = progressAtJ3();
  const legacy: JourneyProgress = {
    currentStepId: base.currentStepId,
    revisions: base.revisions,
    reworkHistory: base.reworkHistory,
    completedStepIds: base.completedStepIds,
    resolvedDefectIds: base.resolvedDefectIds,
    // artifactVersions / materializedSteps を意図的に付けない（legacy unknown）。
  };
  return legacy;
}

describe("RC4 Phase 3 Version Model — 1. New Journey", () => {
  it("new journey: revisionOf=0, artifactVersionOf=0, materializationOf=false", () => {
    const p = progressAtJ3();
    expect(revisionOf(p, STEP)).toBe(0);
    expect(artifactVersionOf(p, STEP)).toBe(0);
    expect(materializationOf(p, STEP)).toBe(false);
  });
});

describe("RC4 Phase 3 Version Model — 2. First materialization", () => {
  it("false -> true; revision unchanged; artifactVersion unchanged", () => {
    const p0 = progressAtJ3();
    const p1 = markMaterialized(p0, STEP);
    expect(materializationOf(p1, STEP)).toBe(true);
    // materialization は version を動かさない。
    expect(revisionOf(p1, STEP)).toBe(0);
    expect(artifactVersionOf(p1, STEP)).toBe(0);
  });
});

describe("RC4 Phase 3 Version Model — 3. Repeated materialization", () => {
  it("true -> true (idempotent); versions unchanged", () => {
    const p0 = progressAtJ3();
    const p1 = markMaterialized(p0, STEP);
    const p2 = markMaterialized(p1, STEP);
    expect(materializationOf(p2, STEP)).toBe(true);
    expect(revisionOf(p2, STEP)).toBe(0);
    expect(artifactVersionOf(p2, STEP)).toBe(0);
    // idempotent: 既に true なら同一参照を返す。
    expect(p2).toBe(p1);
  });
});

describe("RC4 Phase 3 Version Model — 4. Valid local rework", () => {
  it("revision 0 -> 1 and artifactVersion 0 -> 1", () => {
    const p0 = progressAtJ3();
    const p1 = rework(p0, STEP, "return", "critical-finding", [REAL_DEFECT()]);
    expect(revisionOf(p1, STEP)).toBe(1);
    expect(artifactVersionOf(p1, STEP)).toBe(1);
  });
});

describe("RC4 Phase 3 Version Model — 5. Second valid local rework", () => {
  it("revision 1 -> 2 and artifactVersion 1 -> 2", () => {
    const p0 = progressAtJ3();
    const p1 = rework(p0, STEP, "return", "critical-finding", [REAL_DEFECT()]);
    expect(revisionOf(p1, STEP)).toBe(1);
    expect(artifactVersionOf(p1, STEP)).toBe(1);
    // 別の real defect を追加解決 → content が変わる = revision/artifactVersion ともに +1。
    const p2 = rework(p1, STEP, "return", "critical-finding", [OTHER_DEFECT()]);
    expect(revisionOf(p2, STEP)).toBe(2);
    expect(artifactVersionOf(p2, STEP)).toBe(2);
  });
});

describe("RC4 Phase 3 Version Model — 6. No-op rework", () => {
  it("no valid target -> revision unchanged and artifactVersion unchanged", () => {
    const p0 = progressAtJ3();
    // false positive only / valid target なし = content 変化なし。
    const p1 = rework(p0, STEP, "return", "critical-finding", []);
    expect(revisionOf(p1, STEP)).toBe(0);
    expect(artifactVersionOf(p1, STEP)).toBe(0);
    // binary defect: 既に resolved を再度 target にしても no-op（次 stage 無し）。
    const p2 = rework(p0, STEP, "return", "critical-finding", [REAL_DEFECT()]);
    const p3 = rework(p2, STEP, "return", "critical-finding", [REAL_DEFECT()]);
    expect(revisionOf(p3, STEP)).toBe(1);
    expect(artifactVersionOf(p3, STEP)).toBe(1);
  });
});

describe("RC4 Phase 3 Version Model — 7. Legacy unknown handling", () => {
  it("legacy: artifactVersionOf=undefined, materializationOf=undefined", () => {
    const legacy = legacyProgress();
    expect(artifactVersionOf(legacy, STEP)).toBeUndefined();
    expect(materializationOf(legacy, STEP)).toBeUndefined();
  });

  it("legacy: local rework keeps artifactVersions === undefined (no implicit migration)", () => {
    const legacy = legacyProgress();
    const reworked = rework(legacy, STEP, "return", "critical-finding", [REAL_DEFECT()]);
    // localRevision は進むが artifactVersion は legacy unknown のまま。
    expect(revisionOf(reworked, STEP)).toBe(1);
    expect(reworked.artifactVersions).toBeUndefined();
    expect(artifactVersionOf(reworked, STEP)).toBeUndefined();
  });

  it("legacy: markMaterialized keeps materializedSteps === undefined (no implicit migration)", () => {
    const legacy = legacyProgress();
    const marked = markMaterialized(legacy, STEP);
    expect(marked.materializedSteps).toBeUndefined();
    expect(materializationOf(marked, STEP)).toBeUndefined();
    // legacy は触らないので同一参照を返す。
    expect(marked).toBe(legacy);
  });
});

describe("RC4 Phase 3 Version Model — 8. Generator identity", () => {
  it("artifactVersion 0 -> artifactId suffix __v0; artifactVersion 1 -> __v1", () => {
    const p0 = progressAtJ3();
    const art0 = buildArtifactForStep(input(p0), STEP);
    expect(art0.artifactVersion).toBe(0);
    expect(art0.artifactId.endsWith("__v0")).toBe(true);

    const p1 = rework(p0, STEP, "return", "critical-finding", [REAL_DEFECT()]);
    const art1 = buildArtifactForStep(input(p1), STEP);
    expect(art1.artifactVersion).toBe(1);
    expect(art1.artifactId.endsWith("__v1")).toBe(true);
  });
});

describe("RC4 Phase 3 Version Model — 9. Hard invariant", () => {
  it("content-changing local rework also changes artifactVersion; no same artifactId with different content", () => {
    const p0 = progressAtJ3();
    const art0 = buildArtifactForStep(input(p0), STEP);
    const p1 = rework(p0, STEP, "return", "critical-finding", [REAL_DEFECT()]);
    const art1 = buildArtifactForStep(input(p1), STEP);

    // content が変わった（defective -> corrected）ことを確認（binary delegation defect）。
    const item0 = art0.items.find((i) => i.itemId === "design-item-delegation");
    const item1 = art1.items.find((i) => i.itemId === "design-item-delegation");
    expect(item0?.contentState).toBe("defective");
    expect(item1?.contentState).toBe("corrected");
    expect(item0?.bodyKey).not.toBe(item1?.bodyKey);

    // content が変わったなら artifactVersion も変わっている。
    expect(art1.artifactVersion).not.toBe(art0.artifactVersion);
    // したがって artifactId も異なる（same id で different content を作らない）。
    expect(art1.artifactId).not.toBe(art0.artifactId);
  });
});
