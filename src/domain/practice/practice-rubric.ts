// PracticeRubric — practice の決定的評価（RC2 §11–§16）。
//
// すべて pure・決定的（time/random/locale/mode 非参照）。runtime AI を使わず、
// presence / count / 分類一致 / 対応完全性 のみを機械的に判定する。
// semantic な品質（曖昧さ・測定可能性のニュアンス等）は評価しない（呼び出し側が明示する）。
import type { DimensionId } from "../entities.ts";
import type {
  ChangeControlPractice,
  ChangeControlResponse,
  ClassificationBucket,
  ClassificationPractice,
  EvidenceClassification,
  EvidenceReviewPractice,
  RequirementFieldId,
  RequirementPractice,
  TraceabilityPractice,
} from "./practice-entities.ts";

// ---------- Requirement Practice rubric ----------

export interface RequirementInput {
  /** fieldId → 生テキスト（acceptanceCriteria は改行区切りで複数件）。 */
  readonly values: Readonly<Partial<Record<RequirementFieldId, string>>>;
}

export interface RequirementFieldResult {
  readonly fieldId: RequirementFieldId;
  readonly present: boolean;
  readonly required: boolean;
  /** multiline のときの件数（trim 後 非空行数）。それ以外は present なら 1。 */
  readonly itemCount: number;
  /** minItems を満たすか（multiline のみ意味を持つ）。 */
  readonly meetsMin: boolean;
}

export interface RequirementEvaluation {
  readonly fields: readonly RequirementFieldResult[];
  readonly completedRequiredFieldIds: readonly RequirementFieldId[];
  readonly missingRequiredFieldIds: readonly RequirementFieldId[];
  readonly acceptanceCriteriaCount: number;
  /** 必須 field がすべて present かつ min 件数を満たす。 */
  readonly allRequiredSatisfied: boolean;
}

/** 改行区切りテキストの非空行数を数える（決定的）。 */
export function countNonEmptyLines(text: string | undefined): number {
  if (text === undefined) return 0;
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0).length;
}

function isPresent(text: string | undefined): boolean {
  return text !== undefined && text.trim().length > 0;
}

export function evaluateRequirement(
  practice: RequirementPractice,
  input: RequirementInput,
): RequirementEvaluation {
  const fields: RequirementFieldResult[] = [];
  const completed: RequirementFieldId[] = [];
  const missing: RequirementFieldId[] = [];
  let acCount = 0;

  for (const spec of practice.fields) {
    const raw = input.values[spec.fieldId];
    const present = isPresent(raw);
    const itemCount = spec.multiline ? countNonEmptyLines(raw) : present ? 1 : 0;
    const min = spec.minItems ?? (spec.required ? 1 : 0);
    const meetsMin = spec.multiline ? itemCount >= min : present;
    if (spec.fieldId === "acceptanceCriteria") acCount = itemCount;

    fields.push({ fieldId: spec.fieldId, present, required: spec.required, itemCount, meetsMin });

    if (spec.required) {
      if (present && meetsMin) completed.push(spec.fieldId);
      else missing.push(spec.fieldId);
    }
  }

  return {
    fields,
    completedRequiredFieldIds: completed,
    missingRequiredFieldIds: missing,
    acceptanceCriteriaCount: acCount,
    allRequiredSatisfied: missing.length === 0,
  };
}

// ---------- Evidence Review rubric ----------

export interface EvidenceReviewInput {
  /** itemId → ユーザーの分類。 */
  readonly classifications: Readonly<Record<string, EvidenceClassification>>;
}

export interface EvidenceItemResult {
  readonly itemId: string;
  readonly expected: EvidenceClassification;
  readonly actual: EvidenceClassification | undefined;
  readonly correct: boolean;
  readonly rationaleKey: string;
  readonly relatedDimensionIds: readonly DimensionId[];
}

export interface EvidenceReviewEvaluation {
  readonly items: readonly EvidenceItemResult[];
  readonly correctCount: number;
  readonly totalCount: number;
  readonly allCorrect: boolean;
}

export function evaluateEvidenceReview(
  practice: EvidenceReviewPractice,
  input: EvidenceReviewInput,
): EvidenceReviewEvaluation {
  const items: EvidenceItemResult[] = practice.items.map((it) => {
    const actual = input.classifications[it.itemId];
    return {
      itemId: it.itemId,
      expected: it.expected,
      actual,
      correct: actual === it.expected,
      rationaleKey: it.rationaleKey,
      relatedDimensionIds: it.relatedDimensionIds,
    };
  });
  const correctCount = items.filter((i) => i.correct).length;
  return {
    items,
    correctCount,
    totalCount: items.length,
    allCorrect: correctCount === items.length && items.length > 0,
  };
}

// ---------- Classification rubric（Approval / Delegation） ----------

export interface ClassificationInput {
  readonly assignments: Readonly<Record<string, ClassificationBucket>>;
}

export interface ClassificationActionResult {
  readonly actionId: string;
  readonly expected: ClassificationBucket;
  readonly actual: ClassificationBucket | undefined;
  readonly correct: boolean;
  readonly rationaleKey: string;
  readonly relatedDimensionIds: readonly DimensionId[];
}

export interface ClassificationEvaluation {
  readonly actions: readonly ClassificationActionResult[];
  readonly correctCount: number;
  readonly totalCount: number;
  readonly allCorrect: boolean;
}

export function evaluateClassification(
  practice: ClassificationPractice,
  input: ClassificationInput,
): ClassificationEvaluation {
  const actions: ClassificationActionResult[] = practice.actions.map((a) => {
    const actual = input.assignments[a.actionId];
    return {
      actionId: a.actionId,
      expected: a.expected,
      actual,
      correct: actual === a.expected,
      rationaleKey: a.rationaleKey,
      relatedDimensionIds: a.relatedDimensionIds,
    };
  });
  const correctCount = actions.filter((a) => a.correct).length;
  return {
    actions,
    correctCount,
    totalCount: actions.length,
    allCorrect: correctCount === actions.length && actions.length > 0,
  };
}

// ---------- Traceability rubric ----------

export interface TraceabilityInput {
  /** chainId → ユーザーが「完全（リンク欠落なし）」と判断したか。 */
  readonly completeJudgments: Readonly<Record<string, boolean>>;
}

export interface TraceChainResult {
  readonly chainId: string;
  readonly expectedComplete: boolean;
  readonly actualComplete: boolean | undefined;
  readonly correct: boolean;
  readonly rationaleKey: string;
  readonly missingLink?: string | undefined;
}

export interface TraceabilityEvaluation {
  readonly chains: readonly TraceChainResult[];
  readonly correctCount: number;
  readonly totalCount: number;
  readonly allCorrect: boolean;
}

export function evaluateTraceability(
  practice: TraceabilityPractice,
  input: TraceabilityInput,
): TraceabilityEvaluation {
  const chains: TraceChainResult[] = practice.chains.map((c) => {
    const actual = input.completeJudgments[c.chainId];
    return {
      chainId: c.chainId,
      expectedComplete: c.expectedComplete,
      actualComplete: actual,
      correct: actual === c.expectedComplete,
      rationaleKey: c.rationaleKey,
      ...(c.missingLink !== undefined ? { missingLink: c.missingLink } : {}),
    };
  });
  const correctCount = chains.filter((c) => c.correct).length;
  return {
    chains,
    correctCount,
    totalCount: chains.length,
    allCorrect: correctCount === chains.length && chains.length > 0,
  };
}

// ---------- Change Control rubric ----------

export interface ChangeControlInput {
  readonly responses: Readonly<Record<string, ChangeControlResponse>>;
}

export interface ChangeControlCaseResult {
  readonly caseId: string;
  readonly expected: ChangeControlResponse;
  readonly actual: ChangeControlResponse | undefined;
  readonly correct: boolean;
  readonly rationaleKey: string;
  readonly relatedDimensionIds: readonly DimensionId[];
}

export interface ChangeControlEvaluation {
  readonly cases: readonly ChangeControlCaseResult[];
  readonly correctCount: number;
  readonly totalCount: number;
  readonly allCorrect: boolean;
}

export function evaluateChangeControl(
  practice: ChangeControlPractice,
  input: ChangeControlInput,
): ChangeControlEvaluation {
  const cases: ChangeControlCaseResult[] = practice.cases.map((c) => {
    const actual = input.responses[c.caseId];
    return {
      caseId: c.caseId,
      expected: c.expected,
      actual,
      correct: actual === c.expected,
      rationaleKey: c.rationaleKey,
      relatedDimensionIds: c.relatedDimensionIds,
    };
  });
  const correctCount = cases.filter((c) => c.correct).length;
  return {
    cases,
    correctCount,
    totalCount: cases.length,
    allCorrect: correctCount === cases.length && cases.length > 0,
  };
}
