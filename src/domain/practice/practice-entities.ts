// Practice entities — RC2 で追加する「作る / レビューする」体験の domain 型（技術非依存）。
//
// scenario と同じ思想: data（practice 定義）と logic（決定的 rubric 評価）を分離する。
// 表示文言は locale key（`*Key`）で参照し、semantic data は言語非依存。
// すべての評価は決定的（time / random / locale / mode 非参照）。runtime AI は使わない。
import type { DimensionId } from "../entities.ts";

/** RC2 で追加する practice の種別。 */
export type PracticeKind =
  | "requirement" // Create: 要件成果物を書く
  | "evidence-review" // Review: Evidence を分類する
  | "classification" // Review: action を分類する（Approval / Delegation）
  | "traceability" // Review: Req→AC→impl→test の対応を確認
  | "change-control"; // Decide/Review: 承認後変更への対応を判断

/** すべての practice に共通する識別・表示メタ。 */
export interface PracticeMeta {
  readonly practiceId: string;
  readonly kind: PracticeKind;
  readonly titleKey: string;
  readonly summaryKey: string;
  readonly objectiveKey: string;
  /** この practice が主に関係する Dimension（表示・推薦用。評価スコアは変えない）。 */
  readonly relatedDimensionIds: readonly DimensionId[];
  readonly provenanceRefs: readonly string[];
  /** 決定的に評価できない側面の明示（"semantic 評価は行わない" 等）。 */
  readonly notEvaluatedNoteKey?: string | undefined;
}

// ---------- Requirement Practice（Create） ----------

export type RequirementFieldId =
  | "goal"
  | "targetUser"
  | "inScope"
  | "outOfScope"
  | "constraints"
  | "acceptanceCriteria";

export interface RequirementFieldSpec {
  readonly fieldId: RequirementFieldId;
  readonly labelKey: string;
  readonly required: boolean;
  /** acceptanceCriteria は複数行を要素として数える（min 件数）。他は非 null で presence 判定。 */
  readonly multiline: boolean;
  /** multiline のとき、最低件数（例: Acceptance Criteria は 2 件以上）。 */
  readonly minItems?: number | undefined;
}

export interface RequirementPractice extends PracticeMeta {
  readonly kind: "requirement";
  readonly fields: readonly RequirementFieldSpec[];
}

// ---------- Evidence Review Practice（Review） ----------

export type EvidenceClassification = "sufficient" | "insufficient" | "missing-required";

export interface EvidenceItem {
  readonly itemId: string;
  readonly labelKey: string;
  readonly descriptionKey: string;
  /** 決定的な正解分類。 */
  readonly expected: EvidenceClassification;
  /** なぜその分類か（feedback の "why"）。 */
  readonly rationaleKey: string;
  readonly relatedDimensionIds: readonly DimensionId[];
}

export interface EvidenceReviewPractice extends PracticeMeta {
  readonly kind: "evidence-review";
  readonly items: readonly EvidenceItem[];
}

// ---------- Classification Practice（Approval / Delegation の Review） ----------

export type ClassificationBucket = "agent-autonomous" | "human-approval" | "block";

export interface ClassificationAction {
  readonly actionId: string;
  readonly labelKey: string;
  /** 判断材料（risk / impact / reversibility / evidence）を表示するための key。 */
  readonly contextKey: string;
  readonly expected: ClassificationBucket;
  readonly rationaleKey: string;
  readonly relatedDimensionIds: readonly DimensionId[];
}

export interface ClassificationPractice extends PracticeMeta {
  readonly kind: "classification";
  readonly buckets: readonly ClassificationBucket[];
  readonly actions: readonly ClassificationAction[];
}

// ---------- Traceability Practice（Review） ----------

/** Req → AC → Implementation → Test → Evidence の 1 本の鎖。 */
export interface TraceChain {
  readonly chainId: string;
  readonly requirementKey: string;
  readonly acceptanceCriterionKey: string;
  readonly implementationKey: string;
  readonly testKey: string;
  /** この鎖が完全か（欠落リンクが無いか）の正解。 */
  readonly expectedComplete: boolean;
  /** 欠落・不整合の説明（feedback）。 */
  readonly rationaleKey: string;
  /** どのリンクが欠落しているか（表示用。expectedComplete=false のとき）。 */
  readonly missingLink?: "requirement" | "acceptance" | "implementation" | "test" | undefined;
}

export interface TraceabilityPractice extends PracticeMeta {
  readonly kind: "traceability";
  readonly chains: readonly TraceChain[];
}

// ---------- Change Control Practice（Decide/Review） ----------

export type ChangeControlResponse =
  | "continue"
  | "re-evaluate"
  | "return-to-previous"
  | "re-approve"
  | "change-scope";

export interface ChangeControlCase {
  readonly caseId: string;
  readonly promptKey: string;
  readonly contextKey: string;
  readonly options: readonly ChangeControlResponse[];
  readonly expected: ChangeControlResponse;
  readonly rationaleKey: string;
  readonly relatedDimensionIds: readonly DimensionId[];
}

export interface ChangeControlPractice extends PracticeMeta {
  readonly kind: "change-control";
  readonly cases: readonly ChangeControlCase[];
}

export type Practice =
  | RequirementPractice
  | EvidenceReviewPractice
  | ClassificationPractice
  | TraceabilityPractice
  | ChangeControlPractice;
