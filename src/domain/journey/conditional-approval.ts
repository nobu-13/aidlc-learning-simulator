// RC5 P1-D: Conditional Approval を first-class state として扱う domain model。
//
// 監査所見（P1-D）: 「Approve with conditions」を選んでも、次工程で condition / open finding /
// residual risk / verification requirement が見えなくなり、実質 plain Approve になっていた。
//
// このモジュールは条件付き承認を構造化データとして保持し、下流・Completion・Release・Result で
// 一貫して参照できるようにする。runtime AI 不要・pure・決定的。表示文言は locale key。
import type { JourneyStepId, Severity } from "./journey-entities.ts";

/** 条件を検証すべき時点（gate）。 */
export type ConditionDueGate = "before-release" | "at-release" | "post-release";

export const CONDITION_DUE_GATES: readonly ConditionDueGate[] = [
  "before-release",
  "at-release",
  "post-release",
] as const;

/** 条件付き承認 finding の状態。resolved ではない。 */
export type ConditionStatus = "open" | "conditionally-accepted";

/**
 * 1 件の Conditional Approval（構造化条件）。
 * free-text review memo とは別扱い（条件・必要証跡・検証時点を構造化）。
 * JSON 直列化可能な最小構造（永続化・migration 安定性のため domain 型に依存しすぎない）。
 */
export interface ConditionalApproval {
  /** この条件が発生した工程（Completion/Release の由来 step）。 */
  readonly sourceStepId: JourneyStepId;
  /** 条件の対象となった finding（未解決/条件付き受理の指摘）の itemId 群。 */
  readonly findingIds: readonly string[];
  /** 条件本文（学習者が構造化入力）。 */
  readonly condition: string;
  /** 必要な証跡（学習者が構造化入力・任意）。 */
  readonly requiredEvidence?: string | undefined;
  /** 検証すべき時点 / 期限ゲート。 */
  readonly dueGate: ConditionDueGate;
  /** 条件の状態（open / conditionally-accepted）。resolved にはしない。 */
  readonly status: ConditionStatus;
  /** 対象 finding の最高深刻度（high を条件付き通過した場合の可視化用・任意）。 */
  readonly highestSeverity?: Severity | undefined;
}

/** 条件が未充足（open）として残っているか。 */
export function isConditionOpen(c: ConditionalApproval): boolean {
  return c.status === "open" || c.status === "conditionally-accepted";
}

/** 条件本文が有効か（空白のみは無効）。 */
export function isValidCondition(c: {
  readonly condition: string;
}): boolean {
  return c.condition.trim().length > 0;
}

/** open な条件だけを決定的順序（入力順）で返す。 */
export function openConditions(
  conditions: readonly ConditionalApproval[],
): readonly ConditionalApproval[] {
  return conditions.filter(isConditionOpen);
}

/** high severity を条件付きで通した open 条件があるか（無条件に問題なしにしないための判定）。 */
export function hasOpenHighSeverityCondition(
  conditions: readonly ConditionalApproval[],
): boolean {
  return openConditions(conditions).some((c) => c.highestSeverity === "high");
}

// ---------- 永続化（JSON 直列化可能な最小構造）との相互変換 ----------

/** 永続化用の平坦な形（domain 型に依存しない）。 */
export interface PersistedConditionalApproval {
  readonly sourceStepId: string;
  readonly findingIds: readonly string[];
  readonly condition: string;
  readonly requiredEvidence?: string | undefined;
  readonly dueGate: string;
  readonly status: string;
  readonly highestSeverity?: string | undefined;
}

const DUE_GATE_SET: ReadonlySet<string> = new Set<string>(CONDITION_DUE_GATES);
const STATUS_SET: ReadonlySet<string> = new Set<string>(["open", "conditionally-accepted"]);
const SEVERITY_SET: ReadonlySet<string> = new Set<string>(["low", "medium", "high"]);

/** ConditionalApproval → 永続化形。 */
export function toPersistedCondition(c: ConditionalApproval): PersistedConditionalApproval {
  return {
    sourceStepId: c.sourceStepId,
    findingIds: [...c.findingIds],
    condition: c.condition,
    ...(c.requiredEvidence !== undefined ? { requiredEvidence: c.requiredEvidence } : {}),
    dueGate: c.dueGate,
    status: c.status,
    ...(c.highestSeverity !== undefined ? { highestSeverity: c.highestSeverity } : {}),
  };
}

/**
 * 永続化形 → ConditionalApproval（境界検証つき）。
 * 未知の値は安全な既定へ丸める（dueGate→before-release, status→open）。
 * JourneyStepId の検証は呼び出し側が JOURNEY_STEP_IDS で行うため、ここでは文字列として通す。
 */
export function fromPersistedCondition(
  p: PersistedConditionalApproval,
  isStepId: (v: string) => boolean,
): ConditionalApproval | null {
  if (!isStepId(p.sourceStepId)) return null;
  if (typeof p.condition !== "string" || p.condition.trim().length === 0) return null;
  const dueGate: ConditionDueGate = DUE_GATE_SET.has(p.dueGate)
    ? (p.dueGate as ConditionDueGate)
    : "before-release";
  const status: ConditionStatus = STATUS_SET.has(p.status)
    ? (p.status as ConditionStatus)
    : "open";
  const highestSeverity =
    p.highestSeverity !== undefined && SEVERITY_SET.has(p.highestSeverity)
      ? (p.highestSeverity as Severity)
      : undefined;
  return {
    sourceStepId: p.sourceStepId as JourneyStepId,
    findingIds: Array.isArray(p.findingIds) ? [...p.findingIds] : [],
    condition: p.condition,
    ...(typeof p.requiredEvidence === "string" && p.requiredEvidence.length > 0
      ? { requiredEvidence: p.requiredEvidence }
      : {}),
    dueGate,
    status,
    ...(highestSeverity !== undefined ? { highestSeverity } : {}),
  };
}
