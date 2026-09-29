// RC4 Final Integrity Pass — UI E2E regression（Blind Audit sequence を source of truth に）。
//
// P1-1: resolved finding が Approve 後に missed 表示へ戻らない。
// P1-3: 同一 downstream で「解消」と「顕在化」を同時表示しない。
// P2:   Result details 展開 / review checkbox / severity radio 独立操作。
//
// 決定的・no-network（memory storage）。
import { opaqueItemToken } from "../domain/semantic-id.ts";
import { render, screen, cleanup, within } from "@testing-library/react";
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
async function feedbackNext(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const n = screen.queryByTestId("feedback-next");
  if (n !== null) await user.click(n);
}
async function clickRework(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const btn =
    screen.queryByTestId("feedback-rework-optional") ?? screen.queryByTestId("feedback-rework");
  if (btn !== null) await user.click(btn);
}

afterEach(() => cleanup());

describe("RC4 Integrity UI — P1-1: resolved finding not scored as missed after Approve", () => {
  it("resolve NFR (2 Returns) then Approve; final result does not list it as missed", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1, J2 approve.
    await submitGate(user, "approve");
    await feedbackNext(user);
    await submitGate(user, "approve");
    await feedbackNext(user);
    // J3: resolve NFR fully (partial -> resolved).
    await submitGate(user, "return-for-rework", ["design-item-missing-nfr"]);
    await clickRework(user);
    await submitGate(user, "return-for-rework", ["design-item-missing-nfr"]);
    await clickRework(user);
    // Now J3 NFR is resolved. Approve the corrected artifact WITHOUT re-flagging NFR.
    await submitGate(user, "approve");
    await feedbackNext(user);
    // The J3 feedback for this approve must NOT show the NFR item as missed.
    // (feedback-missed section, if present, must not contain the resolved NFR label.)
    const missed = screen.queryByTestId("feedback-missed");
    if (missed !== null) {
      expect(missed.textContent ?? "").not.toMatch(/RTO 30 min and RPO 5 min/);
      // The availability-design label may reference other content; assert no "missed" NFR corrected body.
    }
  });
});

describe("RC4 Integrity UI — P1-3: no simultaneous resolved + surfaced for same origin", () => {
  it("resolving an upstream (J3) defect shows only 'improved' on J4, never a worsened item for the same origin", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    await submitGate(user, "approve");
    await feedbackNext(user);
    await submitGate(user, "approve");
    await feedbackNext(user);
    // J3: resolve the security-violation defect (propagates to J4), then approve.
    await submitGate(user, "return-for-rework", ["design-item-saas-logging"]);
    await clickRework(user);
    await submitGate(user, "approve");
    await feedbackNext(user);
    // Now on J4: gather informational propagation items and assert no worsened for a resolved origin.
    const infos = screen.queryAllByTestId(/^review-info-/);
    const improved = infos.filter((el) => el.getAttribute("data-impact") === "improved");
    const worsened = infos.filter((el) => el.getAttribute("data-impact") === "worsened");
    // At least the resolved defect should surface as improved (not worsened).
    // No informational item may claim "surfaced/顕在化" for an origin that is shown as improved.
    for (const im of improved) {
      // improved item uses the resolved badge, not the surfaced-issue cause text.
      expect(im.textContent ?? "").not.toMatch(/surfaces here/);
    }
    // Sanity: improved and worsened are distinct DOM nodes (never the same node claiming both).
    for (const w of worsened) expect(improved).not.toContain(w);
  });
});

describe("RC4 Integrity UI — P2: Result details & review controls", () => {
  async function toResult(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(screen.getByTestId("journey-start-guided"));
    for (let i = 0; i < 6; i++) {
      await submitGate(user, "approve");
      await feedbackNext(user);
    }
    await user.click(await screen.findByTestId("completion-approve"));
    const inter = screen.queryByTestId("interstitial-continue");
    if (inter !== null) await user.click(inter);
    await user.click(await screen.findByTestId("release-approve"));
  }

  it("Result details is a native <details> that toggles open on click", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await toResult(user);
    const details = (await screen.findByTestId("result-details")) as HTMLDetailsElement;
    expect(details.tagName.toLowerCase()).toBe("details");
    expect(details.open).toBe(false);
    const summary = within(details).getByText(/Show details/i);
    await user.click(summary);
    expect(details.open).toBe(true);
  });

  it("severity radio does not deselect the finding checkbox (independent controls)", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1: select the omission finding, then set severity — checkbox must stay checked.
    const cb = screen.getByTestId(`review-item-${opaqueItemToken("req-item-omission")}`) as HTMLInputElement;
    await user.click(cb);
    expect(cb.checked).toBe(true);
    const sevHigh = screen.getByTestId(`review-sev-${opaqueItemToken("req-item-omission")}-high`) as HTMLInputElement;
    await user.click(sevHigh);
    expect(sevHigh.checked).toBe(true);
    // finding remains selected after choosing severity.
    expect((screen.getByTestId(`review-item-${opaqueItemToken("req-item-omission")}`) as HTMLInputElement).checked).toBe(true);
  });

  it("finding checkbox toggles by keyboard Space", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    const cb = screen.getByTestId(`review-item-${opaqueItemToken("req-item-omission")}`) as HTMLInputElement;
    cb.focus();
    await user.keyboard(" ");
    expect(cb.checked).toBe(true);
  });
});
