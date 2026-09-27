// Domain entities — U1: aidlc-learning-simulator-web
//
// entities.md の logical model を TypeScript 型として表現する（技術非依存の型）。
// 表示文言は entity に持たず locale key（`*Key`）で参照する。semantic data は言語非依存。
// 区分:
//  - authoring semantic data（ScenarioCatalog 所有）: ScenarioSet / Scenario / Stage /
//    DecisionPoint / DecisionOption / LearningPoint / ProvenanceEntry / EffectRule / Dimension
//  - runtime / result data: ScenarioSession / DecisionRecord / DimensionOutcome /
//    LearningResult / AdoptionReviewMemo
//
// これらは domain の pure な型定義であり、React / localStorage / raw JSON / zod / locale text に依存しない（ADR-009）。

// ---------- 共通 enum / スカラ ----------

/** 評価軸（9 軸固定）。Learning Concept とは別体系。 */
export type DimensionId =
  | "requirement-clarity"
  | "acceptance-criteria-coverage"
  | "evidence-quality"
  | "approval-boundary"
  | "delegation-quality"
  | "risk-handling"
  | "traceability"
  | "rework"
  | "remaining-risks";

/** 9 Dimension の固定順序（決定的出力・UI 表示順の canonical source）。 */
export const DIMENSION_IDS: readonly DimensionId[] = [
  "requirement-clarity",
  "acceptance-criteria-coverage",
  "evidence-quality",
  "approval-boundary",
  "delegation-quality",
  "risk-handling",
  "traceability",
  "rework",
  "remaining-risks",
] as const;

/** 非単調 Dimension（過少・過剰の双方を negative 側へ寄せる。BR3.4）。 */
export const NON_MONOTONIC_DIMENSIONS: ReadonlySet<DimensionId> = new Set<DimensionId>([
  "delegation-quality",
  "approval-boundary",
  "risk-handling",
]);

/** 離散 5 段階の寄与・結果レベル（BR3.3）。 */
export type ContributionLevel =
  | "strong-negative"
  | "negative"
  | "neutral"
  | "positive"
  | "strong-positive";

export type ScenarioKind = "core" | "focus";

/** provenance 4 区分（BR4.1 / FR6.8）。 */
export type ProvenanceCategory =
  | "ai-dlc-spec"
  | "harness-behavior"
  | "simulator-interpretation"
  | "simulation-assumption";

/** 3 学習モード（同一 engine / data・評価不変。BR5.2）。 */
export type ExperienceMode = "guided" | "simulation" | "adoption-review";

export type Locale = "ja" | "en";

// ---------- authoring semantic data ----------

export interface EffectRule {
  readonly effectRuleId: string;
  readonly dimensionId: DimensionId;
  readonly contribution: ContributionLevel;
  /**
   * 決定的な述語（Scenario context / DecisionRecord 列に対して評価）。
   * time / random / locale / mode を参照しない・副作用なし（BR3.1）。省略時は無条件適用。
   */
  readonly condition?: EffectCondition;
  readonly rationaleKey?: string;
  readonly learningPointRef?: string;
}

/**
 * EffectRule.condition の決定的述語表現（data-driven・宣言的）。
 * requires-decision: 指定 optionId 群のいずれかが decision 列に含まれるとき真。
 * absent-decision: 指定 optionId 群がいずれも含まれないとき真。
 */
export type EffectCondition =
  | { readonly kind: "requires-decision"; readonly anyOfOptionIds: readonly string[] }
  | { readonly kind: "absent-decision"; readonly noneOfOptionIds: readonly string[] };

export interface Dimension {
  readonly dimensionId: DimensionId;
  readonly labelKey: string;
  readonly monotonicity: "monotonic" | "non-monotonic";
}

export interface ProvenanceEntry {
  readonly provenanceId: string;
  readonly category: ProvenanceCategory;
  /** category=ai-dlc-spec のとき必須（AI-DLC v2.10.0 一次情報 reference）。 */
  readonly reference?: string;
  readonly noteKey: string;
}

export interface DecisionOption {
  readonly optionId: string;
  readonly labelKey: string;
  readonly effectRuleRefs: readonly string[];
  readonly provenanceRefs: readonly string[];
  /** 省略時は Stage の次順へ既定遷移。dangling は Loader が reject。"terminal" は終端。 */
  readonly nextRef?: string;
}

export interface DecisionPoint {
  readonly decisionPointId: string;
  readonly promptKey: string;
  readonly optionIds: readonly string[];
  readonly learningPointRefs: readonly string[];
  readonly important: boolean;
  /** important=true なら min 1（BR4.3 / BR1.6）。 */
  readonly provenanceRefs: readonly string[];
}

export interface Stage {
  readonly stageId: string;
  readonly titleKey: string;
  readonly decisionPointIds: readonly string[];
}

export interface LearningPoint {
  readonly learningPointId: string;
  readonly conceptId: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  /** min 1（BR4.3）。 */
  readonly provenanceRefs: readonly string[];
  readonly betterAlternativeRef?: string;
}

export interface Scenario {
  readonly scenarioId: string;
  readonly kind: ScenarioKind;
  readonly titleKey: string;
  readonly summaryKey: string;
  readonly learningObjectiveIds: readonly string[];
  readonly stageIds: readonly string[];
  readonly learningPointIds: readonly string[];
  readonly tags: readonly string[];
  readonly provenanceRefs: readonly string[];
}

/** build-time 同梱 Scenario JSON 1 ファイル分の外部表現のルート。 */
export interface ScenarioSet {
  readonly schemaVersion: number;
  readonly scenario: Scenario;
  readonly stages: readonly Stage[];
  readonly decisionPoints: readonly DecisionPoint[];
  readonly decisionOptions: readonly DecisionOption[];
  readonly learningPoints: readonly LearningPoint[];
  readonly effectRules: readonly EffectRule[];
  readonly provenanceEntries: readonly ProvenanceEntry[];
}

/**
 * validate 済みで immutable な domain 定義。ScenarioLoader が ScenarioSet から構築する。
 * 参照解決済みの index を持ち、runtime は ID から O(1) で辿れる。
 */
export interface ValidatedScenario {
  readonly scenario: Scenario;
  readonly stages: ReadonlyMap<string, Stage>;
  readonly decisionPoints: ReadonlyMap<string, DecisionPoint>;
  readonly decisionOptions: ReadonlyMap<string, DecisionOption>;
  readonly learningPoints: ReadonlyMap<string, LearningPoint>;
  readonly effectRules: ReadonlyMap<string, EffectRule>;
  readonly provenanceEntries: ReadonlyMap<string, ProvenanceEntry>;
  /** stage 出現順（Scenario.stageIds 準拠）。 */
  readonly orderedStageIds: readonly string[];
}

/** 利用可能な Scenario 群と、読み込めなかった Scenario の明示（BR1.8）。 */
export interface ScenarioCatalog {
  readonly scenarios: ReadonlyMap<string, ValidatedScenario>;
  readonly orderedScenarioIds: readonly string[];
  /** 読み込めなかった Scenario の識別子と理由（無言 fallback しない・FR12）。 */
  readonly unavailable: readonly UnavailableScenario[];
}

export interface UnavailableScenario {
  /** 判別可能な識別子（scenarioId が読めた場合はそれ、無ければ source ラベル）。 */
  readonly ref: string;
  readonly reasonKey: string;
  /** 開発者向け詳細（表示は任意）。 */
  readonly detail: string;
}

// ---------- runtime / result data ----------

export type SessionStatus = "not-started" | "in-progress" | "completed" | "errored";

export interface DecisionRecord {
  readonly decisionRecordId: string;
  readonly sessionId: string;
  readonly decisionPointId: string;
  readonly chosenDecisionOptionId: string;
  /**
   * FR4.2 の任意判断メモ。ユーザー入力の生テキスト（locale key ではない）。
   * 採点入力に含めない（BR2.5 / BR3.1）。Result / Adoption Sheet で再確認できる。
   */
  readonly note?: string;
  /** 0 起点の順序。決定的評価は集合＋順序を明示的に扱い、格納順に依存しない。 */
  readonly orderIndex: number;
}

export interface ScenarioSession {
  readonly sessionId: string;
  readonly scenarioId: string;
  readonly status: SessionStatus;
  /** status=in-progress のときのみ意味を持つ（status ではなく state の data）。 */
  readonly currentStageId?: string;
  readonly decisionRecordIds: readonly string[];
}

export interface DimensionOutcome {
  readonly dimensionOutcomeId: string;
  readonly dimensionId: DimensionId;
  readonly sessionId: string;
  readonly level: ContributionLevel;
  /** この Outcome に寄与した DecisionRecord 群（説明可能性・BR3.7）。 */
  readonly contributingDecisionRecordIds: readonly string[];
  /** 評価値は Educational Simulation Value であり実測値ではない（FR5.3）。 */
  readonly isEducationalSimulationValue: true;
}

export interface LearningResult {
  readonly learningResultId: string;
  readonly sessionId: string;
  /** 固定 9 Dimension を必ず含む（BR3.5）。 */
  readonly dimensionOutcomes: readonly DimensionOutcome[];
  readonly decisionRecordIds: readonly string[];
  readonly remainingRiskDimensionOutcomeId: string;
  readonly reworkDimensionOutcomeId: string;
}

export interface AdoptionReviewMemo {
  readonly sessionId: string;
  readonly noteText?: string;
}
