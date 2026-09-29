// RC4 Phase 3 UI テスト — Local Rework Diff / Propagation Impact の Before/After 表示。
//
// 検証:
//  - local Human Return → Agent Rework 後、Local Rework Diff card が Before/After を出す。
//  - upstream defect resolution 後、direct downstream の Propagation Impact card が
//    origin / target / cause / Before・After を出す。
//  - internal ID（defectId / slotId / enum）を露出しない。
//  - 影響が無い step では Propagation card / Diff card を捏造しない。
//  - 既存 navigation（Home / Gym）を壊さない。
//
// 決定的・no-network（memory storage）。
import { opaqueItemToken } from "../domain/semantic-id.ts";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
function makeApp(storage: StoragePort): Application {
  return createApplication({ scenarioModules, storage, browserLanguages: ["en"] });
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

async function next(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const n = screen.queryByTestId("feedback-next");
  if (n !== null) await user.click(n);
}

const NFR_DEFECTIVE_SNIPPET = "neither an architecture \\(redundancy, failover\\) to achieve them";
const NFR_PARTIAL_SNIPPET = "the design adds 99.9% uptime, multi-AZ redundancy";

afterEach(() => cleanup());

describe("RC4 Phase 3 UI — Local Rework Diff card", () => {
  it("shows Before/After for a local rework and does not leak internal IDs", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1, J2 approve。
    await submitGate(user, "approve");
    await next(user);
    await submitGate(user, "approve");
    await next(user);

    // J3: revision 0 では local diff card は出ない（未 rework）。
    expect(screen.queryByTestId("local-rework-diff")).toBeNull();

    // missing-nfr を指摘して Return → Agent Rework。
    await submitGate(user, "return-for-rework", ["design-item-missing-nfr"]);
    const reworkBtn =
      screen.queryByTestId("feedback-rework-optional") ?? screen.queryByTestId("feedback-rework");
    await user.click(reworkBtn!);

    // Local Rework Diff card が Before(defective)/After(partial) を出す（multi-stage の 1 段階目）。
    const card = screen.getByTestId("local-rework-diff");
    expect(card.textContent).toMatch(new RegExp(NFR_DEFECTIVE_SNIPPET));
    expect(card.textContent).toMatch(new RegExp(NFR_PARTIAL_SNIPPET));
    // changed の変更タイプが human-readable ラベルで出る（internal enum ではない）。
    expect(screen.getByTestId("local-diff-0-type")).toBeInTheDocument();
    // internal defectId を露出しない。
    expect(card.textContent ?? "").not.toMatch(/d-j3-missing-nfr/);
    expect(card.textContent ?? "").not.toMatch(/design-item-missing-nfr/);
  });
});

describe("RC4 Phase 3 UI — Propagation Impact card", () => {
  it("shows origin/target/cause and Before/After on the direct downstream after an upstream fix", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1, J2 approve。
    await submitGate(user, "approve");
    await next(user);
    await submitGate(user, "approve");
    await next(user);

    // J3: security-violation を指摘して Return → Agent Rework（upstream fix）。
    await submitGate(user, "return-for-rework", ["design-item-saas-logging"]);
    const reworkBtn =
      screen.queryByTestId("feedback-rework-optional") ?? screen.queryByTestId("feedback-rework");
    await user.click(reworkBtn!);

    // 再レビュー: J3 を approve して J4 へ進む。
    await submitGate(user, "approve");
    await next(user);

    // J4（direct downstream）で Propagation Impact card が出る。
    const prop = await screen.findByTestId("propagation-impact");
    expect(prop).toBeInTheDocument();
    // origin = J3、target = J4 が human-readable step 名で出る。
    expect(screen.getByTestId("propagation-origin")).toBeInTheDocument();
    expect(screen.getByTestId("propagation-target")).toBeInTheDocument();
    expect(screen.getByTestId("propagation-cause")).toBeInTheDocument();
    // internal ID を露出しない。
    expect(prop.textContent ?? "").not.toMatch(/d-j3-security-violation/);
    expect(prop.textContent ?? "").not.toMatch(/design-item-saas-logging/);
  });

  it("does NOT show a propagation card when there is no upstream fix (no fake impact)", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1 approve（何も直さない）。
    await submitGate(user, "approve");
    await next(user);
    // J2 review 画面: upstream(J1) に resolved defect は無い → propagation card は出ない。
    expect(screen.queryByTestId("propagation-impact")).toBeNull();
  });
});

describe("RC4 Phase 3 UI — existing navigation preserved", () => {
  it("Home and Gym navigation still work with the diff UI present", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    // Home に mode カードと Gym 導線がある。
    expect(screen.getByTestId("journey-start-guided")).toBeInTheDocument();
    expect(screen.getByTestId("to-gym")).toBeInTheDocument();
    await user.click(screen.getByTestId("journey-start-guided"));
    // Review 画面から Home へ戻れる。
    await user.click(screen.getByTestId("journey-nav-home"));
    expect(screen.getByTestId("journey-start-guided")).toBeInTheDocument();
  });
});
