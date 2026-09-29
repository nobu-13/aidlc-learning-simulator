// RC4 Persistence v4 — reload / resume E2E（UI 経路）。
//
// 検証:
//  - local rework → upstream defect resolve → downstream propagation → persist → reload → resume。
//  - reload 後も corrected 本文 / revision / propagation 影響 / Artifact 内容が維持される。
//  - v3 以前の safe reset notice（journey-recovered-banner）。
//  - navigation regression なし。
//
// 決定的・no-network（memory storage）。artifactVersion 等の internal 数値は UI へ露出しないため、
// observable behavior（本文・revision label・propagation card）で整合を確認する。
// exact な artifactVersions/materializedSteps round-trip は progress-store.test.ts で担保。
import { opaqueItemToken } from "../domain/semantic-id.ts";
import { render, screen, cleanup, within } from "@testing-library/react";
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

const NFR_PARTIAL_SNIPPET = "the design adds 99.9% uptime, multi-AZ redundancy";
const KEY = "aidlc-learning-simulator/progress/v1";

afterEach(() => cleanup());

describe("RC4 Persistence v4 — reload/resume E2E", () => {
  it("local rework state (revision & partial body) survives reload+resume", async () => {
    const storage = memoryStorage();
    const user = userEvent.setup();
    const { unmount } = render(<App application={makeApp(storage)} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    await submitGate(user, "approve");
    await next(user);
    await submitGate(user, "approve");
    await next(user);
    // J3: local rework で missing-nfr を partial 化（revision 1 / artifactVersion 1 / defectStage 1）。
    await submitGate(user, "return-for-rework", ["design-item-missing-nfr"]);
    const reworkBtn =
      screen.queryByTestId("feedback-rework-optional") ?? screen.queryByTestId("feedback-rework");
    await user.click(reworkBtn!);
    expect(screen.getByTestId("revision-label")).toHaveTextContent("1");

    // reload（同じ storage）。
    unmount();
    cleanup();
    render(<App application={makeApp(storage)} />);
    const resume = await screen.findByTestId("journey-resume");
    await user.click(resume);

    // reload 後も revision 1 と partial 本文が維持される（defectStages exact restore の効果）。
    expect(screen.getByTestId("revision-label")).toHaveTextContent("1");
    expect(screen.getAllByText(new RegExp(NFR_PARTIAL_SNIPPET)).length).toBeGreaterThanOrEqual(1);
    // 復元起因の crash / error boundary が出ていない。
    expect(screen.queryByText("An unexpected error occurred")).toBeNull();
  });

  it("propagation state (downstream impact) survives reload+resume", async () => {
    const storage = memoryStorage();
    const user = userEvent.setup();
    const { unmount } = render(<App application={makeApp(storage)} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    await submitGate(user, "approve");
    await next(user);
    await submitGate(user, "approve");
    await next(user);
    // J3: security-violation を Return→Agent Rework（upstream fix）。
    await submitGate(user, "return-for-rework", ["design-item-saas-logging"]);
    const reworkBtn =
      screen.queryByTestId("feedback-rework-optional") ?? screen.queryByTestId("feedback-rework");
    await user.click(reworkBtn!);
    // J3 approve → J4 へ。
    await submitGate(user, "approve");
    await next(user);
    // J4 で propagation impact card が出る。
    expect(await screen.findByTestId("propagation-impact")).toBeInTheDocument();

    // reload + resume。
    unmount();
    cleanup();
    render(<App application={makeApp(storage)} />);
    const resume = await screen.findByTestId("journey-resume");
    await user.click(resume);

    // reload 後も J4 の propagation impact card が維持される（materializedSteps + artifactVersions restore）。
    const prop = await screen.findByTestId("propagation-impact");
    expect(prop).toBeInTheDocument();
    expect(within(prop).getByTestId("propagation-origin")).toBeInTheDocument();
    expect(screen.queryByText("An unexpected error occurred")).toBeNull();
  });
});

describe("RC4 Persistence v4 — v3 safe reset notice", () => {
  it("v3 journey は safe reset され、非互換 notice を表示し、新しい Journey を開始できる", async () => {
    // v3 の persisted state（journey 付き）を storage に置く。
    const v3 = {
      persistenceSchemaVersion: 3,
      locale: "en",
      mode: "simulation",
      sessions: [],
      decisionRecords: [],
      completedScenarioIds: [],
      adoptionMemos: [],
      workshopInputs: {},
      practiceDrafts: {},
      journey: {
        mode: "simulation",
        profileId: "user",
        currentStepId: "j3-design",
        userAuthored: {},
        structured: {},
        revisions: { "j3-design": 2 },
        completedStepIds: ["j1-requirements", "j2-acceptance-scope"],
        reworkHistory: [],
        reviews: {},
      },
    };
    const storage = memoryStorage({ [KEY]: JSON.stringify(v3) });
    render(<App application={makeApp(storage)} />);
    // 非互換 notice（human-readable・schema version は露出しない）。
    expect(screen.getByTestId("journey-recovered-banner")).toBeInTheDocument();
    // 旧 journey は復元されず、resume ではなく新規開始できる（resume card は出ない）。
    expect(screen.queryByTestId("journey-resume")).toBeNull();
    expect(screen.getByTestId("journey-start-guided")).toBeInTheDocument();
    // crash していない。
    expect(screen.queryByText("An unexpected error occurred")).toBeNull();
  });
});
