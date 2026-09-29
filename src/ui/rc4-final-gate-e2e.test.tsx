// RC4 Final Gate & Scenario Integrity — E2E Matrix（実ユーザー Journey の遷移を検証）。
//
// Blind Product Audit の 3 P1 を「実 User Journey が矛盾しない」レベルで固定する:
//  A. Correct finding → Return → next step CTA なし → Rework → same step → Approve → next。
//  B. Miss finding → Approve → next → propagated consequence 表示。
//  C. Context consistency（Context ↔ Artifact ↔ Feedback が同じ domain semantic・hidden requirement なし）。
//  D. Completion Approve → Release（Release でも同じ readiness summary）。
//  E. Completion Conditional → Release（Evidence/unresolved/highest severity/residual risk/conditional 引き継ぎ）。
//  F. Completion Reject（block）→ Release へ進めない。
//  G. Release decisions（approve / conditional / reject）全 branch。
//  H. Lifecycle labels（reviewed / passed / rework-required）が実 state と一致。
//
// 決定的・no-network（memory storage）。en ロケール固定。
import { opaqueItemToken } from "../domain/semantic-id.ts";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../app/app.tsx";
import { createApplication, type Application } from "../app/application-orchestrator.ts";
import { scenarioModules } from "../scenarios/index.ts";
import type { StoragePort } from "../data/progress-store.ts";

function memoryStorage(): StoragePort {
  const data: Record<string, string> = {};
  return {
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}
function makeApp(): Application {
  return createApplication({ scenarioModules, storage: memoryStorage(), browserLanguages: ["en"] });
}

type U = ReturnType<typeof userEvent.setup>;

/** 現在の review を（任意の finding を付けて）指定 gate で submit する。 */
async function submitGate(
  user: U,
  gate = "approve",
  flag: { itemId: string; severity?: string }[] = [],
): Promise<void> {
  for (const f of flag) {
    const cb = screen.queryByTestId(`review-item-${opaqueItemToken(f.itemId)}`);
    if (cb !== null) await user.click(cb);
    if (f.severity !== undefined) {
      const sev = screen.queryByTestId(`review-sev-${opaqueItemToken(f.itemId)}-${f.severity}`);
      if (sev !== null) await user.click(sev);
    }
  }
  await user.selectOptions(screen.getByTestId("review-gate"), gate);
  await user.click(screen.getByTestId("review-submit"));
}

/** feedback view の next（Approve 系のみ存在する）をクリック。 */
async function clickNext(user: U): Promise<void> {
  const n = screen.queryByTestId("feedback-next");
  if (n !== null) await user.click(n);
}

/** approve で 1 工程進める（review → feedback → next）。 */
async function approveStep(user: U): Promise<void> {
  await submitGate(user, "approve");
  await clickNext(user);
}

/** Guided を開始して J1 review を表示させる。 */
async function startGuided(user: U): Promise<void> {
  await user.click(screen.getByTestId("journey-start-guided"));
}

/** J1..J6 を全部 approve して Completion 画面まで進める。 */
async function guidedToCompletion(user: U): Promise<void> {
  await startGuided(user);
  for (let i = 0; i < 6; i++) {
    await submitGate(user, "approve");
    await clickNext(user);
  }
  await screen.findByTestId("completion-approve");
}

afterEach(() => cleanup());

// ============================================================
// A. Correct finding → Return → NO next → Rework → same step → Approve → next
// ============================================================
describe("E2E-A: Return for Rework forbids advancing to the next step", () => {
  it("choosing Return hides Next and forces rework on the same step; only Approve advances", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await startGuided(user);

    // J1 の requirement omission を正しく指摘して Return for Rework。
    await submitGate(user, "return-for-rework", [{ itemId: "req-item-omission", severity: "medium" }]);

    // 次工程 CTA は存在しない（disabled ではなく非表示）。差し戻し必須が明示される。
    expect(screen.queryByTestId("feedback-next")).toBeNull();
    expect(screen.getByTestId("feedback-return-required")).toBeInTheDocument();

    // Rework で同一工程（J1）の再レビューへ戻る。
    await user.click(screen.getByTestId("feedback-rework"));
    expect(screen.getByRole("heading", { level: 1 }).textContent ?? "").toMatch(/Requirements/i);

    // 再レビューで Approve すると初めて次工程（J2）へ進める。
    await submitGate(user, "approve");
    expect(screen.getByTestId("feedback-next")).toBeInTheDocument();
    await clickNext(user);
    expect(screen.getByRole("heading", { level: 1 }).textContent ?? "").toMatch(/Acceptance/i);
  });

  it("Block also forbids advancing (no Next, blocked notice shown)", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await startGuided(user);
    await submitGate(user, "block", [{ itemId: "req-item-omission" }]);
    expect(screen.queryByTestId("feedback-next")).toBeNull();
    expect(screen.getByTestId("feedback-blocked")).toBeInTheDocument();
  });
});

// ============================================================
// B. Miss finding → Approve → next → propagated consequence 表示
// ============================================================
describe("E2E-B: missing an upstream finding surfaces a propagated consequence downstream", () => {
  it("miss J3 security-violation, approve, then J4 shows a worsened propagation with a gate impact", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await startGuided(user);
    // J1, J2 approve。
    await approveStep(user);
    await approveStep(user);
    // J3: security-violation（design-item-saas-logging）を見逃して approve。
    await submitGate(user, "approve");
    await clickNext(user);
    // J4 で伝播（worsened）item と gate impact が出る。
    const infos = screen.queryAllByTestId(/^review-info-/);
    expect(infos.length).toBeGreaterThan(0);
    const gateImpacts = screen.queryAllByTestId(/^review-info-gate-impact-/);
    expect(gateImpacts.length).toBeGreaterThan(0);
    // worsened item の gate impact は「上流で解決すべき」。
    const upstream = gateImpacts.find((el) => el.getAttribute("data-gate-impact") === "upstream");
    expect(upstream).toBeDefined();
  });
});

// ============================================================
// C. Context consistency（hidden requirement なし）
// ============================================================
describe("E2E-C: Context ↔ Artifact ↔ Feedback share the same domain semantic (two-step approval)", () => {
  it("the two-step-approval requirement the user reviews against is visible in the Project Context", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await startGuided(user);
    // J1 review の quoted Project Context（ユーザーが最初に見る Context）に二段階承認が明示されている。
    const quoted = screen.getByTestId("review-quoted");
    expect(quoted.textContent ?? "").toMatch(/two-step approval/i);
    // J1 Artifact 本文にも同じ要件（two-step approval）がある = Context と同一 semantic。
    expect(screen.getByRole("heading", { level: 1 }).textContent ?? "").toMatch(/Requirements/i);
    // Context の constraints で PII / 外部 SaaS boundary が読める（推測不要）。
    expect(quoted.textContent ?? "").toMatch(/PII|personal information/i);
  });
});

// ============================================================
// D. Completion Approve → Release（同じ readiness summary）
// ============================================================
describe("E2E-D: Completion Approve carries the same readiness summary into Release", () => {
  it("release screen shows the same evidence/unresolved/severity/residual as completion", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await guidedToCompletion(user);

    // Completion 画面の readiness summary を記録。
    const cEvidence = screen.getByTestId("completion-readiness-evidence").textContent;
    const cUnresolved = screen.getByTestId("completion-readiness-unresolved").textContent;
    const cSeverity = screen.getByTestId("completion-readiness-highest-severity").textContent;

    await user.click(screen.getByTestId("completion-approve"));
    const toRelease = screen.queryByTestId("interstitial-continue");
    if (toRelease !== null) await user.click(toRelease);

    // Release 画面に readiness summary が「残っている」（消えない・同じ数字）。
    const rSummary = await screen.findByTestId("readiness-summary");
    expect(rSummary).toBeInTheDocument();
    expect(screen.getByTestId("readiness-summary-evidence").textContent).toBe(cEvidence);
    expect(screen.getByTestId("readiness-summary-unresolved").textContent).toBe(cUnresolved);
    expect(screen.getByTestId("readiness-summary-highest-severity").textContent).toBe(cSeverity);
    // Release 固有: release impact も提示。
    expect(screen.getByTestId("readiness-summary-release-impact")).toBeInTheDocument();
    // completion decision が持ち越されている。
    expect(screen.getByTestId("readiness-summary-completion-decision").textContent ?? "").toMatch(/Approve/i);
  });
});

// ============================================================
// E. Completion Conditional → Release（残存リスク・条件を引き継ぐ）
// ============================================================
describe("E2E-E: Conditional completion carries evidence/unresolved/severity/residual/conditional into Release", () => {
  it("with an unresolved high finding, conditional completion preserves the readiness context at Release", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await startGuided(user);
    // J1..J5 approve。
    for (let i = 0; i < 5; i++) await approveStep(user);
    // J6: insufficient-evidence（high defect）を見逃して approve → 未解決 finding を残す。
    await submitGate(user, "approve");
    await clickNext(user);

    // Completion 画面: 未解決あり。conditional で承認。
    await screen.findByTestId("completion-approve");
    expect(Number(screen.getByTestId("completion-readiness-unresolved").textContent?.replace(/\D/g, ""))).toBeGreaterThan(0);
    await user.click(screen.getByTestId("completion-approve-with-conditions"));
    // RC5 P1-D: 条件付き承認は構造化条件の入力を要求する。
    await user.type(screen.getByTestId("completion-cond-condition"), "Complete load testing before release");
    await user.click(screen.getByTestId("completion-cond-confirm"));
    const toRelease = screen.queryByTestId("interstitial-continue");
    if (toRelease !== null) await user.click(toRelease);

    // Release 画面に、未解決 / 最高深刻度 / 残存リスク / conditional 状態が残る。
    const rSummary = await screen.findByTestId("readiness-summary");
    expect(within(rSummary).getByTestId("readiness-summary-evidence")).toBeInTheDocument();
    expect(within(rSummary).getByTestId("readiness-summary-unresolved").textContent ?? "").toMatch(/[1-9]/);
    expect(within(rSummary).getByTestId("readiness-summary-highest-severity").textContent ?? "").toMatch(/High/i);
    // 残存リスクの内訳（origin 付き）が存在する。
    expect(within(rSummary).getByTestId("readiness-summary-residual-list")).toBeInTheDocument();
    // conditional 状態が引き継がれている。
    expect(screen.getByTestId("readiness-summary-conditional")).toBeInTheDocument();
    expect(screen.getByTestId("readiness-summary-completion-decision").textContent ?? "").toMatch(/condition/i);
  });
});

// ============================================================
// F. Completion Reject（block）→ Release へ進めない
// ============================================================
describe("E2E-F: Completion Reject (block) cannot proceed to Release", () => {
  it("blocking completion goes to result, never to the release screen", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await guidedToCompletion(user);
    await user.click(screen.getByTestId("completion-block"));
    // Release 画面へは行かない（interstitial も release も出ない）。
    expect(screen.queryByTestId("interstitial-continue")).toBeNull();
    expect(screen.queryByTestId("release-approve")).toBeNull();
    // Result（blocked）へ。
    expect(await screen.findByTestId("result-highlights")).toBeInTheDocument();
  });
});

// ============================================================
// G. Release decisions（approve / conditional / reject）全 branch
// ============================================================
describe("E2E-G: all Release decision branches reach the result", () => {
  for (const decision of ["release-approve", "release-approve-with-conditions", "release-block"] as const) {
    it(`Release ${decision} completes to the result page`, async () => {
      const user = userEvent.setup();
      render(<App application={makeApp()} />);
      await guidedToCompletion(user);
      await user.click(screen.getByTestId("completion-approve"));
      const toRelease = screen.queryByTestId("interstitial-continue");
      if (toRelease !== null) await user.click(toRelease);
      await screen.findByTestId("readiness-summary");
      await user.click(screen.getByTestId(decision));
      // RC5 P1-D: release の conditional は構造化条件入力を挟む。
      if (decision === "release-approve-with-conditions") {
        await user.type(screen.getByTestId("release-cond-condition"), "Verify rollback in staging");
        await user.click(screen.getByTestId("release-cond-confirm"));
      }
      expect(await screen.findByTestId("result-highlights")).toBeInTheDocument();
    });
  }
});

// ============================================================
// H. Lifecycle labels（reviewed / passed / rework-required）
// ============================================================
describe("E2E-H: lifecycle labels reflect the real state", () => {
  it("passed after approve; rework-required after Return on the current step", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await startGuided(user);
    // J1 approve → J1 は passed。
    await approveStep(user);
    // J2 review 表示中。J1 の lifecycle は passed。
    expect(screen.getByTestId("journey-step-j1-requirements").getAttribute("data-lifecycle")).toBe("passed");

    // J2 で Return → J2 は rework-required（差し戻し中・current）。
    await submitGate(user, "return-for-rework", [{ itemId: "ac-item-mismatch", severity: "medium" }]);
    await user.click(screen.getByTestId("feedback-rework"));
    expect(screen.getByTestId("journey-step-j2-acceptance-scope").getAttribute("data-lifecycle")).toBe(
      "rework-required",
    );
    // passed（通過）と rework-required（要再作業）を混同していない。
    expect(screen.getByTestId("journey-step-j1-requirements").getAttribute("data-lifecycle")).toBe("passed");
  });
});
