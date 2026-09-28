// PracticeCatalog — RC2 practice の定義（data）。logic は practice-rubric.ts が持つ。
//
// 教材は既存 AI-DLC scenario の題材（Evidence / Approval Boundary / Delegation / Traceability /
// Change Control）に根拠を置く。表示文言は locale key で、practice-locale.ts が ja/en を供給する。
// 決定的評価のみを前提にした定義（正解分類・必須 field・対応完全性）。
import type {
  ChangeControlPractice,
  ClassificationPractice,
  EvidenceReviewPractice,
  Practice,
  RequirementPractice,
  TraceabilityPractice,
} from "./practice-entities.ts";

const requirementPractice: RequirementPractice = {
  practiceId: "req-create",
  kind: "requirement",
  titleKey: "practice.req.title",
  summaryKey: "practice.req.summary",
  objectiveKey: "practice.req.objective",
  relatedDimensionIds: ["requirement-clarity", "acceptance-criteria-coverage", "traceability"],
  provenanceRefs: ["pv-practice-req"],
  notEvaluatedNoteKey: "practice.req.notEvaluated",
  fields: [
    { fieldId: "goal", labelKey: "practice.req.field.goal", required: true, multiline: false },
    { fieldId: "targetUser", labelKey: "practice.req.field.targetUser", required: true, multiline: false },
    { fieldId: "inScope", labelKey: "practice.req.field.inScope", required: true, multiline: true, minItems: 1 },
    { fieldId: "outOfScope", labelKey: "practice.req.field.outOfScope", required: true, multiline: true, minItems: 1 },
    { fieldId: "constraints", labelKey: "practice.req.field.constraints", required: false, multiline: true },
    {
      fieldId: "acceptanceCriteria",
      labelKey: "practice.req.field.acceptanceCriteria",
      required: true,
      multiline: true,
      minItems: 2,
    },
  ],
};

const evidenceReviewPractice: EvidenceReviewPractice = {
  practiceId: "evidence-review",
  kind: "evidence-review",
  titleKey: "practice.ev.title",
  summaryKey: "practice.ev.summary",
  objectiveKey: "practice.ev.objective",
  relatedDimensionIds: ["evidence-quality", "traceability", "remaining-risks"],
  provenanceRefs: ["pv-practice-ev"],
  items: [
    {
      itemId: "ev-exec-log",
      labelKey: "practice.ev.item.execLog.label",
      descriptionKey: "practice.ev.item.execLog.desc",
      expected: "sufficient",
      rationaleKey: "practice.ev.item.execLog.why",
      relatedDimensionIds: ["evidence-quality"],
    },
    {
      itemId: "ev-tweaked-expected",
      labelKey: "practice.ev.item.tweaked.label",
      descriptionKey: "practice.ev.item.tweaked.desc",
      expected: "insufficient",
      rationaleKey: "practice.ev.item.tweaked.why",
      relatedDimensionIds: ["evidence-quality", "traceability"],
    },
    {
      itemId: "ev-unexecuted",
      labelKey: "practice.ev.item.unexecuted.label",
      descriptionKey: "practice.ev.item.unexecuted.desc",
      expected: "insufficient",
      rationaleKey: "practice.ev.item.unexecuted.why",
      relatedDimensionIds: ["evidence-quality"],
    },
    {
      itemId: "ev-approval-record",
      labelKey: "practice.ev.item.approval.label",
      descriptionKey: "practice.ev.item.approval.desc",
      expected: "sufficient",
      rationaleKey: "practice.ev.item.approval.why",
      relatedDimensionIds: ["approval-boundary", "traceability"],
    },
    {
      itemId: "ev-missing-trace",
      labelKey: "practice.ev.item.missingTrace.label",
      descriptionKey: "practice.ev.item.missingTrace.desc",
      expected: "missing-required",
      rationaleKey: "practice.ev.item.missingTrace.why",
      relatedDimensionIds: ["traceability", "remaining-risks"],
    },
  ],
};

const approvalDelegationPractice: ClassificationPractice = {
  practiceId: "approval-delegation",
  kind: "classification",
  titleKey: "practice.cls.title",
  summaryKey: "practice.cls.summary",
  objectiveKey: "practice.cls.objective",
  relatedDimensionIds: ["delegation-quality", "approval-boundary", "risk-handling"],
  provenanceRefs: ["pv-practice-cls"],
  notEvaluatedNoteKey: "practice.cls.notEvaluated",
  buckets: ["agent-autonomous", "human-approval", "block"],
  actions: [
    {
      actionId: "act-format",
      labelKey: "practice.cls.act.format.label",
      contextKey: "practice.cls.act.format.ctx",
      expected: "agent-autonomous",
      rationaleKey: "practice.cls.act.format.why",
      relatedDimensionIds: ["delegation-quality"],
    },
    {
      actionId: "act-schema-migration",
      labelKey: "practice.cls.act.migration.label",
      contextKey: "practice.cls.act.migration.ctx",
      expected: "human-approval",
      rationaleKey: "practice.cls.act.migration.why",
      relatedDimensionIds: ["approval-boundary", "risk-handling"],
    },
    {
      actionId: "act-prod-secret",
      labelKey: "practice.cls.act.secret.label",
      contextKey: "practice.cls.act.secret.ctx",
      expected: "block",
      rationaleKey: "practice.cls.act.secret.why",
      relatedDimensionIds: ["risk-handling", "approval-boundary"],
    },
    {
      actionId: "act-add-test",
      labelKey: "practice.cls.act.test.label",
      contextKey: "practice.cls.act.test.ctx",
      expected: "agent-autonomous",
      rationaleKey: "practice.cls.act.test.why",
      relatedDimensionIds: ["delegation-quality", "evidence-quality"],
    },
    {
      actionId: "act-delete-prod-data",
      labelKey: "practice.cls.act.delete.label",
      contextKey: "practice.cls.act.delete.ctx",
      expected: "block",
      rationaleKey: "practice.cls.act.delete.why",
      relatedDimensionIds: ["risk-handling", "remaining-risks"],
    },
  ],
};

const traceabilityPractice: TraceabilityPractice = {
  practiceId: "traceability",
  kind: "traceability",
  titleKey: "practice.tr.title",
  summaryKey: "practice.tr.summary",
  objectiveKey: "practice.tr.objective",
  relatedDimensionIds: ["traceability", "acceptance-criteria-coverage", "evidence-quality"],
  provenanceRefs: ["pv-practice-tr"],
  chains: [
    {
      chainId: "chain-login",
      requirementKey: "practice.tr.chain.login.req",
      acceptanceCriterionKey: "practice.tr.chain.login.ac",
      implementationKey: "practice.tr.chain.login.impl",
      testKey: "practice.tr.chain.login.test",
      expectedComplete: true,
      rationaleKey: "practice.tr.chain.login.why",
    },
    {
      chainId: "chain-reset",
      requirementKey: "practice.tr.chain.reset.req",
      acceptanceCriterionKey: "practice.tr.chain.reset.ac",
      implementationKey: "practice.tr.chain.reset.impl",
      testKey: "practice.tr.chain.reset.test",
      expectedComplete: false,
      missingLink: "test",
      rationaleKey: "practice.tr.chain.reset.why",
    },
    {
      chainId: "chain-audit",
      requirementKey: "practice.tr.chain.audit.req",
      acceptanceCriterionKey: "practice.tr.chain.audit.ac",
      implementationKey: "practice.tr.chain.audit.impl",
      testKey: "practice.tr.chain.audit.test",
      expectedComplete: false,
      missingLink: "acceptance",
      rationaleKey: "practice.tr.chain.audit.why",
    },
  ],
};

const changeControlPractice: ChangeControlPractice = {
  practiceId: "change-control",
  kind: "change-control",
  titleKey: "practice.cc.title",
  summaryKey: "practice.cc.summary",
  objectiveKey: "practice.cc.objective",
  relatedDimensionIds: ["rework", "approval-boundary", "requirement-clarity"],
  provenanceRefs: ["pv-practice-cc"],
  cases: [
    {
      caseId: "cc-approved-req-changed",
      promptKey: "practice.cc.case.reqChanged.prompt",
      contextKey: "practice.cc.case.reqChanged.ctx",
      options: ["continue", "re-evaluate", "return-to-previous", "re-approve", "change-scope"],
      expected: "re-evaluate",
      rationaleKey: "practice.cc.case.reqChanged.why",
      relatedDimensionIds: ["rework", "requirement-clarity"],
    },
    {
      caseId: "cc-source-changed-after-approval",
      promptKey: "practice.cc.case.sourceChanged.prompt",
      contextKey: "practice.cc.case.sourceChanged.ctx",
      options: ["continue", "re-evaluate", "return-to-previous", "re-approve", "change-scope"],
      expected: "re-approve",
      rationaleKey: "practice.cc.case.sourceChanged.why",
      relatedDimensionIds: ["approval-boundary", "rework"],
    },
    {
      caseId: "cc-scope-creep",
      promptKey: "practice.cc.case.scopeCreep.prompt",
      contextKey: "practice.cc.case.scopeCreep.ctx",
      options: ["continue", "re-evaluate", "return-to-previous", "re-approve", "change-scope"],
      expected: "change-scope",
      rationaleKey: "practice.cc.case.scopeCreep.why",
      relatedDimensionIds: ["requirement-clarity", "rework"],
    },
  ],
};

export const PRACTICES: readonly Practice[] = [
  requirementPractice,
  evidenceReviewPractice,
  approvalDelegationPractice,
  traceabilityPractice,
  changeControlPractice,
];

export function getPractice(practiceId: string): Practice | undefined {
  return PRACTICES.find((p) => p.practiceId === practiceId);
}
