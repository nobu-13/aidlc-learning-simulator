// RC6 — P1-B（accepted fact 提示）と P2（known-defect+approve は problem-free/sound にしない）の E2E。
import { render, screen, cleanup } from "@testing-library/react";
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

async function approveStep(user: U): Promise<void> {
  await user.selectOptions(screen.getByTestId("review-gate"), "approve");
  await user.click(screen.getByTestId("review-submit"));
  const n = screen.queryByTestId("feedback-next");
  if (n !== null) await user.click(n);
}

afterEach(() => cleanup());

describe("RC6 P1-B — Design presents the fixed availability target and does not re-ask for the value", () => {
  it("availability=critical の Simulation で Design に accepted fact（可用性目標）が提示される", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-simulation"));
    await user.selectOptions(screen.getByTestId("setup-struct-availability"), "critical");
    await user.click(screen.getByTestId("setup-begin"));
    await approveStep(user); // J1
    await approveStep(user); // J2
    // J3 Design: accepted fact card が出る。
    const card = await screen.findByTestId("review-accepted-facts");
    expect(card.textContent ?? "").toMatch(/RTO|RPO|availability target/i);
    // 「確定済み前提」であることを示す文言（値の再要求ではない）。
    expect(card.textContent ?? "").toMatch(/fixed|Requirements/i);
  });
});

describe("RC6 P2 — known defect + Approve is NOT called problem-free/sound", () => {
  it("J1 real defect を caught しつつ approve → feedback は acknowledged-risk（sound と別）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));

    // J1: 実 defect（req-item-omission）を指摘（caught）しつつ approve。
    const omissionTok = opaqueItemToken("req-item-omission");
    await user.click(screen.getByTestId(`review-item-${omissionTok}`));
    const sev = screen.queryByTestId(`review-sev-${omissionTok}-medium`);
    if (sev !== null) await user.click(sev);
    await user.selectOptions(screen.getByTestId("review-gate"), "approve");
    await user.click(screen.getByTestId("review-submit"));

    // gate quality が acknowledged-risk（sound ではない）。data 属性が source of truth。
    const gq = await screen.findByTestId("feedback-gate-quality");
    expect(gq.getAttribute("data-gate-quality")).toBe("acknowledged-risk");
    expect(gq.getAttribute("data-gate-quality")).not.toBe("sound");
    // sound verdict 文言（「clean な成果物を適切に承認」）は出さない。
    expect(gq.textContent ?? "").not.toMatch(/approved a clean artifact appropriately|Sound gate decision/i);
    // 「認識した上で進行/リスクは残る」旨を出す。
    expect(gq.textContent ?? "").toMatch(/proceeded knowing|risk/i);
    // 既知欠陥を認識して Approve した note が出る。
    expect(screen.getByTestId("feedback-known-defect")).toBeInTheDocument();
  });
});
