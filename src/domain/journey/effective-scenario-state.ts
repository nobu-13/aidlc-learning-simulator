// RC6 — Grounded State Propagation。EffectiveScenarioState は「今この Journey が到達している
// 実効的な scenario 状態」を 1 箇所へ集約した pure derived model。
//
// 背景（RC6 CORE DIAGNOSIS）:
//   Product semantic に複数の source of truth が散在し（initial archetype / structured context /
//   current upstream Artifact state / resolvedDefectIds / defectStages / conditional approvals /
//   static Ground Truth / generated content）、各 consumer（Artifact Generator / Evaluator /
//   Propagation / Decision Readiness / Result）がその一部だけを見ていた。結果:
//     - P1-A: step-level Conditional Approval が下流・Completion・Release・Result から消える。
//     - P1-B: 上流で確定した positive fact（可用性目標＝RTO/RPO 相当）が下流生成へ渡らない。
//     - P1-C: structured input（Data sensitivity 等）が Ground Truth を実際に変えない。
//
// このモジュールは「同じ state から同じ導出」を保証するための single derived model を提供する。
// 各 consumer は過去状態を勝手に推測せず、EffectiveScenarioState を経由して参照する。
//
// pure・決定的（time / random / locale / mode 非参照）。runtime AI を使わない。
// 表示文言は locale key で参照する（semantic data は言語非依存）。
import type {
  ConditionalApproval,
} from "./conditional-approval.ts";
import { openConditions as computeOpenConditions } from "./conditional-approval.ts";
import type {
  AvailabilityRequirement,
  DataSensitivity,
  JourneyStepId,
  StructuredControlInput,
  WorkloadCharacteristic,
} from "./journey-entities.ts";

// ---------- Accepted Upstream Facts（上流で確定した positive fact） ----------

/**
 * 上流工程で確定した「値そのもの」（positive fact）。下流はこれを前提として扱う（P1-B）。
 * defect（欠陥）ではなく「確定した要件・目標値」を表す。downstream は「値が無い」と再要求せず、
 * 「その値を architecture / validation が満たすか」を評価する。
 *
 * factId は決定的な安定 id（locale key の suffix にも使う）。value は enum 由来の安全な語彙のみ。
 */
export interface AcceptedFact {
  /** 安定 id（例: "availability-target"）。UI/locale の参照キー。 */
  readonly factId: string;
  /** この fact を確定した工程（source of truth の由来）。 */
  readonly sourceStepId: JourneyStepId;
  /** この fact を前提として扱うべき下流工程。 */
  readonly relevantAtStepId: JourneyStepId;
  /** fact の値を表す enum 語彙（自由文を含めない・safe）。 */
  readonly value: string;
  /** 値そのものの表示 locale key（"確定済み: <value>" を組み立てるための語彙 key）。 */
  readonly valueLabelKey: string;
  /** 「確定済み前提」であることを示す説明 locale key。 */
  readonly statementKey: string;
}

/**
 * 可用性要件（availability）から「確定済みの可用性目標（RTO/RPO 相当の NFR fact）」を決定的に導く。
 *
 * RC6 P1-B の設計判断:
 *   RTO/RPO を新しい structured 軸として増やすと archetype content / 永続 schema / 全 defect rule に
 *   波及し「大規模 redesign 禁止」に反する。既存の availability 軸を「上流で確定した目標値」として
 *   下流へ propagate することで、Requirements で確定した目標を Design が再要求しない不変を satisfy する。
 *   availability の各レベルに対応する目標水準（valueLabelKey）は locale が RTO/RPO 文言を持つ。
 *
 * best-effort / standard は「明示目標なし」の水準なので fact 化しない（下流で目標を問うのは妥当）。
 * high / critical は「測定可能な目標が確定している」水準として fact 化する。
 */
export function deriveAvailabilityTargetFact(
  availability: AvailabilityRequirement,
): AcceptedFact | undefined {
  if (availability !== "high" && availability !== "critical") return undefined;
  return {
    factId: "availability-target",
    sourceStepId: "j1-requirements",
    relevantAtStepId: "j3-design",
    value: availability,
    valueLabelKey: `rc6.fact.availabilityTarget.value.${availability}`,
    statementKey: "rc6.fact.availabilityTarget.statement",
  };
}

/**
 * structured input から accepted upstream facts を決定的に導出する。
 * 現状は可用性目標のみ（availability=high/critical）。additive に拡張可能。
 * 決定的順序（factId 昇順）で返す。
 */
export function deriveAcceptedUpstreamFacts(
  structured: StructuredControlInput,
): readonly AcceptedFact[] {
  const facts: AcceptedFact[] = [];
  const availabilityFact = deriveAvailabilityTargetFact(structured.availability);
  if (availabilityFact !== undefined) facts.push(availabilityFact);
  return facts
    .slice()
    .sort((a, b) => (a.factId < b.factId ? -1 : a.factId > b.factId ? 1 : 0));
}

/** 指定 step が前提として扱うべき accepted facts（relevantAtStepId 一致）。 */
export function acceptedFactsForStep(
  facts: readonly AcceptedFact[],
  stepId: JourneyStepId,
): readonly AcceptedFact[] {
  return facts.filter((f) => f.relevantAtStepId === stepId);
}

// ---------- Data Sensitivity Grounding（P1-C） ----------

/**
 * Data sensitivity から「artifact/評価に効く semantic」を決定的に導く（P1-C の grounding）。
 *
 * これは buildDefectSet（Ground Truth）とは別に、「structured input が本文/評価へ observable に
 * 影響する」ことを保証するための derived semantic。UI が「structured input drives artifact
 * generation」と宣言する契約を満たす。
 *
 *  - personal-info / confidential: PII boundary が有効。外部送信は defect になりうる。
 *    artifact 本文に「機密データ境界」を明示する slot 差が出る。
 *  - internal: 中間。境界は存在するが PII ほど厳格でない。
 *  - public: PII boundary 無し。外部 SaaS 利用そのものは（他制約が無ければ）defect にしない。
 */
export interface DataSensitivityGrounding {
  readonly sensitivity: DataSensitivity;
  /** PII 相当の厳格な境界が有効か（personal-info / confidential）。 */
  readonly piiBoundaryActive: boolean;
  /** 外部送信を security defect として扱うか（piiBoundaryActive と同義だが意味を明示）。 */
  readonly externalTransmissionIsViolation: boolean;
  /** artifact 本文で機密区分を示す locale key（data classification 明示）。 */
  readonly classificationLabelKey: string;
}

export function deriveDataSensitivityGrounding(
  sensitivity: DataSensitivity,
): DataSensitivityGrounding {
  const piiBoundaryActive = sensitivity === "personal-info" || sensitivity === "confidential";
  return {
    sensitivity,
    piiBoundaryActive,
    externalTransmissionIsViolation: piiBoundaryActive,
    classificationLabelKey: `rc6.grounding.dataClassification.${sensitivity}`,
  };
}

// ---------- Workload Grounding（Parameter Sensitivity: workload） ----------

/**
 * workload 特性を artifact の文脈情報へ ground する（Parameter Sensitivity Matrix: workload）。
 * data-heavy / interactive / cpu-bound / io-bound で文脈文言（設計上の焦点）が変わる。
 * defect は変えない（Ground Truth 不変）。observable な artifact content 差を保証するための grounding。
 */
export function workloadGroundingLabelKey(
  workload: WorkloadCharacteristic,
): string {
  return `rc6.grounding.workload.${workload}`;
}

// ---------- EffectiveScenarioState（single derived model） ----------

/**
 * 今この Journey が到達している実効 scenario 状態。全 consumer が共有する single source。
 *
 * 「勝手に過去状態を推測しない」ための集約:
 *  - structuredContext     : Ground Truth の源（canonical structured input）。
 *  - acceptedUpstreamFacts : 上流で確定した positive fact（下流生成の前提・P1-B）。
 *  - dataSensitivityGrounding: structured input が本文/評価へ効くための grounding（P1-C）。
 *  - openConditions        : 未解決の Conditional Approval（下流・Completion・Release・Result・P1-A）。
 *
 * findingStates / resolvedFacts 相当は既存 JourneyProgress（resolvedDefectIds / defectStages）と
 * review 評価（evaluateArtifactReview）が保持しているため、ここでは重複させず参照ポインタとして
 * 扱う（重複した source of truth を新設しない）。
 */
export interface EffectiveScenarioState {
  readonly structuredContext: StructuredControlInput;
  readonly acceptedUpstreamFacts: readonly AcceptedFact[];
  readonly dataSensitivityGrounding: DataSensitivityGrounding;
  readonly openConditions: readonly ConditionalApproval[];
}

/**
 * EffectiveScenarioState を決定的に構築する。
 * 同じ入力（structured + conditionalApprovals）→ 同じ EffectiveScenarioState。
 */
export function buildEffectiveScenarioState(args: {
  readonly structured: StructuredControlInput;
  readonly conditionalApprovals: readonly ConditionalApproval[];
}): EffectiveScenarioState {
  return {
    structuredContext: args.structured,
    acceptedUpstreamFacts: deriveAcceptedUpstreamFacts(args.structured),
    dataSensitivityGrounding: deriveDataSensitivityGrounding(args.structured.dataSensitivity),
    openConditions: computeOpenConditions(args.conditionalApprovals),
  };
}
