import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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

describe("RC2 Practice: library + navigation", () => {
  it("Home から practice library へ行き、5 practice を表示する", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("practices"));
    expect(screen.getByTestId("practice-req-create")).toBeInTheDocument();
    expect(screen.getByTestId("practice-evidence-review")).toBeInTheDocument();
    expect(screen.getByTestId("practice-approval-delegation")).toBeInTheDocument();
    expect(screen.getByTestId("practice-traceability")).toBeInTheDocument();
    expect(screen.getByTestId("practice-change-control")).toBeInTheDocument();
  });

  it("practice library の axe 違反ゼロ", async () => {
    const user = userEvent.setup();
    const { container } = render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("practices"));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("RC2 Practice: Requirement Create", () => {
  it("必須項目を埋めて採点すると allSatisfied と AC 件数を表示", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("practices"));
    await user.click(screen.getByTestId("practice-req-create"));
    await user.type(screen.getByTestId("req-goal"), "Login feature");
    await user.type(screen.getByTestId("req-targetUser"), "End users");
    await user.type(screen.getByTestId("req-inScope"), "Email login");
    await user.type(screen.getByTestId("req-outOfScope"), "SSO");
    await user.type(screen.getByTestId("req-acceptanceCriteria"), "Succeeds with valid creds\nFails with invalid");
    await user.click(screen.getByTestId("practice-evaluate"));
    expect(screen.getByTestId("req-ac-count").textContent).toContain("2");
    expect(screen.getByTestId("req-all-satisfied").textContent).toContain("✔");
  });

  it("空のまま採点すると missing を表示（deterministic）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("practices"));
    await user.click(screen.getByTestId("practice-req-create"));
    await user.click(screen.getByTestId("practice-evaluate"));
    expect(screen.getByTestId("req-missing")).toBeInTheDocument();
    // semantic 非評価の明示。
    expect(screen.getByTestId("not-evaluated")).toBeInTheDocument();
  });
});

describe("RC2 Practice: Evidence Review", () => {
  it("正しく分類すると correct、誤ると incorrect を表示", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("practices"));
    await user.click(screen.getByTestId("practice-evidence-review"));
    // 期待値書き換えは insufficient が正解。
    await user.click(screen.getByTestId("ev-ev-tweaked-expected-insufficient"));
    // 実行ログは sufficient が正解 → わざと誤答（missing-required）。
    await user.click(screen.getByTestId("ev-ev-exec-log-missing-required"));
    await user.click(screen.getByTestId("practice-evaluate"));
    expect(screen.getByTestId("ev-verdict-ev-tweaked-expected").textContent).toContain("✔");
    expect(screen.getByTestId("ev-verdict-ev-exec-log").textContent).toContain("▲");
  });
});

describe("RC2 Practice: Approval/Delegation classification", () => {
  it("本番シークレット読み取りを block に分類すると correct", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("practices"));
    await user.click(screen.getByTestId("practice-approval-delegation"));
    await user.click(screen.getByTestId("cls-act-prod-secret-block"));
    await user.click(screen.getByTestId("practice-evaluate"));
    expect(screen.getByTestId("cls-verdict-act-prod-secret").textContent).toContain("✔");
  });
});

describe("RC2 Practice: Traceability", () => {
  it("テスト欠落の鎖を incomplete と判定すると correct", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("practices"));
    await user.click(screen.getByTestId("practice-traceability"));
    await user.click(screen.getByTestId("tr-chain-reset-incomplete"));
    await user.click(screen.getByTestId("practice-evaluate"));
    expect(screen.getByTestId("tr-verdict-chain-reset").textContent).toContain("✔");
  });
});

describe("RC2 Practice: Change Control", () => {
  it("承認後の要件変更に re-evaluate を選ぶと correct", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} initialSurface="gym" />);
    await user.click(screen.getByTestId("practices"));
    await user.click(screen.getByTestId("practice-change-control"));
    await user.click(screen.getByTestId("cc-cc-approved-req-changed-re-evaluate"));
    await user.click(screen.getByTestId("practice-evaluate"));
    expect(screen.getByTestId("cc-verdict-cc-approved-req-changed").textContent).toContain("✔");
  });
});

describe("RC2 Adoption Workshop", () => {
  it("Workshop 入力が生成 Sheet に user-authored として反映される", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["en"])} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-adoption-review"));
    await user.click(screen.getByTestId("begin"));
    const path = ["o-ac-clarify", "o-del-agent-lowrisk", "o-test-investigate", "o-rel-separate"];
    for (const opt of path) {
      await user.click(screen.getByTestId(`option-${opt}`));
      await user.click(screen.getByTestId("proceed"));
    }
    await user.click(screen.getByTestId("to-reflection"));
    await user.click(screen.getByTestId("to-adoption"));
    // workshop の "project-context" セクションへ記入。
    await user.type(screen.getByTestId("ws-project-context"), "My team payment service");
    await user.click(screen.getByTestId("generate-sheet"));
    const preview = screen.getByTestId("sheet-preview") as HTMLTextAreaElement;
    expect(preview.value).toContain("My team payment service");
    expect(preview.value).toContain("Your input (user-authored)");
    // 見出しは固定順で残る。
    expect(preview.value).toContain("## Project Context");
    expect(preview.value).toContain("## Questions to Resolve Before Adoption");
  });
});
