// RC6 P1-C — Simulation の structured input が実際に scenario を変える E2E（A/B contrast）。
//
// INTEGRATED USER FLOW: Simulation profile A（PII）と profile B（Public）で
// Design artifact / 評価 semantic が変わることを証明する（structured input drives artifact generation）。
import { render, screen, cleanup } from "@testing-library/react";
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

/** Simulation を指定 data sensitivity で開始し J3(Design) へ進む。J1/J2 は approve。 */
async function simulationToDesign(user: U, dataSensitivity: string): Promise<void> {
  await user.click(screen.getByTestId("journey-start-simulation"));
  await user.selectOptions(screen.getByTestId("setup-struct-dataSensitivity"), dataSensitivity);
  // 外部依存なし: PII でも外部送信起因の security defect は出さない（data classification 差だけを見る）。
  await user.selectOptions(screen.getByTestId("setup-struct-externalDependency"), "none");
  await user.click(screen.getByTestId("setup-begin"));
  // J1 → J2 → J3。
  for (let i = 0; i < 2; i++) {
    await user.selectOptions(screen.getByTestId("review-gate"), "approve");
    await user.click(screen.getByTestId("review-submit"));
    const n = screen.queryByTestId("feedback-next");
    if (n !== null) await user.click(n);
  }
}

/** 現在の review 画面の data classification grounding 本文を取得。 */
function classificationText(): string {
  const items = screen.queryAllByTestId(/^review-grounding-data-classification-/);
  return items.map((el) => el.textContent ?? "").join("|");
}

afterEach(() => cleanup());

describe("RC6 P1-C — Simulation A/B: structured data sensitivity changes the scenario", () => {
  it("profile A (personal-info) の Design は PII 境界を明示する", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await simulationToDesign(user, "personal-info");
    const text = classificationText();
    expect(text).toMatch(/Personal information|PII/i);
  });

  it("profile B (public) の Design は PII 境界なしを明示する（A と異なる）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await simulationToDesign(user, "public");
    const text = classificationText();
    expect(text).toMatch(/Public|no PII/i);
    // Public では「外部サービス連携そのものは PII 越境違反ではない」旨を明示。
    expect(text).toMatch(/not by itself a PII/i);
  });

  it("A/B contrast: 同一 step の data classification 本文が profile A と B で異なる", async () => {
    const user = userEvent.setup();
    // A: PII。
    const { unmount } = render(<App application={makeApp()} />);
    await simulationToDesign(user, "personal-info");
    const aText = classificationText();
    unmount();
    cleanup();
    // B: Public。
    render(<App application={makeApp()} />);
    await simulationToDesign(user, "public");
    const bText = classificationText();

    expect(aText.length).toBeGreaterThan(0);
    expect(bText.length).toBeGreaterThan(0);
    expect(aText).not.toBe(bText);
  });
});
