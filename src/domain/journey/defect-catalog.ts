// DefectCatalog — Ground Truth。structured input + Journey Step + Profile から defect set を
// 決定的に導出する（Design §9 / 要件 7）。random / time 禁止。同一入力 → 同一 defect set。
//
// 重要（要件 7）: Artifact に必ず defect があるとは限らない。clean artifact / distractor /
// ambiguous-but-valid を含められる。ここでは「どの条件でどの defect が有効になるか」を宣言的に定義する。
import type {
  DefectDefinition,
  JourneyStepId,
  StructuredControlInput,
} from "./journey-entities.ts";

/**
 * defect の有効化条件（structured input に対する決定的述語）。
 * すべて pure。UI / locale / mode / time / random を参照しない。
 */
export interface DefectRule {
  readonly definition: DefectDefinition;
  /** structured input を見て、この defect を注入するか決める決定的述語。 */
  readonly activateWhen: (input: StructuredControlInput) => boolean;
}

/**
 * canonical / user 双方で使う defect ルール集合（Profile 非依存の共通ルール）。
 * Profile 固有の追加ルールは buildDefectSet の profileRules で足す。
 */
export const BASE_DEFECT_RULES: readonly DefectRule[] = [
  // J1 Requirements: requirement omission（criticality 高いのに要件が薄い状況を教材化）。
  {
    definition: {
      defectId: "d-j1-req-omission",
      category: "requirement-omission",
      journeyStepId: "j1-requirements",
      itemId: "req-item-omission",
      expectedSeverity: "medium",
      rationaleKey: "rc3.defect.j1.reqOmission",
      relatedDimensionIds: ["requirement-clarity"],
      downstreamManifestation: {
        atStepId: "j4-implementation-traceability",
        manifestItemKey: "rc3.consequence.j1.toTrace",
        addsRiskDimensionIds: ["traceability"],
      },
    },
    activateWhen: (i) => i.operationalCriticality !== "low",
  },
  // J2 AC mismatch: 常に教材として提示（clean にはしない基本 defect）。
  {
    definition: {
      defectId: "d-j2-ac-mismatch",
      category: "acceptance-criteria-mismatch",
      journeyStepId: "j2-acceptance-scope",
      itemId: "ac-item-mismatch",
      expectedSeverity: "medium",
      rationaleKey: "rc3.defect.j2.acMismatch",
      relatedDimensionIds: ["acceptance-criteria-coverage"],
      downstreamManifestation: {
        atStepId: "j6-test-evidence",
        manifestItemKey: "rc3.consequence.j2.toEvidence",
        addsRiskDimensionIds: ["evidence-quality"],
      },
    },
    activateWhen: () => true,
  },
  // J2 scope creep: external dependency がある時に out-of-scope 項目が紛れ込む。
  {
    definition: {
      defectId: "d-j2-scope-creep",
      category: "scope-creep",
      journeyStepId: "j2-acceptance-scope",
      itemId: "ac-item-scope-creep",
      expectedSeverity: "low",
      rationaleKey: "rc3.defect.j2.scopeCreep",
      relatedDimensionIds: ["requirement-clarity"],
    },
    activateWhen: (i) => i.externalDependency !== "none",
  },
  // J3 missing NFR: availability が high/critical なのに NFR が欠落。
  {
    definition: {
      defectId: "d-j3-missing-nfr",
      category: "missing-nfr",
      journeyStepId: "j3-design",
      itemId: "design-item-missing-nfr",
      expectedSeverity: "high",
      rationaleKey: "rc3.defect.j3.missingNfr",
      relatedDimensionIds: ["risk-handling"],
      downstreamManifestation: {
        atStepId: "j8-release-approval",
        manifestItemKey: "rc3.consequence.j3.toRelease",
        addsRiskDimensionIds: ["remaining-risks"],
      },
    },
    activateWhen: (i) => i.availability === "high" || i.availability === "critical",
  },
  // J3 security constraint violation（Intentional Conflict）: 個人情報 + 外部依存で SaaS 送信が有効化。
  {
    definition: {
      defectId: "d-j3-security-violation",
      category: "security-constraint-violation",
      journeyStepId: "j3-design",
      itemId: "design-item-saas-logging",
      expectedSeverity: "high",
      rationaleKey: "rc3.defect.j3.securityViolation",
      relatedDimensionIds: ["risk-handling", "remaining-risks"],
      downstreamManifestation: {
        atStepId: "j4-implementation-traceability",
        manifestItemKey: "rc3.consequence.j3.toTrace",
        addsRiskDimensionIds: ["traceability"],
      },
    },
    activateWhen: (i) =>
      i.dataSensitivity === "personal-info" || i.dataSensitivity === "confidential"
        ? i.externalDependency !== "none"
        : false,
  },
  // J3 unsafe delegation: criticality 高いのに過剰委任。
  {
    definition: {
      defectId: "d-j3-unsafe-delegation",
      category: "unsafe-delegation",
      journeyStepId: "j3-design",
      itemId: "design-item-delegation",
      expectedSeverity: "medium",
      rationaleKey: "rc3.defect.j3.unsafeDelegation",
      relatedDimensionIds: ["delegation-quality"],
    },
    activateWhen: (i) => i.operationalCriticality === "high",
  },
  // J4 traceability gap: 常に教材として 1 本欠落チェーンを提示。
  {
    definition: {
      defectId: "d-j4-trace-gap",
      category: "traceability-gap",
      journeyStepId: "j4-implementation-traceability",
      itemId: "trace-item-gap",
      expectedSeverity: "medium",
      rationaleKey: "rc3.defect.j4.traceGap",
      relatedDimensionIds: ["traceability"],
      downstreamManifestation: {
        atStepId: "j6-test-evidence",
        manifestItemKey: "rc3.consequence.j4.toEvidence",
        addsRiskDimensionIds: ["evidence-quality"],
      },
    },
    activateWhen: () => true,
  },
  // J5 missing test coverage: criticality medium 以上で必須ケース欠落。
  {
    definition: {
      defectId: "d-j5-missing-coverage",
      category: "missing-test-coverage",
      journeyStepId: "j5-test-strategy",
      itemId: "teststrat-item-coverage",
      expectedSeverity: "medium",
      rationaleKey: "rc3.defect.j5.missingCoverage",
      relatedDimensionIds: ["acceptance-criteria-coverage", "evidence-quality"],
      downstreamManifestation: {
        atStepId: "j6-test-evidence",
        manifestItemKey: "rc3.consequence.j5.toEvidence",
        addsRiskDimensionIds: ["evidence-quality"],
      },
    },
    activateWhen: (i) => i.operationalCriticality !== "low",
  },
  // J6 insufficient evidence: 常に教材として提示（未実行テストを成功扱いにしない・steering）。
  {
    definition: {
      defectId: "d-j6-insufficient-evidence",
      category: "insufficient-evidence",
      journeyStepId: "j6-test-evidence",
      itemId: "evidence-item-insufficient",
      expectedSeverity: "high",
      rationaleKey: "rc3.defect.j6.insufficientEvidence",
      relatedDimensionIds: ["evidence-quality"],
      downstreamManifestation: {
        atStepId: "j7-completion-approval",
        manifestItemKey: "rc3.consequence.j6.toCompletion",
        addsRiskDimensionIds: ["remaining-risks"],
      },
    },
    activateWhen: () => true,
  },
];

/**
 * structured input から、有効な defect definition 集合を決定的に導出する。
 * profileRules は Profile 固有の追加/上書き（Design §5 の canonical Sample Project 用）。
 */
export function buildDefectSet(
  input: StructuredControlInput,
  profileRules: readonly DefectRule[] = [],
): readonly DefectDefinition[] {
  const all = [...BASE_DEFECT_RULES, ...profileRules];
  const active: DefectDefinition[] = [];
  const seen = new Set<string>();
  for (const rule of all) {
    if (!rule.activateWhen(input)) continue;
    if (seen.has(rule.definition.defectId)) continue;
    seen.add(rule.definition.defectId);
    active.push(rule.definition);
  }
  // 決定的順序（defectId 昇順）で正規化。
  return active.slice().sort((a, b) => (a.defectId < b.defectId ? -1 : a.defectId > b.defectId ? 1 : 0));
}

/** 指定 step の defect のみ抽出（決定的順序維持）。 */
export function defectsForStep(
  defects: readonly DefectDefinition[],
  stepId: JourneyStepId,
): readonly DefectDefinition[] {
  return defects.filter((d) => d.journeyStepId === stepId);
}
