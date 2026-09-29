// RC5 P1-D: Conditional Approval first-class の E2E。
//
// MANDATORY E2E MATRIX:
//  #8  Conditional Approval → next step → condition visible downstream
//  #9  Conditional Approval → Completion → open condition preserved
//  #10 Conditional Approval → Release → condition/risk/evidence preserved
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

async function submitGate(user: U, gate = "approve"): Promise<void> {
  await user.selectOptions(screen.getByTestId("review-gate"), gate);
  await user.click(screen.getByTestId("review-submit"));
}
async function approveStep(user: U): Promise<void> {
  await submitGate(user, "approve");
  const n = screen.queryByTestId("feedback-next");
  if (n !== null) await user.click(n);
}
async function guidedToCompletion(user: U): Promise<void> {
  await user.click(screen.getByTestId("journey-start-guided"));
  for (let i = 0; i < 6; i++) await approveStep(user);
  await screen.findByTestId("completion-approve");
}

afterEach(() => cleanup());

describe("RC5 P1-D — Conditional Approval is first-class and persists downstream", () => {
  it("#9/#10 Completion conditional → condition visible at Release and Result (open, with evidence & due gate)", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await guidedToCompletion(user);

    // Completion で条件付き承認 → 構造化条件を入力。
    await user.click(screen.getByTestId("completion-approve-with-conditions"));
    await user.type(
      screen.getByTestId("completion-cond-condition"),
      "Complete load testing before production",
    );
    await user.type(screen.getByTestId("completion-cond-evidence"), "Load-test report");
    await user.selectOptions(screen.getByTestId("completion-cond-duegate"), "before-release");
    await user.click(screen.getByTestId("completion-cond-confirm"));

    // interstitial → Release。
    const cont = screen.queryByTestId("interstitial-continue");
    if (cont !== null) await user.click(cont);

    // #10 Release 画面に未解決条件カードが出て、condition / evidence / source step が見える。
    const rel = await screen.findByTestId("release-open-conditions");
    expect(within(rel).getByTestId("release-open-conditions-item-0").textContent ?? "").toMatch(
      /Complete load testing/i,
    );
    expect(within(rel).getByTestId("release-open-conditions-evidence-0").textContent ?? "").toMatch(
      /Load-test report/i,
    );
    // readiness summary の open conditions 件数も 1 以上。
    expect(
      screen.getByTestId("readiness-summary-open-conditions").textContent?.replace(/\D/g, "") ?? "0",
    ).toMatch(/[1-9]/);

    // Release approve → Result。
    await user.click(screen.getByTestId("release-approve"));
    // #9 Result でも open condition が保持される。
    const res = await screen.findByTestId("result-open-conditions");
    expect(within(res).getByTestId("result-open-conditions-item-0").textContent ?? "").toMatch(
      /Complete load testing/i,
    );
  });

  it("empty condition cannot confirm a conditional approval (structured input required)", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await guidedToCompletion(user);
    await user.click(screen.getByTestId("completion-approve-with-conditions"));
    // 未入力では confirm が disabled。
    const confirm = screen.getByTestId("completion-cond-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(screen.getByTestId("completion-cond-empty")).toBeInTheDocument();
    // cancel で戻れる。
    await user.click(screen.getByTestId("completion-cond-cancel"));
    expect(screen.getByTestId("completion-approve")).toBeInTheDocument();
  });
});
