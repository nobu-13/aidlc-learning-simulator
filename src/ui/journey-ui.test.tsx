// RC3 Journey UI 統合テスト — Guided / Simulation / Adoption の体験差、Completion != Release、
// rework、locale 不変、mid-journey 開示の有無 を UI レベルで検証する。
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
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

afterEach(() => cleanup());

/** Review view で gate を選び submit する（finding は itemIds 指定）。 */
async function reviewAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  opts: { flag?: string[]; gate?: string },
): Promise<void> {
  for (const id of opts.flag ?? []) {
    const cb = screen.queryByTestId(`review-item-${id}`);
    if (cb !== null) await user.click(cb);
  }
  if (opts.gate !== undefined) {
    await user.selectOptions(screen.getByTestId("review-gate"), opts.gate);
  }
  await user.click(screen.getByTestId("review-submit"));
}

describe("RC3 Journey — landing & modes", () => {
  it("default surface is the RC3 Journey home (not RC2 Home)", () => {
    render(<App application={makeApp()} />);
    expect(screen.getByTestId("journey-start-guided")).toBeInTheDocument();
    expect(screen.getByTestId("journey-start-simulation")).toBeInTheDocument();
    expect(screen.getByTestId("journey-start-adoption")).toBeInTheDocument();
  });

  it("journey home has no critical/serious axe violations", async () => {
    const { container } = render(<App application={makeApp()} />);
    const results = await axe(container);
    const serious = (results.violations ?? []).filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(serious).toEqual([]);
  });

  it("artifact review view has no critical/serious axe violations", async () => {
    const user = userEvent.setup();
    const { container } = render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    expect(screen.getByTestId("review-submit")).toBeInTheDocument();
    const results = await axe(container);
    const serious = (results.violations ?? []).filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(serious).toEqual([]);
  });

  it("Guided starts immediately on the canonical sample (no setup)", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // review view に入る（setup を経ない）。
    expect(screen.getByTestId("review-submit")).toBeInTheDocument();
    expect(screen.queryByTestId("setup-begin")).not.toBeInTheDocument();
  });

  it("Simulation goes through setup (user structured input)", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-simulation"));
    expect(screen.getByTestId("setup-begin")).toBeInTheDocument();
    expect(screen.getByTestId("setup-boundary-note")).toBeInTheDocument();
    await user.click(screen.getByTestId("setup-begin"));
    expect(screen.getByTestId("review-submit")).toBeInTheDocument();
  });
});

describe("RC3 Journey — Guided feedback (immediate disclosure)", () => {
  it("shows caught/missed feedback immediately after review", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1 で何も指摘せず approve → 見逃しが feedback に出る（immediate）。
    await reviewAndSubmit(user, { gate: "approve" });
    expect(screen.getByTestId("feedback-missed")).toBeInTheDocument();
    expect(screen.getByTestId("feedback-gate-quality")).toBeInTheDocument();
  });
});

describe("RC3 Journey — Adoption (no mid-journey disclosure)", () => {
  it("does not show feedback during the journey", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-adoption"));
    await user.click(screen.getByTestId("setup-begin"));
    // J1 review 提出 → feedback view を経ず次の review へ直行（final-only）。
    await reviewAndSubmit(user, { gate: "approve" });
    expect(screen.queryByTestId("feedback-missed")).not.toBeInTheDocument();
    // 次の Artifact review が出ている。
    expect(screen.getByTestId("review-submit")).toBeInTheDocument();
  });

  it("propagated consequence renders as informational (not a selectable finding)", async () => {
    const user = userEvent.setup();
    // Adoption で J1/J2/J3 をすべて approve（見逃し）→ J4 に consequence 情報が出る。
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-adoption"));
    await user.click(screen.getByTestId("setup-begin"));
    // structured default では J3 に defect が出る構成。J1..J3 を approve で通す。
    for (let i = 0; i < 3; i++) {
      await reviewAndSubmit(user, { gate: "approve" });
    }
    // J4 で informational 項目が出れば、それは checkbox（review-item-*）ではなく info として描画される。
    const infos = screen.queryAllByTestId(/^review-info-consequence-/);
    if (infos.length > 0) {
      // informational item は finding checkbox として存在しない。
      expect(screen.queryByTestId(`review-item-${infos[0]!.getAttribute("data-testid")!.replace("review-info-", "")}`)).toBeNull();
    }
    expect(screen.getByTestId("review-submit")).toBeInTheDocument();
  });
});

describe("RC3 Journey — Completion != Release", () => {
  it("interstitial appears between completion and release; both are separate decisions", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1..J6 を approve で通す（Guided は各回 feedback → next）。
    for (let i = 0; i < 6; i++) {
      await reviewAndSubmit(user, { gate: "approve" });
      const next = screen.queryByTestId("feedback-next");
      if (next !== null) await user.click(next);
    }
    // J7 Completion。
    expect(screen.getByTestId("completion-approve")).toBeInTheDocument();
    await user.click(screen.getByTestId("completion-approve"));
    // インタースティシャル（混同防止）。
    expect(screen.getByTestId("interstitial-body")).toBeInTheDocument();
    await user.click(screen.getByTestId("interstitial-continue"));
    // J8 Release は別 Decision。
    expect(screen.getByTestId("release-approve")).toBeInTheDocument();
    await user.click(screen.getByTestId("release-approve"));
    // 結果へ。
    expect(screen.getByTestId("journey-dimensions")).toBeInTheDocument();
  });
});

describe("RC3 Journey — deterministic result & locale invariance", () => {
  it("same journey path yields same dimension symbols in ja and en", async () => {
    const run = async (lang: string): Promise<string[]> => {
      cleanup();
      const user = userEvent.setup();
      render(<App application={makeApp([lang])} />);
      await user.click(screen.getByTestId("journey-start-guided"));
      for (let i = 0; i < 6; i++) {
        await reviewAndSubmit(user, { gate: "approve" });
        const next = screen.queryByTestId("feedback-next");
        if (next !== null) await user.click(next);
      }
      await user.click(screen.getByTestId("completion-approve"));
      await user.click(screen.getByTestId("interstitial-continue"));
      await user.click(screen.getByTestId("release-approve"));
      const dims = screen.getByTestId("journey-dimensions");
      return within(dims)
        .getAllByText(/^(\+\+|\+|-|--|0)$/)
        .map((el) => el.textContent ?? "");
    };
    const ja = await run("ja");
    const en = await run("en");
    expect(ja).toEqual(en);
  });
});
