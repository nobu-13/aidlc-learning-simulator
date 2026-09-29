// RC5 P1-D: Conditional Approval domain model のテスト。
import { describe, it, expect } from "vitest";
import {
  isConditionOpen,
  isValidCondition,
  openConditions,
  hasOpenHighSeverityCondition,
  toPersistedCondition,
  fromPersistedCondition,
  type ConditionalApproval,
} from "./conditional-approval.ts";
import { JOURNEY_STEP_IDS } from "./journey-entities.ts";

const isStepId = (v: string): boolean => (JOURNEY_STEP_IDS as readonly string[]).includes(v);

function cond(over: Partial<ConditionalApproval> = {}): ConditionalApproval {
  return {
    sourceStepId: "j7-completion-approval",
    findingIds: [],
    condition: "load test before release",
    dueGate: "before-release",
    status: "open",
    ...over,
  };
}

describe("RC5 P1-D — ConditionalApproval 基本", () => {
  it("open / conditionally-accepted は open 扱い", () => {
    expect(isConditionOpen(cond({ status: "open" }))).toBe(true);
    expect(isConditionOpen(cond({ status: "conditionally-accepted" }))).toBe(true);
  });

  it("空白のみの condition は無効", () => {
    expect(isValidCondition({ condition: "   " })).toBe(false);
    expect(isValidCondition({ condition: "x" })).toBe(true);
  });

  it("openConditions は open のみを入力順で返す", () => {
    const list = [cond({ condition: "a" }), cond({ condition: "b" })];
    expect(openConditions(list).map((c) => c.condition)).toEqual(["a", "b"]);
  });

  it("high severity の open 条件を検出できる（無条件に問題なしにしない）", () => {
    expect(hasOpenHighSeverityCondition([cond({ highestSeverity: "high" })])).toBe(true);
    expect(hasOpenHighSeverityCondition([cond({ highestSeverity: "medium" })])).toBe(false);
    expect(hasOpenHighSeverityCondition([])).toBe(false);
  });
});

describe("RC5 P1-D — 永続化ラウンドトリップ", () => {
  it("toPersisted → fromPersisted で内容が保たれる", () => {
    const c = cond({
      requiredEvidence: "load-test report",
      dueGate: "at-release",
      highestSeverity: "high",
      findingIds: ["x"],
    });
    const restored = fromPersistedCondition(toPersistedCondition(c), isStepId);
    expect(restored).not.toBeNull();
    expect(restored!.condition).toBe(c.condition);
    expect(restored!.requiredEvidence).toBe("load-test report");
    expect(restored!.dueGate).toBe("at-release");
    expect(restored!.highestSeverity).toBe("high");
    expect(restored!.findingIds).toEqual(["x"]);
  });

  it("不正な sourceStepId / 空 condition は null（restore で捨てる）", () => {
    expect(
      fromPersistedCondition(
        { sourceStepId: "bogus", findingIds: [], condition: "x", dueGate: "before-release", status: "open" },
        isStepId,
      ),
    ).toBeNull();
    expect(
      fromPersistedCondition(
        { sourceStepId: "j7-completion-approval", findingIds: [], condition: "  ", dueGate: "before-release", status: "open" },
        isStepId,
      ),
    ).toBeNull();
  });

  it("未知の dueGate / status は安全な既定へ丸める", () => {
    const restored = fromPersistedCondition(
      { sourceStepId: "j7-completion-approval", findingIds: [], condition: "x", dueGate: "???", status: "???" },
      isStepId,
    );
    expect(restored).not.toBeNull();
    expect(restored!.dueGate).toBe("before-release");
    expect(restored!.status).toBe("open");
  });
});
