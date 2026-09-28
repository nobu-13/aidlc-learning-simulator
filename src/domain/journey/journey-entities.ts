// RC3 Journey entities — Artifact-centric Learning Experience の domain 型（技術非依存）。
//
// RC2 の思想を踏襲: data（Journey/Artifact/Defect 定義）と logic（決定的 generator / evaluator）を分離。
// 表示文言は locale key（`*Key`）で参照し、semantic data は言語非依存。すべて pure・決定的
// （time / random / locale / mode 非参照）。runtime AI は使わない。
//
// 用語の区別（Design §5）: ここでの Journey Step は「Simulator の教育用 grouping」であり、
// 公式 AI-DLC Stage 名と 1:1 ではない。sourceConceptRefs / provenance で対応を示す。
import type { DimensionId } from "../entities.ts";

// ---------- Journey ----------

/**
 * Core Journey の 8 Step（採点対象）。Project Context は Setup であり Core Journey に数えない
 * （Human Decision 1）。番号は教育用であり公式 AI-DLC Stage 番号ではない。
 */
export type JourneyStepId =
  | "j1-requirements" // Requirements Create
  | "j2-acceptance-scope" // Acceptance Criteria / Scope Review
  | "j3-design" // Design Review（Functional/Domain + NFR/Architecture の 2 Section を内包）
  | "j4-implementation-traceability" // Implementation / Traceability Review
  | "j5-test-strategy" // Test Strategy Review
  | "j6-test-evidence" // Test / Evidence Review
  | "j7-completion-approval" // Completion Approval
  | "j8-release-approval"; // Release Approval

/** Core Journey の固定順序（決定的な進行順）。 */
export const JOURNEY_STEP_IDS: readonly JourneyStepId[] = [
  "j1-requirements",
  "j2-acceptance-scope",
  "j3-design",
  "j4-implementation-traceability",
  "j5-test-strategy",
  "j6-test-evidence",
  "j7-completion-approval",
  "j8-release-approval",
] as const;

/** Setup（採点対象外）。 */
export type SetupStepId = "setup-project-context";

/** J3 Design Review 内部の Review Section（別 Stage にしない・Human Decision 1）。 */
export type DesignReviewSectionId = "functional-domain" | "nfr-architecture";

/** Journey Step の分類（Review 中心 / Create / Approval）。 */
export type JourneyStepKind =
  | "create" // J1: 成果物を書く
  | "artifact-review" // J2–J6: Artifact を Review する
  | "approval"; // J7/J8: 承認判断

// ---------- Structured control input（Ground Truth の源・Design §8）----------

/**
 * Structured control input の軸（enum 値）。User-authored 自由文とは分離し、
 * これらだけを deterministic generation / defect injection / consequence 計算に使う（Human Decision 2）。
 */
export type WorkloadCharacteristic = "cpu-bound" | "io-bound" | "data-heavy" | "interactive";
export type DataSensitivity = "public" | "internal" | "confidential" | "personal-info";
export type AvailabilityRequirement = "best-effort" | "standard" | "high" | "critical";
export type ExternalDependency = "none" | "some" | "heavy";
export type OperationalCriticality = "low" | "medium" | "high";
export type ReleaseImpact = "low" | "medium" | "high";
export type Reversibility = "reversible" | "partially-reversible" | "irreversible";
export type ApprovalRequirement = "single" | "dual" | "committee";

/** 構造化入力の 1 セット（Ground Truth の決定的な源）。 */
export interface StructuredControlInput {
  readonly workload: WorkloadCharacteristic;
  readonly dataSensitivity: DataSensitivity;
  readonly availability: AvailabilityRequirement;
  readonly externalDependency: ExternalDependency;
  readonly operationalCriticality: OperationalCriticality;
  readonly releaseImpact: ReleaseImpact;
  readonly reversibility: Reversibility;
  readonly approvalRequirement: ApprovalRequirement;
}

/** 構造化入力の軸 id（UI 表示・永続化の canonical key）。 */
export type StructuredInputFieldId = keyof StructuredControlInput;

export const STRUCTURED_INPUT_FIELD_IDS: readonly StructuredInputFieldId[] = [
  "workload",
  "dataSensitivity",
  "availability",
  "externalDependency",
  "operationalCriticality",
  "releaseImpact",
  "reversibility",
  "approvalRequirement",
] as const;

/** 各軸で選択可能な値（決定的・順序固定）。 */
export const STRUCTURED_INPUT_OPTIONS: {
  readonly [K in StructuredInputFieldId]: readonly StructuredControlInput[K][];
} = {
  workload: ["cpu-bound", "io-bound", "data-heavy", "interactive"],
  dataSensitivity: ["public", "internal", "confidential", "personal-info"],
  availability: ["best-effort", "standard", "high", "critical"],
  externalDependency: ["none", "some", "heavy"],
  operationalCriticality: ["low", "medium", "high"],
  releaseImpact: ["low", "medium", "high"],
  reversibility: ["reversible", "partially-reversible", "irreversible"],
  approvalRequirement: ["single", "dual", "committee"],
} as const;

/**
 * User-authored 自由文（Design §8）。preserve / quote downstream するが semantic 採点しない。
 * 生テキスト（locale key ではない）。
 */
export type UserAuthoredFieldId =
  | "goal"
  | "projectContext"
  | "requirements"
  | "acceptanceCriteria"
  | "constraints"
  | "notes";

export const USER_AUTHORED_FIELD_IDS: readonly UserAuthoredFieldId[] = [
  "goal",
  "projectContext",
  "requirements",
  "acceptanceCriteria",
  "constraints",
  "notes",
] as const;

/** Project Context（Setup）= 2 種入力の束。 */
export interface ProjectContextInput {
  readonly userAuthored: Readonly<Partial<Record<UserAuthoredFieldId, string>>>;
  readonly structured: StructuredControlInput;
}

// ---------- Artifact ----------

/** Artifact 種別（Design §7、統合後）。 */
export type ArtifactKind =
  | "project-context"
  | "requirements"
  | "acceptance-criteria"
  | "design"
  | "traceability"
  | "test-strategy"
  | "evidence"
  | "change-request"
  | "completion-approval"
  | "release-approval";

export type ArtifactStatus = "draft" | "under-review" | "returned" | "revised" | "approved";

/**
 * 項目の採点可能性（FIX 1）。
 * - finding-candidate: Review で defect か否かを判断する対象（valid / distractor / defect item）。
 *   TP/FP/FN/TN の母集団に含める。
 * - informational: 前段の見逃しで顕在化した情報（consequence manifestation）。新しい Finding 候補ではない。
 *   採点母集団から除外する（click/閲覧しても FP にしない）。
 * - non-scored: user-authored 引用（quote のみ・semantic 採点しない）。
 */
export type ArtifactItemReviewability = "finding-candidate" | "informational" | "non-scored";

/**
 * Artifact 内の 1 項目（Review 対象の最小単位）。defect を持つとは限らない（Design §7 / 要件 7）。
 * reviewability が採点対象性を決める（FIX 1）。userDerived は表示区分（引用）を示す派生フラグ。
 */
export interface ArtifactItem {
  readonly itemId: string;
  readonly labelKey: string;
  readonly bodyKey: string;
  /** section 区分（J3 の functional-domain / nfr-architecture 等）。省略時は既定 section。 */
  readonly sectionId?: DesignReviewSectionId | string | undefined;
  /** 採点可能性（FIX 1）。ReviewEvaluator はこれで母集団を決める。 */
  readonly reviewability: ArtifactItemReviewability;
  /** user-authored 引用か（true なら quote 表示・採点しない。reviewability=non-scored と一致）。 */
  readonly userDerived: boolean;
  /** この項目に紐づく defect id（あれば）。Ground Truth 側で expected を判定するための参照。 */
  readonly defectId?: string | undefined;
  /** ambiguous-looking but valid / distractor 等の「罠」であることを示す（有効項目・要件 7）。finding-candidate のまま。 */
  readonly distractor?: boolean | undefined;
}

/**
 * 生成された Artifact（deterministic generator の出力）。表示文言は locale key、
 * semantic data（defect の有無・種類）は語り口ではなく id で表現。
 */
export interface GeneratedArtifact {
  readonly artifactId: string;
  readonly journeyStepId: JourneyStepId;
  readonly kind: ArtifactKind;
  readonly titleKey: string;
  readonly summaryKey: string;
  readonly items: readonly ArtifactItem[];
  /** user-authored 引用（field id → 生テキスト）。preserve / quote のみ。 */
  readonly quotedUserText: Readonly<Partial<Record<UserAuthoredFieldId, string>>>;
  readonly provenanceRefs: readonly string[];
  readonly revision: number;
  readonly status: ArtifactStatus;
}

// ---------- Defect ----------

/** Controlled Defect カテゴリ（Design §9）。 */
export type DefectCategory =
  | "requirement-omission"
  | "acceptance-criteria-mismatch"
  | "scope-creep"
  | "missing-nfr"
  | "security-constraint-violation"
  | "traceability-gap"
  | "missing-test-coverage"
  | "insufficient-evidence"
  | "approval-boundary-violation"
  | "unsafe-delegation"
  | "incomplete-rollback"
  | "unresolved-risk";

export type Severity = "low" | "medium" | "high";

/**
 * Defect 定義（Ground Truth）。structured input + step + profile から決定的に有効化される。
 * downstreamManifestation は「見逃した場合にどの後工程でどう顕在化するか」（Consequence Engine の入力）。
 */
export interface DefectDefinition {
  readonly defectId: string;
  readonly category: DefectCategory;
  readonly journeyStepId: JourneyStepId;
  /** この項目 id に紐づく（ArtifactItem.defectId と対応）。 */
  readonly itemId: string;
  readonly expectedSeverity: Severity;
  readonly rationaleKey: string;
  /** この defect が寄与する 9 Dimension（DimensionEffectAdapter 用）。 */
  readonly relatedDimensionIds: readonly DimensionId[];
  /** 見逃したときの後工程での顕在化（Consequence）。 */
  readonly downstreamManifestation?:
    | {
        readonly atStepId: JourneyStepId;
        readonly manifestItemKey: string;
        readonly addsRiskDimensionIds: readonly DimensionId[];
      }
    | undefined;
}

// ---------- Review（新 domain model・Human Decision 3）----------

export type GateDecision =
  | "approve"
  | "approve-with-conditions"
  | "return-for-rework"
  | "change-scope"
  | "block";

/** Completion / Release Approval の判断（J7/J8）。 */
export type ApprovalDecision = "approve" | "approve-with-conditions" | "return" | "block";

/** User が Review 中に選択した finding（どの項目を defect と判断したか）。 */
export interface ReviewFinding {
  readonly itemId: string;
  /** User が付けた severity 判断（任意）。 */
  readonly severity?: Severity | undefined;
}

/** 1 つの Artifact に対する User の Review（採点入力）。 */
export interface ArtifactReview {
  readonly artifactId: string;
  readonly journeyStepId: JourneyStepId;
  /** User が「defect」と指摘した項目。 */
  readonly findings: readonly ReviewFinding[];
  readonly gateDecision: GateDecision;
  /** 採点対象外の自由メモ（quote のみ）。 */
  readonly noteText?: string | undefined;
}

export type { DimensionId };
