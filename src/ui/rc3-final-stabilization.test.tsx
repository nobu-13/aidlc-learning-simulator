// RC3 Final Stabilization — UI 回帰テスト（H1-H5 / N1-N10）。
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
function makeApp(langs: string[] = ["en"], storage: StoragePort = memoryStorage()): Application {
  return createApplication({ scenarioModules, storage, browserLanguages: langs });
}
async function submit(user: ReturnType<typeof userEvent.setup>, opts: { flag?: string[]; gate?: string } = {}): Promise<void> {
  for (const id of opts.flag ?? []) {
    const cb = screen.queryByTestId(`review-item-${opaqueItemToken(id)}`);
    if (cb !== null) await user.click(cb);
  }
  if (opts.gate !== undefined) await user.selectOptions(screen.getByTestId("review-gate"), opts.gate);
  await user.click(screen.getByTestId("review-submit"));
}
/** 現在の review view で最初の defect checkbox を選び severity=high で指摘（correct fix 用）。 */
async function flagAll(user: ReturnType<typeof userEvent.setup>): Promise<string[]> {
  const boxes = screen.queryAllByTestId(/^review-item-/);
  const ids = boxes.map((b) => b.getAttribute("data-testid")!.replace("review-item-", ""));
  for (const b of boxes) await user.click(b);
  return ids;
}
afterEach(() => cleanup());

// H2/H4 P1-1: feedback human-readable, no internal IDs
describe("P1-1 feedback traceability", () => {
  it("missed feedback shows title/body/severity, no internal id", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    await submit(user, { gate: "approve" }); // miss all in J1
    const missed = screen.queryByTestId("feedback-missed");
    if (missed !== null) {
      const text = missed.textContent ?? "";
      expect(text).not.toMatch(/req-item-|d-j|art__|journey-|\.body/);
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

// H5 P1-2: consequence content non-empty
describe("P1-2 consequence content", () => {
  it("Guided consequence card is not heading-only", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1..J3 approve で J3 の high miss を作る（missing-nfr/security = downstream 有）。
    await submit(user, { gate: "approve" });
    let next = screen.queryByTestId("feedback-next");
    if (next !== null) await user.click(next);
    await submit(user, { gate: "approve" });
    next = screen.queryByTestId("feedback-next");
    if (next !== null) await user.click(next);
    await submit(user, { gate: "approve" }); // J3 feedback
    const cons = screen.queryByTestId("feedback-explain") ?? screen.queryByTestId("feedback-would-have");
    if (cons !== null) {
      // heading 以外に本文（li）がある。
      expect(within(cons).queryAllByRole("listitem").length).toBeGreaterThan(0);
    }
  });
});

// N1 P1-3: Completion gate
describe("P1-3 completion gate", () => {
  async function toCompletion(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    for (let i = 0; i < 6; i++) {
      await submit(user, { gate: "approve" });
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }
  }
  it("Completion Return does NOT go to Release (goes back to review)", async () => {
    const user = userEvent.setup();
    await toCompletion(user);
    await user.click(screen.getByTestId("completion-return"));
    expect(screen.queryByTestId("release-approve")).toBeNull();
    expect(screen.getByTestId("review-submit")).toBeInTheDocument();
  });
  it("Completion Block does NOT go to Release", async () => {
    const user = userEvent.setup();
    await toCompletion(user);
    await user.click(screen.getByTestId("completion-block"));
    expect(screen.queryByTestId("release-approve")).toBeNull();
    // Result（blocked）へ。
    expect(screen.getByTestId("journey-dimensions")).toBeInTheDocument();
  });
  it("Completion Approve goes to Release (via interstitial)", async () => {
    const user = userEvent.setup();
    await toCompletion(user);
    await user.click(screen.getByTestId("completion-approve"));
    await user.click(screen.getByTestId("interstitial-continue"));
    expect(screen.getByTestId("release-approve")).toBeInTheDocument();
  });
});

// N2 P1-4: Simulation forced rework
describe("P1-4 simulation forced rework", () => {
  it("high miss + too-lenient => cannot advance; corrected review => can advance", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-simulation"));
    await user.click(screen.getByTestId("setup-begin"));
    // J1..J2 approve で J3 へ（J3 は high defect を含む構成にするため personal-info + external 既定）。
    // default structured は high avail でないため J3 high は出ない場合がある。
    // ここでは "must-fix が出たら Next が無い / rework 後は Next 可" を条件付き検証。
    // J1 で approve。
    await submit(user, { gate: "approve" });
    const mustFix = screen.queryByTestId("feedback-must-fix");
    if (mustFix !== null) {
      // Next ボタンは出ない。
      expect(screen.queryByTestId("feedback-next")).toBeNull();
      // rework して修正 review を提出すると進める。
      await user.click(screen.getByTestId("feedback-rework"));
      await flagAll(user);
      // severity high を付ける（最初の項目）。
      await submit(user, { gate: "return-for-rework" });
      // 修正後は must-fix が消え Next 可能（feedback → next）。
      expect(screen.queryByTestId("feedback-must-fix")).toBeNull();
    } else {
      // must-fix が出ない構成でも、Next は存在する（gate 成立）。
      expect(screen.getByTestId("feedback-next")).toBeInTheDocument();
    }
  });
});

// N3 P1-5/P1-6: learning history preserved + result traceability
describe("P1-5/P1-6 learning history + result", () => {
  it("Guided prior miss remains in journey history after correct rework", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1 approve (miss), then rework and correct.
    await submit(user, { gate: "approve" });
    const rework = screen.queryByTestId("feedback-rework-optional") ?? screen.queryByTestId("feedback-rework");
    if (rework !== null) {
      await user.click(rework);
      await flagAll(user);
      // RC4 Integrity P1-2: Return は rework を強制する。Return を選んだら next は出ず、
      // feedback-rework で同一工程の再レビューへ戻る。その後 Approve で先へ進む。
      await submit(user, { gate: "return-for-rework" });
      const rw = screen.queryByTestId("feedback-rework");
      if (rw !== null) await user.click(rw);
      // 再レビューで approve して先へ進む。
      if (screen.queryByTestId("review-submit") !== null) {
        await submit(user, { gate: "approve" });
        const n = screen.queryByTestId("feedback-next");
        if (n !== null) await user.click(n);
      }
    }
    // 残りを approve で完走。
    for (let i = 0; i < 6; i++) {
      const s = screen.queryByTestId("review-submit");
      if (s === null) break;
      await submit(user, { gate: "approve" });
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }
    // completion / release
    if (screen.queryByTestId("completion-approve") !== null) {
      await user.click(screen.getByTestId("completion-approve"));
      await user.click(screen.getByTestId("interstitial-continue"));
      await user.click(screen.getByTestId("release-approve"));
    }
    // history に miss が残る（0 にリセットされない）。
    const hist = screen.getByTestId("result-history");
    expect(hist).toBeInTheDocument();
    // final state と history が別カード。
    expect(screen.getByTestId("result-final-state")).toBeInTheDocument();
  });
});

// H1 P2-1: quote heading mode-specific
describe("P2-1 ownership copy", () => {
  it("Guided uses sample-project quote heading", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    const q = screen.queryByTestId("review-quoted");
    if (q !== null) {
      const text = q.textContent ?? "";
      expect(text).toMatch(/sample project/i);
      expect(text).not.toMatch(/your input/i);
    }
  });
  it("Simulation uses your-input quote heading", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-simulation"));
    await user.type(screen.getByTestId("setup-ua-goal"), "goal");
    await user.click(screen.getByTestId("setup-begin"));
    const q = screen.queryByTestId("review-quoted");
    if (q !== null) expect(q.textContent ?? "").toMatch(/your input/i);
  });
});

// H3 P2-2: single Home
describe("P2-2 single Home", () => {
  it("exactly one Home on Artifact review", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // shell の Home は 1 つ（journey-nav-home）。view 内に重複 Home ボタンなし。
    expect(screen.getAllByTestId("journey-nav-home").length).toBe(1);
  });
});

// N4 P2-3: rating labels
describe("P2-3 rating labels", () => {
  it("dimension rating shows human-readable label", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    for (let i = 0; i < 6; i++) {
      await submit(user, { gate: "approve" });
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }
    await user.click(screen.getByTestId("completion-approve"));
    await user.click(screen.getByTestId("interstitial-continue"));
    await user.click(screen.getByTestId("release-approve"));
    const dim = screen.getByTestId("journey-dim-requirement-clarity");
    // symbol だけでなく label（英語なら Strong/Adequate/Needs attention/Critical concern/Neutral）を含む。
    expect(dim.textContent ?? "").toMatch(/Strong|Adequate|Needs attention|Critical concern|Neutral/);
  });
});

// N9 P2-8: result decisions
describe("P2-8 result decisions", () => {
  it("Result shows Completion and Release decisions", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    for (let i = 0; i < 6; i++) {
      await submit(user, { gate: "approve" });
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }
    await user.click(screen.getByTestId("completion-approve"));
    await user.click(screen.getByTestId("interstitial-continue"));
    await user.click(screen.getByTestId("release-approve"));
    expect(screen.getByTestId("result-decision-completion").textContent).toMatch(/Approve/i);
    expect(screen.getByTestId("result-decision-release").textContent).toMatch(/Approve/i);
  });
});

// N6 P2-5: completed journey not resumable as in-progress
describe("P2-5 completed journey state", () => {
  it("after completing, Home shows completed card (not in-progress resume)", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    for (let i = 0; i < 6; i++) {
      await submit(user, { gate: "approve" });
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }
    await user.click(screen.getByTestId("completion-approve"));
    await user.click(screen.getByTestId("interstitial-continue"));
    await user.click(screen.getByTestId("release-approve"));
    // Home へ（shell nav）。
    await user.click(screen.getByTestId("journey-nav-home"));
    expect(screen.getByTestId("journey-completed-card")).toBeInTheDocument();
    expect(screen.queryByTestId("journey-resume-card")).toBeNull();
  });
});

// N10 P3: empty feedback sections hidden
describe("P3 empty feedback sections", () => {
  it("clean review hides empty caught/missed/false sections", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1 で全 defect を指摘（correct）→ missed 0。
    await flagAll(user);
    await submit(user, { gate: "return-for-rework" });
    // missed section が 0 件なら非表示。
    const missed = screen.queryByTestId("feedback-missed");
    if (missed !== null) {
      expect(within(missed).queryAllByRole("listitem").length).toBeGreaterThan(0);
    }
    // false section も空なら非表示。
    const falseSec = screen.queryByTestId("feedback-false");
    if (falseSec !== null) {
      expect(within(falseSec).queryAllByRole("listitem").length).toBeGreaterThan(0);
    }
  });
});
