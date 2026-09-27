import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
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

function makeApp(languages: string[] = ["en"]): Application {
  return createApplication({ scenarioModules, storage: memoryStorage(), browserLanguages: languages });
}

afterEach(() => cleanup());

describe("App UI flow", () => {
  it("Home が表示され、主要画面の axe 違反が critical/serious ゼロ", async () => {
    const { container } = render(<App application={makeApp()} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("keyboard/クリックで Home→mode 選択→intro→scenario へ進める", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    // intro
    expect(screen.getByTestId("begin")).toBeInTheDocument();
    await user.click(screen.getByTestId("begin"));
    // scenario: 最初の DecisionPoint の option が出る
    expect(screen.getByTestId("option-o-ac-clarify")).toBeInTheDocument();
  });

  it("完走すると Result が出て 9 Dimension と simulation-value 注記を表示する", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    await user.click(screen.getByTestId("begin"));

    // 4 Stage 各 1 DecisionPoint。良い選択で完走。
    const path = ["o-ac-clarify", "o-del-agent-lowrisk", "o-test-investigate", "o-rel-separate"];
    for (const opt of path) {
      await user.click(screen.getByTestId(`option-${opt}`));
      await user.click(screen.getByTestId("proceed"));
    }
    expect(screen.getByTestId("sim-value-note")).toBeInTheDocument();
    const dims = within(screen.getByTestId("dimensions")).getAllByRole("listitem");
    expect(dims).toHaveLength(9);
  });

  it("Tab で option ボタンにフォーカスでき Enter で起動できる（keyboard 操作・NFR4）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    await user.click(screen.getByTestId("begin"));
    const option = screen.getByTestId("option-o-ac-clarify");
    option.focus();
    expect(option).toHaveFocus();
    await user.keyboard("{Enter}");
    // feedback へ遷移し proceed が出る。
    expect(screen.getByTestId("proceed")).toBeInTheDocument();
  });

  it("判断メモを入力しても言語切替で失われず、UI 文言のみ変わる（FR10.3）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["en"])} />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    await user.click(screen.getByTestId("begin"));
    const note = screen.getByTestId("note");
    await user.type(note, "my reasoning");
    // 言語を ja に切替。
    await user.selectOptions(screen.getByTestId("lang-select"), "ja");
    // note の内容は保持される（同一 textarea・presentation state）。
    expect(screen.getByTestId("note")).toHaveValue("my reasoning");
    // UI 文言は日本語へ（prompt 見出し）。
    expect(screen.getByRole("heading", { name: "判断してください" })).toBeInTheDocument();
  });

  it("provenance は色以外（ラベル＋記号＋テキスト）で区別表示される（BR4.2）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided")); // guided は important DP の provenance を先出し
    await user.click(screen.getByTestId("begin"));
    const badge = screen.getByTestId("provenance-ai-dlc-spec");
    // アイコン記号 + label テキストの両方が存在。
    expect(badge.textContent ?? "").toContain("◆");
    expect(badge.querySelector(".cat-label")?.textContent ?? "").not.toBe("");
  });
});

describe("AdoptionReview: Discussion Sheet 生成・download（R-04 / FR8.1）", () => {
  it("完走後に Adoption Review でシートを生成し、preview と download を提供する", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    await user.click(screen.getByTestId("begin"));
    const path = ["o-ac-clarify", "o-del-agent-lowrisk", "o-test-investigate", "o-rel-separate"];
    for (const opt of path) {
      await user.click(screen.getByTestId(`option-${opt}`));
      await user.click(screen.getByTestId("proceed"));
    }
    // result → reflection → adoption
    await user.click(screen.getByTestId("to-reflection"));
    await user.click(screen.getByTestId("to-adoption"));
    await user.click(screen.getByTestId("generate-sheet"));
    // preview に FR8.2 の見出し（Project Context 等）と Sheet タイトルが出る。
    const preview = screen.getByTestId("sheet-preview") as HTMLTextAreaElement;
    expect(preview.value).toContain("# AI-DLC Adoption Discussion Sheet");
    expect(preview.value).toContain("## Project Context");
    expect(preview.value).toContain("## Questions to Resolve Before Adoption");
    expect(screen.getByTestId("download-sheet")).toBeInTheDocument();
  });
});

describe("ErrorBoundary (R-01: 予期しない render エラーの受け皿)", () => {
  it("子が throw すると fallback を表示し、エラーメッセージを握り潰さない", async () => {
    const { ErrorBoundary } = await import("./error-boundary.tsx");
    const Boom = (): JSX.Element => {
      throw new Error("boom-unexpected");
    };
    const { container } = render(
      <ErrorBoundary title="Unexpected" body="reload please">
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("boundary-message").textContent ?? "").toContain("boom-unexpected");
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("ErrorView", () => {
  it("全 Scenario invalid のとき error 画面を出し、読めなかったものを列挙する（FR12/BR1.8）", async () => {
    // 壊れた scenario のみを渡す。
    const broken = { ref: "broken.json", raw: { schemaVersion: 1 }, localeBundles: { ja: {}, en: {} } };
    const app = createApplication({
      scenarioModules: [broken],
      storage: memoryStorage(),
      browserLanguages: ["en"],
    });
    const { container } = render(<App application={app} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("unavailable-list")).toBeInTheDocument();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
