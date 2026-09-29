// RC4 Final Product Completion — UI E2E tests。
//
// 検証（ユーザー体験として）:
//  - Iterative Rework: J3 NFR を 2 回 Return して partial -> resolved（revision 1 -> 2）。
//  - Severity consistency: 選択した severity が feedback/history で「あなたの判定」として保持される。
//  - Review note traceability: Return 時の note が revision banner に quote 表示される。
//  - Result highlights: result 上部に「まず押さえる要点」カードが出る。
//  - Adoption output: Adoption Review 完走で実務持ち帰り output が出る。
//  - Gym differentiation: Gym landing が practice 中心（弱点導線）。
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
  flag: { itemId: string; severity?: string }[] = [],
  note?: string,
): Promise<void> {
  for (const f of flag) {
    const cb = screen.queryByTestId(`review-item-${opaqueItemToken(f.itemId)}`);
    if (cb !== null) await user.click(cb);
    if (f.severity !== undefined) {
      const sev = screen.queryByTestId(`review-sev-${opaqueItemToken(f.itemId)}-${f.severity}`);
      if (sev !== null) await user.click(sev);
    }
  }
  if (note !== undefined) {
    await user.clear(screen.getByTestId("review-note"));
    await user.type(screen.getByTestId("review-note"), note);
  }
  await user.selectOptions(screen.getByTestId("review-gate"), gate);
  await user.click(screen.getByTestId("review-submit"));
}

async function clickRework(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const btn =
    screen.queryByTestId("feedback-rework-optional") ?? screen.queryByTestId("feedback-rework");
  if (btn !== null) await user.click(btn);
}

async function guidedToJ3(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByTestId("journey-start-guided"));
  for (let i = 0; i < 2; i++) {
    await submitGate(user, "approve");
    const n = screen.queryByTestId("feedback-next");
    if (n !== null) await user.click(n);
  }
}

const NFR_PARTIAL = "the design adds 99.9% uptime, multi-AZ redundancy";
const NFR_RESOLVED = "RTO 30 min, RPO 5 min";

afterEach(() => cleanup());

describe("RC4 Final E2E — iterative rework partial -> resolved", () => {
  it("two Returns on J3 NFR: revision 1 (partial) then 2 (resolved), with review note traced", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await guidedToJ3(user);

    // 1st Return with a review note.
    await submitGate(
      user,
      "return-for-rework",
      [{ itemId: "design-item-missing-nfr", severity: "high" }],
      "Please add measurable SLO and RTO/RPO.",
    );
    await clickRework(user);
    expect(screen.getByTestId("revision-label")).toHaveTextContent("1");
    expect(screen.getAllByText(new RegExp(NFR_PARTIAL)).length).toBeGreaterThanOrEqual(1);
    // Review note is traced into the revision banner.
    expect(screen.getByTestId("revision-review-note").textContent ?? "").toMatch(/measurable SLO/);
    // partial detail (remaining / why) is shown.
    expect(screen.getByTestId(`partial-detail-${opaqueItemToken("design-item-missing-nfr")}`)).toBeInTheDocument();

    // 2nd Return -> resolved.
    await submitGate(user, "return-for-rework", [{ itemId: "design-item-missing-nfr", severity: "high" }]);
    await clickRework(user);
    expect(screen.getByTestId("revision-label")).toHaveTextContent("2");
    expect(screen.getAllByText(new RegExp(NFR_RESOLVED)).length).toBeGreaterThanOrEqual(1);
    // resolved badge shown, no partial detail remains.
    expect(screen.getByTestId(`resolved-badge-${opaqueItemToken("design-item-missing-nfr")}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`partial-detail-${opaqueItemToken("design-item-missing-nfr")}`)).toBeNull();
  });
});

describe("RC4 Final E2E — severity consistency", () => {
  it("reviewer severity (High) is preserved as 'your judgment' in feedback, not overwritten by ground truth", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1: flag the requirement-omission defect with a reviewer severity of High.
    await submitGate(user, "return-for-rework", [{ itemId: "req-item-omission", severity: "high" }]);
    // feedback view shows the caught finding with reviewer severity.
    const caught = screen.getByTestId("feedback-caught");
    expect(caught.textContent ?? "").toMatch(/High/i);
  });
});

describe("RC4 Final E2E — result highlights", () => {
  it("result page shows the highlights card at the top and a details disclosure", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // Rush to completion: approve every review step, then completion + release.
    for (let i = 0; i < 6; i++) {
      await submitGate(user, "approve");
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }
    // Completion approval.
    const complete = await screen.findByTestId("completion-approve");
    await user.click(complete);
    const toRelease = screen.queryByTestId("interstitial-continue");
    if (toRelease !== null) await user.click(toRelease);
    const release = await screen.findByTestId("release-approve");
    await user.click(release);

    // Result highlights at top + details disclosure present.
    expect(await screen.findByTestId("result-highlights")).toBeInTheDocument();
    expect(screen.getByTestId("result-details")).toBeInTheDocument();
  });
});

describe("RC4 Final E2E — adoption output", () => {
  it("Adoption Review completion produces the take-home adoption output", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await user.click(screen.getByTestId("journey-start-adoption"));
    await user.click(screen.getByTestId("setup-begin"));
    // Adoption = final-only feedback: approve each review step (no feedback view between).
    for (let i = 0; i < 6; i++) {
      await submitGate(user, "approve");
    }
    const complete = await screen.findByTestId("completion-approve");
    await user.click(complete);
    const toRelease = screen.queryByTestId("interstitial-continue");
    if (toRelease !== null) await user.click(toRelease);
    const release = await screen.findByTestId("release-approve");
    await user.click(release);

    // Adoption take-home output is present with all sections.
    expect(await screen.findByTestId("adoption-output")).toBeInTheDocument();
    expect(screen.getByTestId("adoption-gate-map")).toBeInTheDocument();
    expect(screen.getByTestId("adoption-responsibility")).toBeInTheDocument();
    expect(screen.getByTestId("adoption-approval-policy")).toBeInTheDocument();
    expect(screen.getByTestId("adoption-evidence-checklist")).toBeInTheDocument();
    expect(screen.getByTestId("adoption-pilot-next")).toBeInTheDocument();
  });
});

describe("RC4 Final E2E — Gym differentiation", () => {
  it("Gym landing leads with practice, not a re-shown mode explanation", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} initialSurface="gym" />);
    // practice / focus libraries are primary entry points.
    expect(screen.getByTestId("practices")).toBeInTheDocument();
    expect(screen.getByTestId("focus")).toBeInTheDocument();
    // full run (mode selection) is a secondary card.
    expect(screen.getByTestId("gym-fullrun-card")).toBeInTheDocument();
    // navigating to practice library works (practice cards shown; the gym landing button is gone).
    await user.click(screen.getByTestId("practices"));
    expect(screen.queryByTestId("gym-fullrun-card")).toBeNull();
    expect(screen.getAllByTestId(/^practice-/).length).toBeGreaterThan(0);
  });
});
