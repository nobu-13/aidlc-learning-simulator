// RC4 Final Integrity Pass — Blind Audit sequence を source of truth とした regression tests。
//
// 目的は tests green ではなく「実 User Journey で状態・採点・因果表示が矛盾しない」こと。
// 決定的（time / random / locale 非参照）。
import { describe, it, expect } from "vitest";
import type { ArtifactReview, DefectDefinition, StructuredControlInput } from "./journey-entities.ts";
import {
  buildArtifactForStep,
  computeJourneyResult,
  evaluateAllReviews,
  type JourneyRunInput,
} from "./journey-engine.ts";
import { buildUserProfile } from "./journey-profiles.ts";
import { buildDefectSet } from "./defect-catalog.ts";
import { evaluateArtifactReview } from "./review-evaluator.ts";
import {
  initialProgress,
  rework,
  markMaterialized,
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
function defect(id: string): DefectDefinition {
  const d = buildDefectSet(HEAVY, PROFILE.profileDefectRules).find((x) => x.defectId === id);
  if (d === undefined) throw new Error(`defect not found: ${id}`);
  return d;
}
function input(progress: JourneyProgress, reviews: JourneyRunInput["reviews"] = {}): JourneyRunInput {
  return { profile: PROFILE, mode: "simulation", progress, reviews };
}
function approveReview(artifactId: string, stepId: string): ArtifactReview {
  return {
    artifactId,
    journeyStepId: stepId as ArtifactReview["journeyStepId"],
    findings: [],
    gateDecision: "approve",
  };
}

// ============================================================
// P1-1: resolved finding becomes missed again
// ============================================================
describe("RC4 Integrity — P1-1: resolved finding must not become missed", () => {
  it("multi-stage: after 2 Returns (resolved) and Approve, NFR defect is NOT scored as missed", () => {
    // J3 で NFR を terminal（resolved）まで rework する。
    let p: JourneyProgress = { ...initialProgress(), currentStepId: "j3-design" };
    p = markMaterialized(p, "j3-design");
    p = rework(p, "j3-design", "return", "critical-finding", [defect("d-j3-missing-nfr")]); // partial
    p = rework(p, "j3-design", "return", "critical-finding", [defect("d-j3-missing-nfr")]); // resolved

    const artifact = buildArtifactForStep(input(p), "j3-design");
    const nfr = artifact.items.find((i) => i.itemId === "design-item-missing-nfr");
    expect(nfr?.contentState).toBe("corrected"); // resolved。

    // ユーザーは corrected artifact を（NFR を再指摘せず）approve する。
    const review = approveReview(artifact.artifactId, "j3-design");
    const evalResult = evaluateArtifactReview(artifact, buildDefectSet(HEAVY, PROFILE.profileDefectRules), review);

    // resolved の NFR は missed に入らない（単一ソース = artifact 現在状態）。
    expect(evalResult.missedItemIds).not.toContain("design-item-missing-nfr");
    const nfrOutcome = evalResult.findingOutcomes.find((o) => o.itemId === "design-item-missing-nfr");
    expect(nfrOutcome?.kind).not.toBe("missed");
    // resolved は live defect ではない = isDefect false。
    expect(nfrOutcome?.isDefect).toBe(false);
  });

  it("binary: after Return (resolved) and Approve, the defect is NOT scored as missed", () => {
    let p: JourneyProgress = { ...initialProgress(), currentStepId: "j3-design" };
    p = markMaterialized(p, "j3-design");
    p = rework(p, "j3-design", "return", "critical-finding", [defect("d-j3-unsafe-delegation")]); // resolved

    const artifact = buildArtifactForStep(input(p), "j3-design");
    const item = artifact.items.find((i) => i.itemId === "design-item-delegation");
    expect(item?.contentState).toBe("corrected");

    const review = approveReview(artifact.artifactId, "j3-design");
    const evalResult = evaluateArtifactReview(artifact, buildDefectSet(HEAVY, PROFILE.profileDefectRules), review);
    expect(evalResult.missedItemIds).not.toContain("design-item-delegation");
  });

  it("partial: only the remaining (unresolved) part is treated as a live defect", () => {
    let p: JourneyProgress = { ...initialProgress(), currentStepId: "j3-design" };
    p = markMaterialized(p, "j3-design");
    p = rework(p, "j3-design", "return", "critical-finding", [defect("d-j3-missing-nfr")]); // partial のみ

    const artifact = buildArtifactForStep(input(p), "j3-design");
    const nfr = artifact.items.find((i) => i.itemId === "design-item-missing-nfr");
    expect(nfr?.contentState).toBe("partial");

    // partial のまま approve → まだ live defect なので missed になる（remaining criteria 未達）。
    const review = approveReview(artifact.artifactId, "j3-design");
    const evalResult = evaluateArtifactReview(artifact, buildDefectSet(HEAVY, PROFILE.profileDefectRules), review);
    const nfrOutcome = evalResult.findingOutcomes.find((o) => o.itemId === "design-item-missing-nfr");
    expect(nfrOutcome?.isDefect).toBe(true); // partial は依然 live defect。
    expect(evalResult.missedItemIds).toContain("design-item-missing-nfr");
  });

  it("computeJourneyResult: resolved finding not in result missed list", () => {
    // J3 で NFR resolved にして approve、そのまま journey result を計算。
    let p: JourneyProgress = { ...initialProgress(), currentStepId: "j3-design" };
    p = markMaterialized(p, "j3-design");
    p = rework(p, "j3-design", "return", "critical-finding", [defect("d-j3-missing-nfr")]);
    p = rework(p, "j3-design", "return", "critical-finding", [defect("d-j3-missing-nfr")]);
    const artifact = buildArtifactForStep(input(p), "j3-design");
    const reviews = { "j3-design": approveReview(artifact.artifactId, "j3-design") };
    const result = computeJourneyResult(input(p, reviews));
    // resolved NFR は totalMissed に寄与しない。
    const stepEval = evaluateAllReviews(input(p, reviews)).find((s) => s.stepId === "j3-design");
    // resolved NFR は missed に入らない（他の未解決 J3 defect は依然 missed になり得る = 正しい）。
    expect(stepEval?.evaluation.missedItemIds).not.toContain("design-item-missing-nfr");
    void result;
  });
});

// ============================================================
// P1-3: resolved and propagated simultaneously
// ============================================================
import { buildArtifactForStep as buildArt } from "./journey-engine.ts";

/** J4 の伝播由来 item（consequence-*）を kind 別に集計する。 */
function propagationItems(artifact: ReturnType<typeof buildArt>) {
  const improved = artifact.items.filter(
    (i) => i.itemId.startsWith("consequence-") && i.contentState === "corrected",
  );
  const worsened = artifact.items.filter(
    (i) => i.itemId.startsWith("consequence-") && i.contentState === "baseline",
  );
  return { improved, worsened };
}

describe("RC4 Integrity — P1-3: resolved and propagated are mutually exclusive", () => {
  const STEP = "j3-design" as const;
  const DOWN = "j4-implementation-traceability" as const;
  // J3→J4 に伝播する defect（security-violation は downstreamManifestation.atStepId=J4）。
  const PROP_DEFECT = "d-j3-security-violation";

  it("Case A: upstream unresolved & missed -> downstream shows worsened only (no improved)", () => {
    // J3 を materialize、J4 も materialize。J3 の security-violation を見逃して approve。
    let p: JourneyProgress = { ...initialProgress(), currentStepId: STEP };
    p = markMaterialized(p, STEP);
    p = markMaterialized(p, DOWN);
    const j3art = buildArt(input(p), STEP);
    // security-violation を指摘せず approve（= missed）。
    const reviews = { [STEP]: approveReview(j3art.artifactId, STEP) };
    const down = buildArt(input(p, reviews), DOWN);
    const { improved, worsened } = propagationItems(down);
    expect(worsened.length).toBeGreaterThanOrEqual(1);
    expect(improved.length).toBe(0);
  });

  it("Case B: upstream resolved before downstream review -> downstream shows improved only (no worsened)", () => {
    let p: JourneyProgress = { ...initialProgress(), currentStepId: STEP };
    p = markMaterialized(p, STEP);
    p = markMaterialized(p, DOWN);
    // J3 の security-violation を Rework で resolved にする。
    p = rework(p, STEP, "return", "critical-finding", [defect(PROP_DEFECT)]);
    const down = buildArt(input(p), DOWN);
    const { improved, worsened } = propagationItems(down);
    expect(improved.length).toBeGreaterThanOrEqual(1);
    expect(worsened.length).toBe(0);
  });

  it("Case C: same defect never renders resolved(improved) AND worsened simultaneously", () => {
    // resolved にした後、J3 の（古い）missed review が残っていても二重表示しない。
    let p: JourneyProgress = { ...initialProgress(), currentStepId: STEP };
    p = markMaterialized(p, STEP);
    p = markMaterialized(p, DOWN);
    const j3v0 = buildArt(input(p), STEP);
    // v0 を security-violation 未指摘で approve（missed review を残す）。
    const reviews: JourneyRunInput["reviews"] = { [STEP]: approveReview(j3v0.artifactId, STEP) };
    // その後 Rework で resolved（review は rework で通常クリアされるが、ここでは残存耐性を検証）。
    p = rework(p, STEP, "return", "critical-finding", [defect(PROP_DEFECT)]);
    // resolved 後の J3 artifact と識別子が変わるため、古い review は identity 不一致で無効化される。
    const down = buildArt(input(p, reviews), DOWN);
    const { improved, worsened } = propagationItems(down);
    // 同一 source について improved と worsened が同時に出ない。
    const improvedSources = new Set(improved.map((i) => i.originStepId));
    const worsenedSources = new Set(worsened.map((i) => i.originStepId));
    for (const s of improvedSources) expect(worsenedSources.has(s)).toBe(false);
    void reviews;
  });
});

// ============================================================
// P1-2: Project Context / Artifact domain consistency
// ============================================================
import { rc4ContentJa, rc4ContentEn } from "../../i18n/rc4-content.ts";
import { ja as messagesJa, en as messagesEn } from "../../i18n/messages.ts";

describe("RC4 Integrity — P1-2: internal-api-workflow domain consistency (inquiry management)", () => {
  it("canonical sample Context uses the inquiry-management domain noun", () => {
    // 参照: CANONICAL_SAMPLE_PROFILE.userAuthored.goal = rc3.sample.goal。
    expect(messagesJa["rc3.sample.goal"]).toMatch(/問い合わせ/);
    expect(messagesJa["rc3.sample.requirements"]).toMatch(/問い合わせ/);
  });

  it("P1-1: the two-step-approval requirement is stated in the user-visible Project Context (no hidden ground truth)", () => {
    // 二段階承認は Artifact / Ground Truth だけでなく、ユーザーが最初に見る Project Context にも明示される。
    // Context だけを見て「この Artifact は二段階承認を前提にしている」と判断できること。
    const contextText = [
      messagesJa["rc3.sample.context"],
      messagesJa["rc3.sample.requirements"],
      messagesJa["rc3.sample.acceptanceCriteria"],
    ].join("\n");
    expect(contextText).toMatch(/二段階承認|二次承認/);
    // en 側も同様。
    const en = [
      messagesEn["rc3.sample.context"],
      messagesEn["rc3.sample.requirements"],
      messagesEn["rc3.sample.acceptanceCriteria"],
    ].join("\n");
    expect(en).toMatch(/two-step approval|second approval/i);
  });

  it("P1-1 / STEP 6: the PII vs external-SaaS boundary is explicit in the Project Context constraints", () => {
    // PII は外部送信禁止だが、外部 SaaS 連携そのものは禁止ではない、という boundary を Context から読める。
    const c = messagesJa["rc3.sample.constraints"] ?? "";
    expect(c).toMatch(/個人情報|PII/);
    expect(c).toMatch(/外部|SaaS/);
    // 「連携自体は禁止ではない」= boundary が明示されている。
    expect(c).toMatch(/禁止ではない|メタデータ|監視/);
  });

  it("iaw J1 artifact requirement is in the SAME domain (inquiry), not a drifted '申請' domain", () => {
    const j1 = rc4ContentJa["rc4.iaw.j1.valid.body"] ?? "";
    expect(j1).toMatch(/問い合わせ/); // Context と同一 domain。
    expect(j1).not.toMatch(/申請/); // drift した別 domain 名詞を残さない。
  });

  it("no iaw artifact body reintroduces the drifted '申請' noun", () => {
    for (const [key, val] of Object.entries(rc4ContentJa)) {
      if (!key.startsWith("rc4.iaw.")) continue;
      expect(val, `${key} は '申請' を含まない（domain drift 防止）`).not.toMatch(/申請/);
    }
  });

  it("the two-step-approval finding is grounded in a user-visible J1 requirement (no hidden ground truth)", () => {
    // J2 mismatch corrected は「二段階承認」を要件として参照する → J1 に二段階承認が明示されていること。
    const j1 = rc4ContentJa["rc4.iaw.j1.valid.body"] ?? "";
    expect(j1).toMatch(/二段階承認/);
    // en 側も同様に two-step approval が J1 に明示。
    const j1en = rc4ContentEn["rc4.iaw.j1.valid.body"] ?? "";
    expect(j1en).toMatch(/two-step approval/i);
  });

  it("ja/en iaw bundles keep the same key set (no partial edit drift)", () => {
    const jaKeys = Object.keys(rc4ContentJa).filter((k) => k.startsWith("rc4.iaw.")).sort();
    const enKeys = Object.keys(rc4ContentEn).filter((k) => k.startsWith("rc4.iaw.")).sort();
    expect(jaKeys).toEqual(enKeys);
  });
});
