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

// ---------- Project Archetype（RC4 Phase 1・Human Decision 1）----------

/**
 * Project Archetype（RC4）。Artifact 本文の語彙・slot 構成を決める（Design §7）。
 * structured input（軸）とは直交する: archetype が「何のプロジェクトか（本文の題材）」を、
 * structured が「その中の性質（defect 活性化・NFR 強度）」を決める。
 * 4 種で確定（Human Decision 1）。runtime AI を使わず、JSON content template から本文を引く。
 */
export type ProjectArchetypeId =
  | "internal-api-workflow" // A. Internal API / Workflow Application
  | "document-search" // B. Document Search / Knowledge Retrieval
  | "event-driven-processing" // C. Event-driven Processing
  | "customer-facing-app"; // D. Customer-facing Business Application

/** 4 Archetype の固定順序（決定的な UI 表示順・canonical source）。 */
export const PROJECT_ARCHETYPE_IDS: readonly ProjectArchetypeId[] = [
  "internal-api-workflow",
  "document-search",
  "event-driven-processing",
  "customer-facing-app",
] as const;

/** ProjectArchetypeId の型ガード（永続復元・境界検証用）。 */
export function isProjectArchetypeId(v: unknown): v is ProjectArchetypeId {
  return typeof v === "string" && (PROJECT_ARCHETYPE_IDS as readonly string[]).includes(v);
}

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

/** Project Context（Setup）= archetype + 2 種入力の束（RC4: archetype を additive 追加）。 */
export interface ProjectContextInput {
  /**
   * Project Archetype（RC4 Phase 1）。Artifact 本文の題材を決める。
   * additive: 未指定の永続データ復元時は default archetype で補完する（Human Decision 10）。
   */
  readonly archetypeId: ProjectArchetypeId;
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
  /**
   * informational（consequence 顕在化）項目の由来 step（P2-3）。
   * 前段の見逃しがどの工程由来かを UI で示すための表示専用メタ。採点には使わない。
   */
  readonly originStepId?: JourneyStepId | undefined;
  /**
   * item 本文の内容状態（RC4 Phase 1 / Final で partial 追加）。
   * 同じ slot でも defect の resolution stage で本文が変わることを表す。
   * - baseline: defect と無関係な通常項目。
   * - defective: defect が有効かつ未解決（欠陥のある本文・stage 0）。
   * - partial: multi-stage defect が改善されたが acceptance criteria 未達の中間 stage。
   * - corrected: 最終 resolution stage に到達（改善された本文）。
   * 採点母集団の決定は reviewability が担う（contentState は本文選択と表示のためのメタ）。
   */
  readonly contentState?: "baseline" | "defective" | "partial" | "corrected" | undefined;
  /**
   * RC4 Final: partial/corrected の resolution stage index（multi-stage defect のみ）。
   * 表示・Diff・履歴で「Revision いくつ相当の改善か」を示す。binary defect では undefined。
   */
  readonly resolutionStageIndex?: number | undefined;
  /** RC4 Final: partial のとき残る課題の locale key（Remaining issue 表示）。 */
  readonly remainingIssueKey?: string | undefined;
  /** RC4 Final: partial のとき「なぜまだ不十分か」の locale key。 */
  readonly whyInsufficientKey?: string | undefined;
  /**
   * 選択された本文 variant の識別子（RC4 Phase 1・Diff の突合キー）。
   * content template の slot × variant を一意に指す。Phase 3 の Diff Engine が before/after を比較する。
   */
  readonly variantKey?: string | undefined;
  /**
   * RC6 P2: この item（slot）自身の変更サマリ locale key（finding 単位）。
   * corrected/partial 化したときに設定する。Diff Engine はこれを finding 単位の reason として使い、
   * 別 finding の理由を reuse しない（step 全体の changeSummaryKeys からの近似 fallback を廃する）。
   */
  readonly changeSummaryKey?: string | undefined;
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
  /**
   * localRevision（RC4 Phase 3 で用語明確化）。当該 step 自身が Human Return → Agent Rework された回数。
   * 歴史的経緯でフィールド名は `revision` のままだが、意味は localRevision（この step のローカル改訂回数）。
   * Artifact identity には使わない（identity は artifactVersion）。
   */
  readonly revision: number;
  /**
   * artifactVersion（RC4 Phase 3・Artifact Identity の唯一の source）。
   * Artifact content 全体の version。content change のたびに増える:
   *  - local Agent Rework（localRevision +1 と同時に +1）
   *  - upstream propagation による content 変化（localRevision 据え置きで +1）
   *  - 将来の Change Scope 等
   * hard invariant: same artifactId(= profileId+stepId+artifactVersion) → same content。
   */
  readonly artifactVersion: number;
  readonly status: ArtifactStatus;
  /**
   * この Artifact を生成した Archetype（RC4 Phase 1）。
   * additive: RC3 経路（generateArtifact v1）でも context.archetypeId から埋まる。
   */
  readonly archetypeId: ProjectArchetypeId;
  /** このリビジョンで解決済みの defect id（Rework で前進・RC4 Phase 1 は空配列が基本）。 */
  readonly resolvedDefectIds: readonly string[];
  /** このリビジョンで未解決の defect id（この step に有効な defect のうち未解決分）。 */
  readonly unresolvedDefectIds: readonly string[];
  /**
   * 前リビジョンからの変更点 locale key（RC4 Phase 1 では defective→corrected になった slot の説明）。
   * revision 0 では空。Phase 3 の Diff/変更サマリ表示が使う。
   */
  readonly changeSummaryKeys: readonly string[];
  /**
   * approve-with-conditions で保持された残存条件の locale key（RC4・Human Decision 3）。
   * Phase 1 では常に空配列（Decision Semantics は後続 Phase）。additive に前方確保する。
   */
  readonly carriedConditionKeys: readonly string[];
  /**
   * RC6 P1-B: 上流工程で確定した accepted upstream fact（この step が前提として扱う値）。
   * 「値が無い」と再要求せず、「確定済みの目標を architecture/validation が満たすか」を評価するための
   * 前提として提示する。derived（永続しない・EffectiveScenarioState から注入）。
   * fact を持たない step では空配列。
   */
  readonly acceptedFacts: readonly AcceptedFactRef[];
}

/**
 * RC6 P1-B: Artifact に載せる accepted upstream fact の表示用参照（locale key のみ・semantic は id）。
 * domain 実体は effective-scenario-state.AcceptedFact。ここでは表示に必要な最小情報だけを持つ。
 */
export interface AcceptedFactRef {
  readonly factId: string;
  readonly sourceStepId: JourneyStepId;
  readonly labelKey: string;
  readonly valueLabelKey: string;
  readonly statementKey: string;
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
 * RC4 Final: Finding / Defect の resolution 状態（data-driven multi-stage resolution）。
 * - unresolved: まだ 1 度も rework されていない（欠陥のまま）。
 * - partial: rework で改善されたが、acceptance criteria をまだ満たしていない中間状態。
 * - resolved: 最終 resolution stage に到達（acceptance criteria を満たした）。
 * binary defect は unresolved → resolved のみ（partial を経由しない）。
 */
export type DefectResolutionState = "unresolved" | "partial" | "resolved";

/**
 * RC4 Final: 1 defect の resolution stage（data-driven）。
 * stage 0 = 未解決（欠陥のある本文）を index 0 とし、以降 Return のたびに index を 1 進める。
 * 最終 index（isTerminal=true）に到達したら resolved。中間 index は partial。
 *
 * すべての defect に人工的な partial を作らない（Human Decision）:
 *  - binary defect: resolutionStages を持たない（generator が defective/corrected の 2 状態で扱う）。
 *  - multi-stage defect: resolutionStages を宣言し、各 stage の本文・残課題を data として持つ。
 *
 * 本文テキストは持たず locale key で参照する（data / logic 分離・tech-stack rule）。
 */
export interface DefectResolutionStage {
  /** 0 起点の stage index（0 = defective/unresolved, 最終 = resolved）。 */
  readonly stageIndex: number;
  /** この stage の resolution 状態。 */
  readonly state: DefectResolutionState;
  /** 最終 stage か（true なら以降 Return しても next stage が無く no-op）。 */
  readonly isTerminal: boolean;
  /**
   * この stage の Artifact 本文 locale key（任意）。
   * data / logic 分離のため通常は content template（slot.stages）が per-archetype に持つ。
   * defect-catalog は archetype 非依存なので、ここに archetype 固有 key を書かない
   * （書くと domain drift になる）。generator は slot.stages を優先し、無ければこの key を使う。
   */
  readonly bodyKey?: string | undefined;
}

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
  /**
   * RC4 Final: data-driven multi-stage resolution stages（additive）。
   * 省略時は binary（unresolved → resolved）。存在する場合、stageIndex 昇順・index 0 起点・
   * 最終要素が isTerminal=true であること（defect-catalog が保証）。
   * Ground Truth の identity / severity / consequence は変えない（解決経路のみを追加する）。
   */
  readonly resolutionStages?: readonly DefectResolutionStage[] | undefined;
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

/**
 * step-level の Approve with Conditions で付ける構造化条件の入力（RC6 P1-A）。
 * ArtifactReview に載せて submit 時に first-class な ConditionalApproval へ変換する。
 * free-text noteText とは別（条件・必要証跡・検証時点を構造化）。
 */
export interface StepConditionInput {
  /** 条件本文（空白のみは無効）。 */
  readonly condition: string;
  /** 必要な証跡（任意）。 */
  readonly requiredEvidence?: string | undefined;
  /** 検証すべき時点 / 期限ゲート（ConditionDueGate 文字列）。 */
  readonly dueGate: "before-release" | "at-release" | "post-release";
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
  /**
   * RC6 P1-A: gateDecision === "approve-with-conditions" のときに付ける構造化条件。
   * step-level の条件付き承認を下流・Completion・Release・Result まで消えずに伝える source。
   * 空/未指定なら条件なし（この場合 UI は approve-with-conditions を選ばせない想定）。
   */
  readonly conditions?: readonly StepConditionInput[] | undefined;
}

export type { DimensionId };
