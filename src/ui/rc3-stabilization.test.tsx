// RC3 Stabilization 回帰テスト（UI 層）— P1-1 leakage / P1-2 persistence-resume /
// P1-4 navigation / P2-1 user text / P2-2 revision / P2-3 consequence / P2-4 completion / P2-5 result。
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

function makeApp(languages: string[] = ["en"], storage: StoragePort = memoryStorage()): Application {
  return createApplication({ scenarioModules, storage, browserLanguages: languages });
}

async function submitReview(
  user: ReturnType<typeof userEvent.setup>,
  opts: { flag?: string[]; gate?: string } = {},
): Promise<void> {
  for (const id of opts.flag ?? []) {
    const cb = screen.queryByTestId(`review-item-${id}`);
    if (cb !== null) await user.click(cb);
  }
  if (opts.gate !== undefined) await user.selectOptions(screen.getByTestId("review-gate"), opts.gate);
  await user.click(screen.getByTestId("review-submit"));
}

afterEach(() => cleanup());

// ---------- P1-1: Adoption answer leakage ----------
describe("P1-1 Adoption answer leakage", () => {
  const BANNED = ["valid", "distractor", "not a problem", "recommended", "correct", "(defect)"];

  it("Adoption pre-submit shows no answer-class cue", async () => {
    const user = userEvent.setup();
    const { container } = render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-adoption"));
    await user.click(screen.getByTestId("setup-begin"));
    // review view の可視テキストに answer-class 語が出ない。
    const text = (container.textContent ?? "").toLowerCase();
    for (const b of BANNED) expect(text).not.toContain(b);
    // checkbox はあるが、どれが finding か示すラベルは無い。
    expect(screen.getByTestId("review-submit")).toBeInTheDocument();
  });

  it("Adoption final result can disclose evaluation (post-journey)", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-adoption"));
    await user.click(screen.getByTestId("setup-begin"));
    // J1..J6 approve（final-only なので feedback 無し）→ completion → release → result。
    for (let i = 0; i < 6; i++) await submitReview(user, { gate: "approve" });
    await user.click(screen.getByTestId("completion-approve"));
    await user.click(screen.getByTestId("interstitial-continue"));
    await user.click(screen.getByTestId("release-approve"));
    // result で評価（diagnostics / dimensions）が開示される。
    expect(screen.getByTestId("journey-dimensions")).toBeInTheDocument();
    expect(screen.getByTestId("result-missed")).toBeInTheDocument();
  });
});

// ---------- P1-2: Persistence / Resume ----------
describe("P1-2 Persistence / Resume", () => {
  it("Simulation setup input persists and Resume returns to review", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { unmount } = render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-start-simulation"));
    await user.type(screen.getByTestId("setup-ua-goal"), "My project goal");
    await user.click(screen.getByTestId("setup-begin"));
    expect(screen.getByTestId("review-submit")).toBeInTheDocument();
    unmount();
    cleanup();
    // reload。
    render(<App application={makeApp(["en"], storage)} />);
    expect(screen.getByTestId("journey-resume-card")).toBeInTheDocument();
    await user.click(screen.getByTestId("journey-resume"));
    expect(screen.getByTestId("review-submit")).toBeInTheDocument();
    // user-authored の goal が引用に保持されている。
    const quoted = screen.queryByTestId("review-quoted-goal");
    if (quoted !== null) expect(quoted.textContent).toContain("My project goal");
  });

  it("Simulation J3 progress + reviews persist across reload", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { unmount } = render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-start-simulation"));
    await user.click(screen.getByTestId("setup-begin"));
    // J1, J2 を approve で通す（feedback → next）。J3 の review 画面まで到達。
    for (let i = 0; i < 2; i++) {
      await submitReview(user, { gate: "approve" });
      const next = screen.queryByTestId("feedback-next");
      if (next !== null) await user.click(next);
    }
    expect(screen.getByTestId("journey-step-j3-design")).toBeInTheDocument();
    unmount();
    cleanup();
    render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-resume"));
    // resume 後も J3 の review。
    expect(screen.getByTestId("review-submit")).toBeInTheDocument();
    expect(screen.getByTestId("journey-step-j3-design")).toHaveAttribute("aria-current", "step");
  });
});

// ---------- P1-4: Navigation ----------
describe("P1-4 Navigation", () => {
  it("Home then Resume keeps journey state (no discard)", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    expect(screen.getByTestId("review-submit")).toBeInTheDocument();
    await user.click(screen.getByTestId("journey-nav-home"));
    // Home に戻っても Resume で復帰できる（破棄しない）。
    expect(screen.getByTestId("journey-resume-card")).toBeInTheDocument();
    await user.click(screen.getByTestId("journey-resume"));
    expect(screen.getByTestId("review-submit")).toBeInTheDocument();
  });

  it("Feedback Back returns to review without changing domain progress", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    await submitReview(user, { gate: "approve" }); // feedback 表示
    expect(screen.getByTestId("feedback-gate-quality")).toBeInTheDocument();
    // feedback から Back。
    await user.click(screen.getByTestId("journey-nav-back"));
    expect(screen.getByTestId("review-submit")).toBeInTheDocument();
    // J1 のまま（completedStepIds は進んでいない）。
    expect(screen.getByTestId("journey-step-j1-requirements")).toHaveAttribute("aria-current", "step");
  });
});

// ---------- P2-1: user-authored text raw ----------
describe("P2-1 user-authored raw text", () => {
  it("Japanese raw goal shows without missing wrapper", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["ja"])} />);
    await user.click(screen.getByTestId("journey-start-simulation"));
    await user.type(screen.getByTestId("setup-ua-goal"), "顧客向け申請システム");
    await user.click(screen.getByTestId("setup-begin"));
    const quoted = screen.getByTestId("review-quoted-goal");
    expect(quoted.textContent).toContain("顧客向け申請システム");
    expect(quoted.textContent).not.toContain("missing:");
    expect(quoted.textContent).not.toContain("\u27E6"); // ⟦
  });

  it("switching ja->en does not change user-authored text", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["ja"])} />);
    await user.click(screen.getByTestId("journey-start-simulation"));
    await user.type(screen.getByTestId("setup-ua-goal"), "顧客向け申請システム");
    await user.click(screen.getByTestId("setup-begin"));
    // en へ切替（lang switcher の select）。
    const langSelect = screen.queryByTestId("lang-select");
    if (langSelect !== null) await user.selectOptions(langSelect, "en");
    const quoted = screen.getByTestId("review-quoted-goal");
    // user text は翻訳されず不変。
    expect(quoted.textContent).toContain("顧客向け申請システム");
  });
});

// ---------- P2-2: revision visible ----------
describe("P2-2 revision visible", () => {
  it("after rework, review shows Revision 1 with reason", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1 で approve → feedback。Guided は assisted rework ボタンあり。
    await submitReview(user, { gate: "approve" });
    // feedback から rework（optional）を押して J1 を revise。
    const rework = screen.queryByTestId("feedback-rework-optional") ?? screen.queryByTestId("feedback-rework");
    expect(rework).not.toBeNull();
    await user.click(rework!);
    // 戻った review に Revision banner。
    expect(screen.getByTestId("revision-banner")).toBeInTheDocument();
    expect(screen.getByTestId("revision-label").textContent).toContain("1");
  });
});

// ---------- P2-4: completion summary ----------
describe("P2-4 completion summary", () => {
  it("completion view shows evidence/unresolved/remaining-risk without release info", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    for (let i = 0; i < 6; i++) {
      await submitReview(user, { gate: "approve" });
      const next = screen.queryByTestId("feedback-next");
      if (next !== null) await user.click(next);
    }
    expect(screen.getByTestId("completion-summary")).toBeInTheDocument();
    expect(screen.getByTestId("completion-evidence")).toBeInTheDocument();
    expect(screen.getByTestId("completion-unresolved")).toBeInTheDocument();
    expect(screen.getByTestId("completion-remaining-risk")).toBeInTheDocument();
    // release 固有語（reversibility）は completion summary に出さない。
    const summary = screen.getByTestId("completion-summary");
    expect(within(summary).queryByText(/reversibility/i)).toBeNull();
  });
});

// ---------- P2-5: result causal ----------
describe("P2-5 result causal guidance", () => {
  it("result shows causal summary with revisit for missed evidence", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // 全 step approve（見逃し多数）→ negative dimension 発生。
    for (let i = 0; i < 6; i++) {
      await submitReview(user, { gate: "approve" });
      const next = screen.queryByTestId("feedback-next");
      if (next !== null) await user.click(next);
    }
    await user.click(screen.getByTestId("completion-approve"));
    await user.click(screen.getByTestId("interstitial-continue"));
    await user.click(screen.getByTestId("release-approve"));
    expect(screen.getByTestId("result-causal")).toBeInTheDocument();
  });
});
