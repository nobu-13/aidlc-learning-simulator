// RC4 Phase 3 Step 5 — Actual 1-hop downstream propagation tests。
//
// propagation は全 mode 共通の domain behavior（Adoption-only semantic は廃止）。
// source collection / rule 生成ともに direct 1-hop に閉じる（multi-hop / distant injection なし）。
// 決定的（time / random / locale / mode 非参照）。
//
// 題材: HEAVY / internal-api-workflow。direct downstream 関係:
//   d-j1-req-omission (J1) -> J2
//   d-j3-missing-nfr / d-j3-security-violation / d-j3-unsafe-delegation (J3) -> J4
import { describe, it, expect } from "vitest";
import type { ArtifactReview, StructuredControlInput, JourneyStepId } from "./journey-entities.ts";
import { buildArtifactForStep, type JourneyRunInput } from "./journey-engine.ts";
import { buildUserProfile } from "./journey-profiles.ts";
import { buildDefectSet } from "./defect-catalog.ts";
import {
  derivePropagationRules,
  computePropagatedEffects,
  directDownstreamStepOf,
  directUpstreamStepOf,
} from "./propagation-engine.ts";
import {
  initialProgress,
  markMaterialized,
  rework,
  artifactVersionOf,
  revisionOf,
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

const MODES = ["guided", "simulation", "adoption-review"] as const;

function baseInput(mode: (typeof MODES)[number], progress: JourneyProgress): JourneyRunInput {
  return {
    profile: buildUserProfile("t", {}, HEAVY, "internal-api-workflow"),
    mode,
    progress,
    reviews: {},
  };
}

/** 指定 step を「全 defect 見逃し（findings 空・approve）」する review を作る（artifactId は実 artifact から）。 */
function missReviewFor(input: JourneyRunInput, stepId: JourneyStepId): ArtifactReview {
  const artifact = buildArtifactForStep(input, stepId);
  return { artifactId: artifact.artifactId, journeyStepId: stepId, findings: [], gateDecision: "approve" };
}

function consequenceItems(a: ReturnType<typeof buildArtifactForStep>) {
  return a.items.filter((i) => i.itemId.startsWith("consequence-"));
}
function hasWorsened(a: ReturnType<typeof buildArtifactForStep>): boolean {
  return a.items.some((i) => i.itemId.startsWith("consequence-") && i.contentState === "baseline");
}
function hasImproved(a: ReturnType<typeof buildArtifactForStep>): boolean {
  return a.items.some((i) => i.itemId.startsWith("consequence-") && i.contentState === "corrected");
}

// ============================================================
// 1. all modes — 同一 propagation semantic
// ============================================================
describe("Propagation — 1. all modes share the same semantic", () => {
  it("missed J1 defect propagates a worsened item into J2 in every mode (identical body)", () => {
    const bodies: string[] = [];
    for (const mode of MODES) {
      const base = baseInput(mode, initialProgress());
      const input: JourneyRunInput = { ...base, reviews: { "j1-requirements": missReviewFor(base, "j1-requirements") } };
      const j2 = buildArtifactForStep(input, "j2-acceptance-scope");
      const worsened = consequenceItems(j2).filter((i) => i.contentState === "baseline");
      expect(worsened.length).toBeGreaterThan(0);
      bodies.push(worsened.map((i) => i.bodyKey).sort().join("|"));
    }
    // 全 mode で同一の伝播本文（domain behavior は mode 不変）。
    expect(new Set(bodies).size).toBe(1);
  });
});

// ============================================================
// 2. unresolved J1 defect -> J2 only (not J3 directly)
// ============================================================
describe("Propagation — 2. unresolved J1 defect hits J2, not J3 (no multi-hop)", () => {
  it("worsened item appears at J2 but NOT injected directly at J3", () => {
    const base = baseInput("simulation", initialProgress());
    const input: JourneyRunInput = { ...base, reviews: { "j1-requirements": missReviewFor(base, "j1-requirements") } };

    const j2 = buildArtifactForStep(input, "j2-acceptance-scope");
    const j3 = buildArtifactForStep(input, "j3-design");

    // J2 に J1 由来の worsened item がある。
    const j2FromJ1 = consequenceItems(j2).filter((i) => i.originStepId === "j1-requirements");
    expect(j2FromJ1.length).toBeGreaterThan(0);

    // J3 には J1 由来の直接注入は無い（1-hop only・J1->J3 は禁止）。
    const j3FromJ1 = consequenceItems(j3).filter((i) => i.originStepId === "j1-requirements");
    expect(j3FromJ1.length).toBe(0);
  });
});

// ============================================================
// 3. resolved J1 defect -> J2 worsened removed (improved instead)
// ============================================================
describe("Propagation — 3. resolved J1 defect removes the bad J2 effect", () => {
  it("after J1 rework resolves the defect, J2 shows improved (not worsened)", () => {
    // J1 の real defect を rework で解決した progress を作る。
    const p0 = { ...initialProgress(), currentStepId: "j1-requirements" as JourneyStepId };
    const resolved = rework(p0, "j1-requirements", "return", "critical-finding", ["d-j1-req-omission"]);
    const input = baseInput("simulation", resolved);

    const j2 = buildArtifactForStep(input, "j2-acceptance-scope");
    // resolved 由来の improved item がある。worsened（baseline）は出ない。
    expect(hasImproved(j2)).toBe(true);
    const worsenedFromJ1 = consequenceItems(j2).filter(
      (i) => i.originStepId === "j1-requirements" && i.contentState === "baseline",
    );
    expect(worsenedFromJ1.length).toBe(0);
  });
});

// ============================================================
// 4. materialized downstream: content change -> revision unchanged, artifactVersion +1
// ============================================================
describe("Propagation — 4. materialized downstream content change bumps artifactVersion only", () => {
  it("J2 already materialized; upstream J1 missed -> revision unchanged, artifactVersion +1", () => {
    // J2 を materialize 済みにする（clean upstream の初回生成 = version 0）。
    let progress = { ...initialProgress(), currentStepId: "j2-acceptance-scope" as JourneyStepId };
    progress = markMaterialized(progress, "j2-acceptance-scope");
    expect(artifactVersionOf(progress, "j2-acceptance-scope")).toBe(0);

    // upstream(J1) を見逃す → J2 に worsened が伝播し content が変わる。
    const base = baseInput("simulation", progress);
    const input: JourneyRunInput = { ...base, reviews: { "j1-requirements": missReviewFor(base, "j1-requirements") } };

    const j2 = buildArtifactForStep(input, "j2-acceptance-scope");
    // localRevision は据え置き（propagation は local rework ではない）。
    expect(revisionOf(progress, "j2-acceptance-scope")).toBe(0);
    // materialized downstream の content 変化 → artifactVersion +1。
    expect(j2.artifactVersion).toBe(1);
    expect(j2.artifactId.endsWith("__v1")).toBe(true);
  });
});

// ============================================================
// 5. unmaterialized downstream: first generation -> artifactVersion 0
// ============================================================
describe("Propagation — 5. unmaterialized downstream first generation is artifactVersion 0", () => {
  it("J2 never materialized; upstream J1 missed -> first generation stays artifactVersion 0", () => {
    // J2 は materialize していない（materializedSteps に無い = false）。
    const progress = { ...initialProgress(), currentStepId: "j2-acceptance-scope" as JourneyStepId };
    const base = baseInput("simulation", progress);
    const input: JourneyRunInput = { ...base, reviews: { "j1-requirements": missReviewFor(base, "j1-requirements") } };

    const j2 = buildArtifactForStep(input, "j2-acceptance-scope");
    // 伝播 content はあるが、初回生成なので現在の upstream state を version 0 の初回 content とする。
    expect(consequenceItems(j2).length).toBeGreaterThan(0);
    expect(j2.artifactVersion).toBe(0);
    expect(j2.artifactId.endsWith("__v0")).toBe(true);
  });
});

// ============================================================
// 6. unrelated defect -> downstream content / version unchanged
// ============================================================
describe("Propagation — 6. unrelated (non-propagating) defect leaves downstream unchanged", () => {
  it("J6-insufficient-evidence has no downstream; nothing is injected anywhere", () => {
    // d-j6-insufficient-evidence は直接 downstream が無い（J6 は最後の review step）。
    expect(directDownstreamStepOf("j6-test-evidence")).toBeUndefined();

    // J6 を見逃しても、どの step にも J6 由来の consequence は注入されない。
    const base = baseInput("simulation", initialProgress());
    const input: JourneyRunInput = { ...base, reviews: { "j6-test-evidence": missReviewFor(base, "j6-test-evidence") } };
    for (const step of ["j1-requirements", "j2-acceptance-scope", "j3-design", "j4-implementation-traceability", "j5-test-strategy", "j6-test-evidence"] as const) {
      const art = buildArtifactForStep(input, step);
      const fromJ6 = consequenceItems(art).filter((i) => i.originStepId === "j6-test-evidence");
      expect(fromJ6.length).toBe(0);
    }
  });
});

// ============================================================
// 7. false positive -> not a propagation source
// ============================================================
describe("Propagation — 7. a false positive does not become a propagation source", () => {
  it("flagging a distractor at J1 (no real defect caught/missed) yields no worsened at J2", () => {
    const base = baseInput("simulation", initialProgress());
    const j1 = buildArtifactForStep(base, "j1-requirements");
    // J1 の real defect を全て指摘（caught）しつつ distractor も指摘（false positive）。
    // real defect は caught=解決扱いにはならない（rework していない）が、missed でもない。
    const defects = buildDefectSet(HEAVY);
    const j1DefectItemIds = j1.items.filter((i) => i.defectId !== undefined).map((i) => i.itemId);
    const distractorId = j1.items.find((i) => i.distractor === true)?.itemId;

    // 全 real defect を指摘（見逃しゼロ）+ distractor 誤指摘（FP）。
    const findings = [...j1DefectItemIds.map((itemId) => ({ itemId }))];
    if (distractorId !== undefined) findings.push({ itemId: distractorId });
    const input: JourneyRunInput = {
      ...base,
      reviews: {
        "j1-requirements": {
          artifactId: j1.artifactId,
          journeyStepId: "j1-requirements",
          findings,
          gateDecision: "return-for-rework",
        },
      },
    };
    // 見逃しが無い（missed=0）ので J2 に worsened は出ない。FP は source にならない。
    const j2 = buildArtifactForStep(input, "j2-acceptance-scope");
    expect(hasWorsened(j2)).toBe(false);
    // defects を使ったことの sanity（未使用変数回避）。
    expect(defects.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 8. partial rework: only resolved defect effect disappears
// ============================================================
describe("Propagation — 8. partial rework keeps unresolved effects, drops resolved ones", () => {
  it("J3 has multiple defects -> resolve one; its improved shows, the still-missed one stays worsened", () => {
    // J3 の direct downstream は J4。HEAVY では J3 に missing-nfr / security-violation / unsafe-delegation が有効。
    // 1 つだけ rework で解決し、残りは見逃す → J4 に improved と worsened が混在する。
    let progress = { ...initialProgress(), currentStepId: "j3-design" as JourneyStepId };
    // security-violation を解決（rework）。
    progress = rework(progress, "j3-design", "return", "critical-finding", ["d-j3-security-violation"]);

    const base = baseInput("simulation", progress);
    // J3 を「残りの defect は見逃す」review（findings 空 = 全 未解決 defect を見逃し）。
    const input: JourneyRunInput = { ...base, reviews: { "j3-design": missReviewFor(base, "j3-design") } };

    const j4 = buildArtifactForStep(input, "j4-implementation-traceability");
    const fromSecurity = consequenceItems(j4).filter((i) => i.bodyKey.includes("d-j3-security-violation"));
    const worsenedOthers = consequenceItems(j4).filter(
      (i) => i.contentState === "baseline" && !i.bodyKey.includes("d-j3-security-violation"),
    );

    // resolved defect の effect は improved（corrected）で、worsened ではない。
    expect(fromSecurity.length).toBeGreaterThan(0);
    expect(fromSecurity.every((i) => i.contentState === "corrected")).toBe(true);
    // 未解決の他 defect は worsened のまま残る。
    expect(worsenedOthers.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 9. old Adoption-only test replaced by all-mode semantic (see journey-engine.test.ts)
//    ここでは engine の低レベル 1-hop 契約を直接固定する。
// ============================================================
describe("Propagation — 9. engine-level 1-hop contract", () => {
  it("every rule targets the direct downstream of its origin (structural 1-hop)", () => {
    const defects = buildDefectSet(HEAVY);
    const rules = derivePropagationRules(defects);
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      expect(r.targetStepId).toBe(directDownstreamStepOf(r.originStepId));
      // origin の direct upstream から見て、target が「その下流の 1 hop」であることの対称確認。
      expect(directUpstreamStepOf(r.targetStepId)).toBe(r.originStepId);
    }
  });

  it("computePropagatedEffects only emits effects whose rule.targetStepId matches the queried step", () => {
    const defects = buildDefectSet(HEAVY);
    const rules = derivePropagationRules(defects);
    // J1 defect を missed にして J4 を問い合わせても、J1 の effect は出ない（target は J2 なので）。
    const effects = computePropagatedEffects({
      rules,
      targetStepId: "j4-implementation-traceability",
      upstreamMissedDefectIds: new Set(["d-j1-req-omission"]),
      upstreamResolvedDefectIds: new Set(),
    });
    expect(effects.every((e) => e.atStepId === "j4-implementation-traceability")).toBe(true);
    expect(effects.some((e) => e.sourceDefectId === "d-j1-req-omission")).toBe(false);
  });
});
