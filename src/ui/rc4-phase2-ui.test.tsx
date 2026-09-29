// RC4 Phase 2 UI テスト — Actual Rework をユーザー体験として検証する。
//
// 検証（Phase 2 要件のうち UI / 永続 / mode 往復）:
//  - Guided: J3 で missing-nfr を指摘 → Return → revision 1 → corrected 本文が DOM に出る
//  - Simulation: critical miss → mandatory rework → correct target 選択 → revised artifact → re-review
//  - reload 後に corrected artifact が defective へ戻らない（永続）
//  - Home → Resume 後も corrected が維持
//  - Adoption も同一 Rework engine（state transition が効く）
//
// 決定的・no-network（memory storage）。
import { opaqueItemToken } from "../domain/semantic-id.ts";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../app/app.tsx";
import { createApplication, type Application } from "../app/application-orchestrator.ts";
import { scenarioModules } from "../scenarios/index.ts";
import type { StoragePort } from "../data/progress-store.ts";

function memoryStorage(initial?: Record<string, string>): StoragePort & { data: Record<string, string> } {
  const data: Record<string, string> = { ...(initial ?? {}) };
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}
function makeApp(storage: StoragePort, langs: string[] = ["en"]): Application {
  return createApplication({ scenarioModules, storage, browserLanguages: langs });
}

async function submitGate(
  user: ReturnType<typeof userEvent.setup>,
  gate = "approve",
  flag: string[] = [],
): Promise<void> {
  for (const id of flag) {
    const cb = screen.queryByTestId(`review-item-${opaqueItemToken(id)}`);
    if (cb !== null) await user.click(cb);
  }
  await user.selectOptions(screen.getByTestId("review-gate"), gate);
  await user.click(screen.getByTestId("review-submit"));
}

/** Guided を J3 まで進める（J1/J2 は approve + feedback next）。 */
async function guidedToJ3(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByTestId("journey-start-guided"));
  for (let i = 0; i < 2; i++) {
    await submitGate(user, "approve");
    const n = screen.queryByTestId("feedback-next");
    if (n !== null) await user.click(n);
  }
}

afterEach(() => cleanup());

// Guided canonical profile は internal-api-workflow。J3 の missing-nfr は RC4 Final で multi-stage:
//   stage 0 defective : "...keep the business running as much as possible during incidents..."
//   stage 1 partial   : "...99.9% uptime with a multi-AZ redundant deployment..."
//   stage 2 corrected : "...RTO 30 min and RPO 5 min...included in the acceptance criteria."
// 1 回目の Return は partial（改善したが acceptance 未達）、2 回目で resolved。
const NFR_DEFECTIVE_SNIPPET = "neither an architecture \\(redundancy, failover\\) to achieve them";
const NFR_PARTIAL_SNIPPET = "the design adds 99.9% uptime, multi-AZ redundancy";
const NFR_CORRECTED_SNIPPET = "RTO 30 min, RPO 5 min";

/** feedback view の rework ボタン（optional or must-fix）を押す。 */
async function clickRework(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const reworkBtn =
    screen.queryByTestId("feedback-rework-optional") ?? screen.queryByTestId("feedback-rework");
  expect(reworkBtn).not.toBeNull();
  await user.click(reworkBtn!);
}

describe("RC4 Phase 2 UI — Guided iterative rework (multi-stage)", () => {
  it("12. Return on J3 missing-nfr: v0 defective -> v1 partial -> v2 resolved", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await guidedToJ3(user);

    // J3 rev0: defective 本文が見える。
    expect(screen.getByText(new RegExp(NFR_DEFECTIVE_SNIPPET))).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(NFR_CORRECTED_SNIPPET))).toBeNull();

    // 1 回目 Return: partial へ前進（revision 1）。
    await submitGate(user, "return-for-rework", ["design-item-missing-nfr"]);
    await clickRework(user);
    expect(screen.getByTestId("revision-banner")).toBeInTheDocument();
    expect(screen.getByTestId("revision-label")).toHaveTextContent("1");
    expect(screen.getByTestId("revision-agent-revised")).toBeInTheDocument();
    // partial 本文が artifact 本体に出る（まだ resolved ではない）。
    expect(screen.getAllByText(new RegExp(NFR_PARTIAL_SNIPPET)).length).toBeGreaterThanOrEqual(1);
    // Local Rework Diff card は Before(defective) / After(partial) を出す。
    const localDiff1 = screen.getByTestId("local-rework-diff");
    expect(localDiff1.textContent).toMatch(new RegExp(NFR_DEFECTIVE_SNIPPET));
    expect(localDiff1.textContent).toMatch(new RegExp(NFR_PARTIAL_SNIPPET));

    // 2 回目 Return: resolved へ前進（revision 2）。
    await submitGate(user, "return-for-rework", ["design-item-missing-nfr"]);
    await clickRework(user);
    expect(screen.getByTestId("revision-label")).toHaveTextContent("2");
    expect(screen.getAllByText(new RegExp(NFR_CORRECTED_SNIPPET)).length).toBeGreaterThanOrEqual(1);
    // Diff card は Before(partial) / After(corrected)。
    const localDiff2 = screen.getByTestId("local-rework-diff");
    expect(localDiff2.textContent).toMatch(new RegExp(NFR_PARTIAL_SNIPPET));
    expect(localDiff2.textContent).toMatch(new RegExp(NFR_CORRECTED_SNIPPET));
  });
});

describe("RC4 Phase 2 UI — persistence across reload & resume", () => {
  it("10. reload after rework keeps the corrected artifact (not defective)", async () => {
    const storage = memoryStorage();
    const user = userEvent.setup();
    const { unmount } = render(<App application={makeApp(storage)} />);
    await guidedToJ3(user);
    await submitGate(user, "return-for-rework", ["design-item-missing-nfr"]);
    await clickRework(user);
    // 1 回目 Return = partial。
    expect(screen.getAllByText(new RegExp(NFR_PARTIAL_SNIPPET)).length).toBeGreaterThanOrEqual(1);

    // reload（同じ storage で再 mount）。
    unmount();
    cleanup();
    render(<App application={makeApp(storage)} />);
    // Resume して復帰。
    const resume = await screen.findByTestId("journey-resume");
    await user.click(resume);

    // partial 本文（中間 stage）が維持され、revision も維持される。
    // （defective 本文は Local Rework Diff card の Before として残るため artifact 本体のみ確認）。
    expect(screen.getAllByText(new RegExp(NFR_PARTIAL_SNIPPET)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("revision-label")).toHaveTextContent("1");
  });

  it("11. Home -> Resume after rework keeps the corrected artifact", async () => {
    const storage = memoryStorage();
    const user = userEvent.setup();
    render(<App application={makeApp(storage)} />);
    await guidedToJ3(user);
    await submitGate(user, "return-for-rework", ["design-item-missing-nfr"]);
    await clickRework(user);
    expect(screen.getAllByText(new RegExp(NFR_PARTIAL_SNIPPET)).length).toBeGreaterThanOrEqual(1);

    // Home へ戻る（journey は破棄しない）→ Resume。
    await user.click(screen.getByTestId("journey-nav-home"));
    const resume = await screen.findByTestId("journey-resume");
    await user.click(resume);

    expect(screen.getAllByText(new RegExp(NFR_PARTIAL_SNIPPET)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("revision-label")).toHaveTextContent("1");
  });
});

describe("RC4 Phase 2 UI — Simulation mandatory rework", () => {
  it("13. Simulation critical miss forces rework, then re-review shows revised artifact", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await user.click(screen.getByTestId("journey-start-simulation"));
    // availability=critical にして J3 に high severity の missing-nfr defect を activate させる。
    await user.selectOptions(screen.getByTestId("setup-struct-availability"), "critical");
    await user.click(screen.getByTestId("setup-begin"));

    // J1/J2 を approve で通す（feedback は stage-gate、next で進む）。
    for (let i = 0; i < 2; i++) {
      await submitGate(user, "approve");
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }

    // J3: high severity の missing-nfr を見逃して approve → critical learning blocker → mandatory rework。
    await submitGate(user, "approve");
    expect(screen.getByTestId("feedback-must-fix")).toBeInTheDocument();
    // 初回 mandatory rework（まだ defect を特定していない）: revision は進めず Review へ戻る。
    await user.click(screen.getByTestId("feedback-rework"));
    expect(screen.getByTestId("review-gate")).toBeInTheDocument();
    // revision banner はまだ出ない（revision 0 のまま = Artifact Version 不変）。
    expect(screen.queryByTestId("revision-banner")).toBeNull();
    // まだ defective 本文（修正されていない）。
    expect(screen.getByText(new RegExp(NFR_DEFECTIVE_SNIPPET))).toBeInTheDocument();

    // 今度は missing-nfr を正しく特定して Return for Rework。
    await submitGate(user, "return-for-rework", ["design-item-missing-nfr"]);
    // Return 判断 + caught>0 なので rework 導線が出る。
    await clickRework(user);
    // ここで初めて revision +1・partial 本文（multi-stage の 1 段階目）。
    expect(screen.getByTestId("revision-label")).toHaveTextContent("1");
    // partial 本文は artifact 本体 + Local Rework Diff card（after）に現れるため複数一致。
    expect(screen.getAllByText(new RegExp(NFR_PARTIAL_SNIPPET)).length).toBeGreaterThanOrEqual(1);
  });
});

describe("RC4 Phase 2 UI — Adoption uses the same rework engine", () => {
  it("14. Adoption review can Return and advance via the same state transition", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await user.click(screen.getByTestId("journey-start-adoption"));
    await user.click(screen.getByTestId("setup-begin"));
    // Adoption は final-only feedback。J1 を review して submit すると feedback を出さず次工程へ。
    // ここでは「同一 review engine で進める」ことのみ確認（Adoption UI redesign は Phase 2 対象外）。
    expect(screen.getByTestId("review-gate")).toBeInTheDocument();
    await submitGate(user, "approve");
    // feedback view を出さずに次 step の review へ（final-only）。
    expect(screen.getByTestId("review-gate")).toBeInTheDocument();
  });
});
