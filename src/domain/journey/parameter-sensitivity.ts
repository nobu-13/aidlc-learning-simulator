// RC6 — Parameter Sensitivity Matrix。
//
// RC6 GROUND TRUTH RULE / PARAMETER CONTRACT:
//   Setup UI は「Structured input drives artifact generation and evaluation」と宣言する。
//   したがって、各 structured dimension は少なくとも 1 つの observable product behavior へ影響しなければ
//   ならない（宣言と実挙動の矛盾＝P1-C の一般化を禁じる）。
//   逆に、影響しない dimension を「影響する」と UI で約束してはならない。
//
// このモジュールは各 dimension の影響先を宣言的に明文化した single source of truth（pure data）。
// テスト（parameter contract test）がこのテーブルと実挙動（buildDefectSet / grounding / readiness）の
// 整合を検証する。これにより「UI 宣言と実挙動」が乖離しないことを機械的に担保する。
//
// pure・決定的。runtime AI / time / random / locale 非参照。
import type { StructuredInputFieldId } from "./journey-entities.ts";

/** dimension が影響する出力の種類。 */
export type SensitivityChannel =
  | "defect-activation" // Ground Truth の defect 集合を変える（finding validity / severity / consequence）。
  | "context-grounding" // artifact 本文の文脈情報（data classification 等）を変える。
  | "decision-readiness" // Completion / Release の判断材料（gate consequence / residual risk framing）を変える。
  | "accepted-fact"; // 上流で確定した positive fact として下流へ伝播する。

/** 1 dimension の感度記述（どの channel でどう observable に効くか）。 */
export interface DimensionSensitivity {
  readonly fieldId: StructuredInputFieldId;
  /** この dimension が影響を及ぼす channel（1 つ以上・空は禁止＝UI 宣言と矛盾する）。 */
  readonly channels: readonly SensitivityChannel[];
  /** 代表 contrast pair（この 2 値で observable output が変わることをテストが検証する）。 */
  readonly contrastPair: readonly [string, string];
  /** 影響する defect id（defect-activation channel のとき）。 */
  readonly affectedDefectIds: readonly string[];
  /** 説明（監査可読性のため）。 */
  readonly note: string;
}

/**
 * Parameter Sensitivity Matrix。全 8 structured dimension を監査する。
 * 各 dimension は channels が空でないこと（テストが強制）。
 */
export const PARAMETER_SENSITIVITY_MATRIX: readonly DimensionSensitivity[] = [
  {
    fieldId: "dataSensitivity",
    channels: ["defect-activation", "context-grounding"],
    contrastPair: ["personal-info", "public"],
    affectedDefectIds: ["d-j3-security-violation"],
    note:
      "PII/機密 + 外部依存で security-constraint-violation を活性化。全ケースで data classification を artifact 本文へ ground（personal-info と public で本文が変わる）。",
  },
  {
    fieldId: "availability",
    channels: ["defect-activation", "accepted-fact"],
    contrastPair: ["critical", "best-effort"],
    affectedDefectIds: ["d-j3-missing-nfr"],
    note:
      "high/critical で missing-nfr を活性化。かつ確定済みの可用性目標（RTO/RPO 相当）を accepted fact として Design へ伝播する（値の再要求を禁止）。",
  },
  {
    fieldId: "externalDependency",
    channels: ["defect-activation"],
    contrastPair: ["heavy", "none"],
    affectedDefectIds: ["d-j2-scope-creep", "d-j3-security-violation"],
    note:
      "none 以外で scope-creep を活性化。PII/機密と組み合わさると security-violation を活性化（外部送信の有無が違反判定を決める）。",
  },
  {
    fieldId: "operationalCriticality",
    channels: ["defect-activation"],
    contrastPair: ["high", "low"],
    affectedDefectIds: ["d-j1-req-omission", "d-j3-unsafe-delegation", "d-j5-missing-coverage"],
    note:
      "low 以外で req-omission / missing-coverage を活性化。high で unsafe-delegation を活性化。",
  },
  {
    fieldId: "approvalRequirement",
    channels: ["decision-readiness"],
    contrastPair: ["single", "committee"],
    affectedDefectIds: [],
    note:
      "承認体制（single/dual/committee）を Completion/Release の判断材料へ反映する。releaseImpact=high と single の組み合わせは承認境界の弱さとして readiness に現れる。",
  },
  {
    fieldId: "releaseImpact",
    channels: ["decision-readiness"],
    contrastPair: ["high", "low"],
    affectedDefectIds: [],
    note:
      "リリース影響度を Release 判断材料へ反映する（high は残存リスクの重み付けと承認体制の妥当性判定に効く）。",
  },
  {
    fieldId: "reversibility",
    channels: ["decision-readiness"],
    contrastPair: ["irreversible", "reversible"],
    affectedDefectIds: [],
    note:
      "可逆性を Release 判断材料へ反映する（irreversible は「戻せない前提での承認」として readiness に現れる）。",
  },
  {
    fieldId: "workload",
    channels: ["context-grounding"],
    contrastPair: ["data-heavy", "interactive"],
    affectedDefectIds: [],
    note:
      "ワークロード特性を Design の文脈情報として artifact 本文へ ground する（data-heavy と interactive で文脈文言が変わる）。",
  },
] as const;

/** 指定 dimension の感度記述を引く。 */
export function sensitivityOf(fieldId: StructuredInputFieldId): DimensionSensitivity | undefined {
  return PARAMETER_SENSITIVITY_MATRIX.find((m) => m.fieldId === fieldId);
}
