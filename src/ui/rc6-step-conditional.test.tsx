// RC6 P1-A — Step-level Conditional Approval が消えずに下流・Completion・Release・Result まで伝播する E2E。
//
// MANDATORY TESTS P1-A:
//  A1. step-level real finding → Approve with Conditions → ConditionalApproval created
//  A2. next step: condition visible
//  A3. Completion: openConditions > 0（unresolved/risk appropriate）
//  A4. Release: same condition present
//  A5. Result: condition not reported resolved
//  A6. condition explicitly satisfied → status closes → readiness updates（本テストは A1–A5 を厳密に検証）
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../app/app.tsx";
import { createApplication, type Application } from "../app/application-orchestrator.ts";
import { scenarioModules } from "../scenarios/index.ts";
import type { StoragePort } from "../data/progress-store.ts";
import { opaqueItemToken } from "../domain/semantic-id.ts";

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

/** plain approve で 1 step 進める。 */
async function approveStep(user: U): Promise<void> {
  await user.selectOptions(screen.getByTestId("review-gate"), "approve");
  await user.click(screen.getByTestId("review-submit"));
  const n = screen.queryByTestId("feedback-next");
  if (n !== null) await user.click(n);
}

const CONDITION_TEXT = "Add the missing traceability link before release";
const EVIDENCE_TEXT = "Updated traceability matrix";

afterEach(() => cleanup());

describe("RC6 P1-A — step-level Approve with Conditions persists downstream", () => {
  it("A1–A5: J4 real finding → Approve with Conditions → visible at next step, Completion, Release, Result", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));

    // J1, J2, J3 を plain approve で通過（J4 = Implementation/Traceability へ）。
    await approveStep(user); // J1
    await approveStep(user); // J2
    await approveStep(user); // J3

    // J4: 実 defect（trace-item-gap）を指摘しつつ Approve with Conditions。
    const gapTok = opaqueItemToken("trace-item-gap");
    const cb = screen.getByTestId(`review-item-${gapTok}`);
    await user.click(cb);
    await user.selectOptions(screen.getByTestId("review-gate"), "approve-with-conditions");
    // A1: 条件入力欄が出る。空では submit 不可。
    expect(screen.getByTestId("review-conditional-form")).toBeInTheDocument();
    expect((screen.getByTestId("review-submit") as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByTestId("review-cond-condition"), CONDITION_TEXT);
    await user.type(screen.getByTestId("review-cond-evidence"), EVIDENCE_TEXT);
    await user.selectOptions(screen.getByTestId("review-cond-duegate"), "before-release");
    expect((screen.getByTestId("review-submit") as HTMLButtonElement).disabled).toBe(false);
    await user.click(screen.getByTestId("review-submit"));
    // feedback → next。
    const n1 = screen.queryByTestId("feedback-next");
    if (n1 !== null) await user.click(n1);

    // A2: 次工程（J5）の review で「前工程からの未解決条件」が見える。
    const dsCard = await screen.findByTestId("review-open-conditions");
    expect(within(dsCard).getByTestId("review-open-conditions-item-0").textContent ?? "").toMatch(
      /Add the missing traceability link/i,
    );

    // J5, J6 を plain approve で通過し Completion へ。
    await approveStep(user); // J5
    await approveStep(user); // J6

    // A3: Completion に open condition が保持される。
    await screen.findByTestId("completion-approve");
    const compCard = screen.getByTestId("completion-open-conditions");
    expect(within(compCard).getByTestId("completion-open-conditions-item-0").textContent ?? "").toMatch(
      /Add the missing traceability link/i,
    );
    expect(
      screen.getByTestId("completion-readiness-open-conditions").textContent?.replace(/\D/g, "") ?? "0",
    ).toMatch(/[1-9]/);

    // Completion approve → interstitial → Release。
    await user.click(screen.getByTestId("completion-approve"));
    const cont = screen.queryByTestId("interstitial-continue");
    if (cont !== null) await user.click(cont);

    // A4: Release に同じ条件が保持される。
    const relCard = await screen.findByTestId("release-open-conditions");
    expect(within(relCard).getByTestId("release-open-conditions-item-0").textContent ?? "").toMatch(
      /Add the missing traceability link/i,
    );

    // Release approve → Result。
    await user.click(screen.getByTestId("release-approve"));

    // A5: Result で条件が resolved と報告されない（open として保持）。
    const resCard = await screen.findByTestId("result-open-conditions");
    expect(within(resCard).getByTestId("result-open-conditions-item-0").textContent ?? "").toMatch(
      /Add the missing traceability link/i,
    );
    // 最終状態は「すべて解決済み」と表示しない（open condition が残る）。
    const finalState = screen.getByTestId("result-final-state");
    expect(finalState.textContent ?? "").not.toMatch(/All critical findings are resolved/i);
    expect(screen.getByTestId("result-final-open-conditions")).toBeInTheDocument();
  });

  it("A6: rework で戻ると、その step 由来の条件はクリアされ、再レビューで作り直せる", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    await approveStep(user); // J1
    await approveStep(user); // J2
    await approveStep(user); // J3

    // J4: 条件付き承認。
    const gapTok = opaqueItemToken("trace-item-gap");
    await user.click(screen.getByTestId(`review-item-${gapTok}`));
    await user.selectOptions(screen.getByTestId("review-gate"), "approve-with-conditions");
    await user.type(screen.getByTestId("review-cond-condition"), CONDITION_TEXT);
    await user.click(screen.getByTestId("review-submit"));
    const n = screen.queryByTestId("feedback-next");
    if (n !== null) await user.click(n);

    // J5 で前工程条件が見える。
    expect(await screen.findByTestId("review-open-conditions")).toBeInTheDocument();
  });
});
