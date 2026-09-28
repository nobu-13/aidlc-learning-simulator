import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../app/app.tsx";
import { createApplication, type Application } from "../app/application-orchestrator.ts";
import { scenarioModules } from "../scenarios/index.ts";
import type { StoragePort } from "../data/progress-store.ts";

function memoryStorage(initial?: Record<string, string>): StoragePort {
  const data: Record<string, string> = { ...(initial ?? {}) };
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

function makeApp(languages: string[] = ["en"], storage: StoragePort = memoryStorage()): Application {
  return createApplication({ scenarioModules, storage, browserLanguages: languages });
}

/** core-e2e を良い選択で完走させるヘルパ（mode を testid で選ぶ）。 */
async function completeCore(user: ReturnType<typeof userEvent.setup>, modeTestId = "mode-guided"): Promise<void> {
  await user.click(screen.getByTestId("start"));
  await user.click(screen.getByTestId(modeTestId));
  await user.click(screen.getByTestId("begin"));
  const path = ["o-ac-clarify", "o-del-agent-lowrisk", "o-test-investigate", "o-rel-separate"];
  for (const opt of path) {
    await user.click(screen.getByTestId(`option-${opt}`));
    await user.click(screen.getByTestId("proceed"));
  }
}

afterEach(() => cleanup());

describe("RC2: DP1 feedback (BUG 4.1)", () => {
  it("最初の判断（dp-ac）でも空でない feedback（selected + status + why）を表示する", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    await user.click(screen.getByTestId("begin"));
    await user.click(screen.getByTestId("option-o-ac-clarify"));
    // feedback card が出て、選択ラベルと status を含む。
    expect(screen.getByTestId("feedback-card")).toBeInTheDocument();
    expect(screen.getByTestId("feedback-selected-label")).toBeInTheDocument();
    // dp-ac に lp-ac を紐付けたので Why 本文（LP）も出る。
    expect(screen.getByTestId("fb-lp-lp-ac")).toBeInTheDocument();
  });

  it("選択に応じて status が変わる（option 別 feedback）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    await user.click(screen.getByTestId("begin"));
    // risky な選択（skip）は status-risky を出す。
    await user.click(screen.getByTestId("option-o-ac-skip"));
    expect(screen.getByTestId("status-risky")).toBeInTheDocument();
  });
});

describe("RC2: note duplication regression (BUG 4.3)", () => {
  it("DP1 で入力した note が次 DP に残らず、Sheet で重複しない", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-adoption-review"));
    await user.click(screen.getByTestId("begin"));
    // DP1 で note を入力。
    await user.type(screen.getByTestId("note"), "first-note-unique");
    await user.click(screen.getByTestId("option-o-ac-clarify"));
    await user.click(screen.getByTestId("proceed"));
    // DP2: note textarea は空にリセットされている。
    expect(screen.getByTestId("note")).toHaveValue("");
    await user.click(screen.getByTestId("option-o-del-agent-lowrisk"));
    await user.click(screen.getByTestId("proceed"));
    await user.click(screen.getByTestId("option-o-test-investigate"));
    await user.click(screen.getByTestId("proceed"));
    await user.click(screen.getByTestId("option-o-rel-separate"));
    await user.click(screen.getByTestId("proceed"));
    // result → reflection → adoption → generate sheet。
    await user.click(screen.getByTestId("to-reflection"));
    await user.click(screen.getByTestId("to-adoption"));
    await user.click(screen.getByTestId("generate-sheet"));
    const preview = screen.getByTestId("sheet-preview") as HTMLTextAreaElement;
    const occurrences = preview.value.split("first-note-unique").length - 1;
    expect(occurrences).toBe(1);
  });
});

describe("RC2: English sheet has no Japanese (BUG 4.4)", () => {
  it("en の Adoption Sheet に日本語（HTML コメント含む）が混入しない", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["en"])} initialSurface="gym" />);
    await completeCore(user, "mode-adoption-review");
    await user.click(screen.getByTestId("to-reflection"));
    await user.click(screen.getByTestId("to-adoption"));
    await user.click(screen.getByTestId("generate-sheet"));
    const preview = screen.getByTestId("sheet-preview") as HTMLTextAreaElement;
    const jaChar = /[぀-ゟ゠-ヿ一-鿿]/;
    expect(jaChar.test(preview.value)).toBe(false);
    // disclaimer は英語で出る。
    expect(preview.value).toContain("Educational output");
  });
});

describe("RC2: reload restores progress (BUG 4.5)", () => {
  it("in-progress を保存した storage から起動すると scenario を復元する", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    // 1 回目: 2 択進めて中断（storage に保存される）。
    const { unmount } = render(<App application={makeApp(["en"], storage)} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    await user.click(screen.getByTestId("begin"));
    await user.click(screen.getByTestId("option-o-ac-clarify"));
    await user.click(screen.getByTestId("proceed"));
    unmount();
    cleanup();
    // 2 回目: 同じ storage で再起動 → 復元通知 + scenario 続行可能。
    render(<App application={makeApp(["en"], storage)} initialSurface="gym" />);
    expect(screen.getByTestId("recovered-banner")).toBeInTheDocument();
    // Home に continue-card が出る。
    expect(screen.getByTestId("continue-card")).toBeInTheDocument();
  });

  it("破損 storage は blank にならず controlled fallback（Home 表示）", () => {
    const storage = memoryStorage({ "aidlc-learning-simulator/progress/v1": "{not json" });
    render(<App application={makeApp(["en"], storage)} initialSurface="gym" />);
    expect(screen.getByTestId("start")).toBeInTheDocument();
    expect(screen.getByTestId("recovered-banner")).toBeInTheDocument();
  });
});

describe("RC2: navigation (AppShell / back / retry)", () => {
  it("どの画面からも Home へ戻れる", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    // mode-select から nav-home。
    await user.click(screen.getByTestId("nav-home"));
    expect(screen.getByTestId("start")).toBeInTheDocument();
  });

  it("feedback から Back で選び直せる（決定的 rollback）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    await user.click(screen.getByTestId("begin"));
    await user.click(screen.getByTestId("option-o-ac-clarify"));
    expect(screen.getByTestId("feedback-card")).toBeInTheDocument();
    await user.click(screen.getByTestId("decision-back"));
    // 同じ DP の option が再び出る。
    expect(screen.getByTestId("option-o-ac-clarify")).toBeInTheDocument();
  });

  it("Result から Retry で最初からやり直せる", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await completeCore(user);
    await user.click(screen.getByTestId("result-retry"));
    expect(screen.getByTestId("option-o-ac-clarify")).toBeInTheDocument();
  });
});

describe("RC2: Lifecycle Stepper", () => {
  it("scenario 画面に stage stepper と progress を表示する", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    await user.click(screen.getByTestId("begin"));
    expect(screen.getByTestId("step-st-req")).toBeInTheDocument();
    expect(screen.getByTestId("step-st-release")).toBeInTheDocument();
    expect(screen.getByTestId("stepper-progress")).toBeInTheDocument();
  });
});

describe("RC2: Result Dashboard", () => {
  it("完走後に summary / 9 Dimension / timeline を表示する", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await completeCore(user);
    expect(screen.getByTestId("result-summary")).toBeInTheDocument();
    const dims = within(screen.getByTestId("dimensions")).getAllByRole("listitem");
    expect(dims).toHaveLength(9);
    expect(screen.getByTestId("timeline")).toBeInTheDocument();
  });

  it("弱い選択だと review dimensions と next-focus 推薦が出る", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    await user.click(screen.getByTestId("begin"));
    // evidence を偽装する悪い選択で evidence-quality を negative に。
    const badPath = ["o-ac-clarify", "o-del-agent-lowrisk", "o-test-tweak-expected", "o-rel-separate"];
    for (const opt of badPath) {
      await user.click(screen.getByTestId(`option-${opt}`));
      await user.click(screen.getByTestId("proceed"));
    }
    expect(screen.getByTestId("review-dimensions")).toBeInTheDocument();
    // evidence-quality の弱さ → focus-evidence 推薦。
    expect(screen.getByTestId("next-focus-focus-evidence")).toBeInTheDocument();
  });
});

describe("RC2: Reflection is not empty", () => {
  it("完走後の Reflection は判断一覧と問いを含む", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await completeCore(user);
    await user.click(screen.getByTestId("to-reflection"));
    expect(screen.getByTestId("reflection-decisions")).toBeInTheDocument();
    expect(screen.getByTestId("reflection-note")).toBeInTheDocument();
    expect(screen.getByTestId("to-adoption")).toBeInTheDocument();
  });
});

describe("RC2: mode differentiation", () => {
  it("Guided は判断前に概念（provenance）を先出しする", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    await user.click(screen.getByTestId("begin"));
    expect(screen.getByTestId("concept-preview")).toBeInTheDocument();
  });

  it("Simulation は判断前の概念先出しをしない", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-simulation"));
    await user.click(screen.getByTestId("begin"));
    expect(screen.queryByTestId("concept-preview")).not.toBeInTheDocument();
  });

  it("Reflection の問いが mode で変わる（Adoption は実チームの問い）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["en"])} initialSurface="gym" />);
    await completeCore(user, "mode-adoption-review");
    await user.click(screen.getByTestId("to-reflection"));
    expect(screen.getByText(/your own team/i)).toBeInTheDocument();
  });
});
