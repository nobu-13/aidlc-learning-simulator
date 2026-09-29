// AdoptionOutput — RC4 Final（STEP H）。Adoption Review 完了時に「実務へ持ち帰れる」成果物を
// Journey 結果から **決定的に derive** する。runtime AI / 外部 API は使わない。
//
// pure・決定的（time / random / locale 非参照）。表示文言は locale key で返し、UI が resolve する。
//
// 5 セクション（要件）:
//  1. Gate Map            — 各工程にどの承認が必要か（Human approval required / conditional / mandatory）。
//  2. Responsibility      — Human / Agent の役割分担。
//  3. Approval Policy     — Completion ≠ Release の承認方針。
//  4. Evidence Checklist  — Release までに揃えるべきエビデンス。
//  5. Pilot Next Action   — 自分のプロジェクトへ適用する次の一歩。
//
// これらは「学習の一般原則」を Journey の実結果（見逃し・rework・decision）で色付けした
// derived output。Ground Truth 思想は変えない。
import type { JourneyStepId } from "./journey-entities.ts";
import type { JourneyProgress } from "./rework-state-machine.ts";
import type { JourneyFinalResult } from "./journey-engine.ts";

/** Gate の必須度。 */
export type GateRequirement = "mandatory-human" | "conditional" | "informational";

export interface AdoptionGateRow {
  readonly stepId: JourneyStepId;
  readonly requirement: GateRequirement;
  /** この工程で今回 Journey 上 unresolved が残ったか（実結果由来の注意喚起）。 */
  readonly hadUnresolved: boolean;
}

export interface AdoptionResponsibility {
  /** Human が担う責務の locale key 群。 */
  readonly human: readonly string[];
  /** Agent が担う責務の locale key 群。 */
  readonly agent: readonly string[];
}

export interface AdoptionApprovalPolicy {
  /** Completion gate の方針 locale key。 */
  readonly completionKey: string;
  /** Release gate の方針 locale key。 */
  readonly releaseKey: string;
  /** Completion ≠ Release を明示する注意 locale key。 */
  readonly separationKey: string;
}

export interface AdoptionOutput {
  readonly gateMap: readonly AdoptionGateRow[];
  readonly responsibility: AdoptionResponsibility;
  readonly approvalPolicy: AdoptionApprovalPolicy;
  /** Evidence Checklist の項目 locale key 群。 */
  readonly evidenceChecklist: readonly string[];
  /** Pilot Next Action の項目 locale key 群（今回結果で優先度が変わる）。 */
  readonly pilotNextActions: readonly string[];
}

/** review 対象 6 工程（J1..J6）の gate 必須度（決定的・方法論由来）。 */
const GATE_REQUIREMENT: Partial<Record<JourneyStepId, GateRequirement>> = {
  "j1-requirements": "mandatory-human",
  "j2-acceptance-scope": "mandatory-human",
  "j3-design": "mandatory-human",
  "j4-implementation-traceability": "conditional",
  "j5-test-strategy": "conditional",
  "j6-test-evidence": "mandatory-human",
  "j7-completion-approval": "mandatory-human",
  "j8-release-approval": "mandatory-human",
};

const GATE_STEP_ORDER: readonly JourneyStepId[] = [
  "j1-requirements",
  "j2-acceptance-scope",
  "j3-design",
  "j4-implementation-traceability",
  "j5-test-strategy",
  "j6-test-evidence",
];

/**
 * Adoption Output を決定的に構築する。
 * result（最終評価）と progress（rework 履歴・完了）から、今回の Journey で残った弱点を
 * Pilot Next Action / Gate Map の注意喚起へ反映する。
 */
export function buildAdoptionOutput(
  result: JourneyFinalResult,
  progress: JourneyProgress,
): AdoptionOutput {
  // rework された工程は「気づいて直した」= 相対的に強い。rework されず missed が残った工程を弱点とみなす。
  const reworkedSteps = new Set<JourneyStepId>();
  for (const e of progress.reworkHistory) {
    if (e.isNoOpAttempt !== true) reworkedSteps.add(e.toStepId);
  }

  const gateMap: AdoptionGateRow[] = GATE_STEP_ORDER.map((stepId) => ({
    stepId,
    requirement: GATE_REQUIREMENT[stepId] ?? "conditional",
    // 今回 missed が全体で残り、かつこの工程を rework していない → 注意（hadUnresolved）。
    hadUnresolved: result.totalMissed > 0 && !reworkedSteps.has(stepId),
  }));

  const responsibility: AdoptionResponsibility = {
    human: [
      "rc4.adopt.resp.human.approve",
      "rc4.adopt.resp.human.risk",
      "rc4.adopt.resp.human.exception",
    ],
    agent: [
      "rc4.adopt.resp.agent.draft",
      "rc4.adopt.resp.agent.revise",
      "rc4.adopt.resp.agent.evidence",
    ],
  };

  const approvalPolicy: AdoptionApprovalPolicy = {
    completionKey: "rc4.adopt.policy.completion",
    releaseKey: "rc4.adopt.policy.release",
    separationKey: "rc4.adopt.policy.separation",
  };

  const evidenceChecklist: string[] = [
    "rc4.adopt.evidence.acceptance",
    "rc4.adopt.evidence.testRun",
    "rc4.adopt.evidence.nfr",
    "rc4.adopt.evidence.traceability",
    "rc4.adopt.evidence.risk",
  ];

  // Pilot Next Action: 今回結果で優先度を変える（決定的）。
  const pilotNextActions: string[] = [];
  if (result.totalMissed > 0) {
    // 見逃しが残った → まず Human review gate を厚くする助言を先頭へ。
    pilotNextActions.push("rc4.adopt.pilot.strengthenReview");
  }
  if (result.consequences.length > 0) {
    pilotNextActions.push("rc4.adopt.pilot.upstreamFirst");
  }
  // 常に入れる基本の次アクション。
  pilotNextActions.push("rc4.adopt.pilot.pickOneGate");
  pilotNextActions.push("rc4.adopt.pilot.defineEvidence");
  pilotNextActions.push("rc4.adopt.pilot.runSmall");

  return { gateMap, responsibility, approvalPolicy, evidenceChecklist, pilotNextActions };
}
