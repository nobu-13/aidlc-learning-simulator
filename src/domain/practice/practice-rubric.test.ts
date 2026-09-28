import { describe, it, expect } from "vitest";
import { PRACTICES, getPractice } from "./practice-catalog.ts";
import type {
  ChangeControlPractice,
  ClassificationPractice,
  EvidenceReviewPractice,
  RequirementPractice,
  TraceabilityPractice,
} from "./practice-entities.ts";
import {
  countNonEmptyLines,
  evaluateChangeControl,
  evaluateClassification,
  evaluateEvidenceReview,
  evaluateRequirement,
  evaluateTraceability,
} from "./practice-rubric.ts";

const req = getPractice("req-create") as RequirementPractice;
const ev = getPractice("evidence-review") as EvidenceReviewPractice;
const cls = getPractice("approval-delegation") as ClassificationPractice;
const tr = getPractice("traceability") as TraceabilityPractice;
const cc = getPractice("change-control") as ChangeControlPractice;

describe("catalog", () => {
  it("5 種の practice を提供する", () => {
    expect(PRACTICES.map((p) => p.kind).sort()).toEqual(
      ["change-control", "classification", "evidence-review", "requirement", "traceability"].sort(),
    );
  });
});

describe("countNonEmptyLines", () => {
  it("空行を除いた件数を数える（決定的）", () => {
    expect(countNonEmptyLines("a\n\n b \n\nc")).toBe(3);
    expect(countNonEmptyLines(undefined)).toBe(0);
    expect(countNonEmptyLines("   ")).toBe(0);
  });
});

describe("Requirement rubric", () => {
  it("必須項目がすべて埋まり AC が 2 件以上なら allRequiredSatisfied", () => {
    const r = evaluateRequirement(req, {
      values: {
        goal: "ログイン機能",
        targetUser: "利用者",
        inScope: "ログイン",
        outOfScope: "SSO",
        acceptanceCriteria: "成功する\n失敗する",
      },
    });
    expect(r.allRequiredSatisfied).toBe(true);
    expect(r.acceptanceCriteriaCount).toBe(2);
    expect(r.missingRequiredFieldIds).toHaveLength(0);
  });

  it("AC が 1 件だと min 未達で missing 扱い", () => {
    const r = evaluateRequirement(req, {
      values: { goal: "g", targetUser: "u", inScope: "s", outOfScope: "o", acceptanceCriteria: "one" },
    });
    expect(r.acceptanceCriteriaCount).toBe(1);
    expect(r.missingRequiredFieldIds).toContain("acceptanceCriteria");
    expect(r.allRequiredSatisfied).toBe(false);
  });

  it("空入力は全必須が missing", () => {
    const r = evaluateRequirement(req, { values: {} });
    expect(r.completedRequiredFieldIds).toHaveLength(0);
    expect(r.missingRequiredFieldIds.length).toBeGreaterThan(0);
  });

  it("決定的: 同一入力 → 同一結果", () => {
    const input = { values: { goal: "g", targetUser: "u", inScope: "s", outOfScope: "o", acceptanceCriteria: "a\nb" } };
    expect(evaluateRequirement(req, input)).toEqual(evaluateRequirement(req, input));
  });
});

describe("Evidence Review rubric", () => {
  it("正解分類と一致した数を数える", () => {
    const r = evaluateEvidenceReview(ev, {
      classifications: {
        "ev-exec-log": "sufficient",
        "ev-tweaked-expected": "insufficient",
        "ev-unexecuted": "insufficient",
        "ev-approval-record": "sufficient",
        "ev-missing-trace": "missing-required",
      },
    });
    expect(r.allCorrect).toBe(true);
    expect(r.correctCount).toBe(5);
  });

  it("誤分類は correct=false", () => {
    const r = evaluateEvidenceReview(ev, { classifications: { "ev-tweaked-expected": "sufficient" } });
    const item = r.items.find((i) => i.itemId === "ev-tweaked-expected");
    expect(item?.correct).toBe(false);
    expect(item?.expected).toBe("insufficient");
  });
});

describe("Classification rubric（承認・委任）", () => {
  it("本番シークレット読み取りは block が正解", () => {
    const r = evaluateClassification(cls, { assignments: { "act-prod-secret": "block" } });
    expect(r.actions.find((a) => a.actionId === "act-prod-secret")?.correct).toBe(true);
  });
  it("低リスク整形は agent-autonomous が正解", () => {
    const r = evaluateClassification(cls, { assignments: { "act-format": "agent-autonomous" } });
    expect(r.actions.find((a) => a.actionId === "act-format")?.correct).toBe(true);
  });
  it("過剰承認（人間承認を全部に付ける）は正解にならない（§13）", () => {
    const r = evaluateClassification(cls, {
      assignments: {
        "act-format": "human-approval",
        "act-add-test": "human-approval",
      },
    });
    expect(r.correctCount).toBe(0);
  });
});

describe("Traceability rubric", () => {
  it("欠落リンクのある鎖を incomplete と判定できる", () => {
    const r = evaluateTraceability(tr, {
      completeJudgments: { "chain-login": true, "chain-reset": false, "chain-audit": false },
    });
    expect(r.allCorrect).toBe(true);
    const reset = r.chains.find((c) => c.chainId === "chain-reset");
    expect(reset?.missingLink).toBe("test");
  });
  it("完全な鎖を incomplete と誤判定すると correct=false", () => {
    const r = evaluateTraceability(tr, { completeJudgments: { "chain-login": false } });
    expect(r.chains.find((c) => c.chainId === "chain-login")?.correct).toBe(false);
  });
});

describe("Change Control rubric", () => {
  it("承認後の要件変更は re-evaluate が正解", () => {
    const r = evaluateChangeControl(cc, { responses: { "cc-approved-req-changed": "re-evaluate" } });
    expect(r.cases.find((c) => c.caseId === "cc-approved-req-changed")?.correct).toBe(true);
  });
  it("承認後のソース変更は re-approve が正解", () => {
    const r = evaluateChangeControl(cc, { responses: { "cc-source-changed-after-approval": "re-approve" } });
    expect(r.cases.find((c) => c.caseId === "cc-source-changed-after-approval")?.correct).toBe(true);
  });
});
