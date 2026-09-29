// RC3.1 Stable Close Patch — deterministic UI tests.
// UX-FT-001 / UX-RH-001 / UX-NAV-001 / UX-MOB-001 を hard assert する。
// Ground Truth / TP-FP-FN-TN semantics は検証しない（表示正規化のみ対象）。
import { opaqueItemToken } from "../domain/semantic-id.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
async function submitGate(user: ReturnType<typeof userEvent.setup>, gate = "approve", flag: string[] = []): Promise<void> {
  for (const id of flag) {
    const cb = screen.queryByTestId(`review-item-${opaqueItemToken(id)}`);
    if (cb !== null) await user.click(cb);
  }
  await user.selectOptions(screen.getByTestId("review-gate"), gate);
  await user.click(screen.getByTestId("review-submit"));
}
/** Guided を全 approve で Result まで通す（miss を最大化して learning history を作る）。 */
async function guidedToResult(
  user: ReturnType<typeof userEvent.setup>,
  opts: { flagJ1?: string[] } = {},
): Promise<void> {
  await user.click(screen.getByTestId("journey-start-guided"));
  for (let i = 0; i < 6; i++) {
    await submitGate(user, "approve", i === 0 ? (opts.flagJ1 ?? []) : []);
    const n = screen.queryByTestId("feedback-next");
    if (n !== null) await user.click(n);
  }
  await user.click(screen.getByTestId("completion-approve"));
  await user.click(screen.getByTestId("interstitial-continue"));
  await user.click(screen.getByTestId("release-approve"));
}
afterEach(() => cleanup());

// ===== FIX 1 — UX-FT-001 Feedback traceability =====
describe("UX-FT-001 feedback traceability", () => {
  it("1. miss with downstream step shows Affected later step (not N/A)", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1 approve（miss all）→ feedback。J1 の d-j1-req-omission は downstream(J4) を持つ。
    await submitGate(user, "approve");
    const missed = screen.getByTestId("feedback-missed");
    const affected = within(missed).getByTestId("feedback-missed-0-trace-affected");
    // 明示的 N/A ではなく実 step を表示。
    expect(affected.textContent ?? "").not.toContain("No downstream step");
    // consequence / why / origin / severity も必ず存在。
    expect(within(missed).getByTestId("feedback-missed-0-trace-consequence")).toBeInTheDocument();
    expect(within(missed).getByTestId("feedback-missed-0-trace-why")).toBeInTheDocument();
    expect(within(missed).getByTestId("feedback-missed-0-trace-origin")).toBeInTheDocument();
    expect(within(missed).getByTestId("feedback-missed-0-trace-severity")).toBeInTheDocument();
  });

  it("2. miss without downstream step shows explicit human-readable N/A (field not omitted)", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    // Simulation high-risk で J3 に unsafe-delegation（downstream 無し）を発火。
    await user.click(screen.getByTestId("journey-start-simulation"));
    await user.selectOptions(screen.getByTestId("setup-struct-dataSensitivity"), "personal-info");
    await user.selectOptions(screen.getByTestId("setup-struct-externalDependency"), "heavy");
    await user.selectOptions(screen.getByTestId("setup-struct-availability"), "critical");
    await user.selectOptions(screen.getByTestId("setup-struct-operationalCriticality"), "high");
    await user.click(screen.getByTestId("setup-begin"));
    // J1..J2 approve → J3。
    await submitGate(user, "approve");
    await user.click(screen.getByTestId("feedback-next"));
    await submitGate(user, "approve");
    await user.click(screen.getByTestId("feedback-next"));
    // J3 approve（全 miss）→ feedback。
    await submitGate(user, "approve");
    const missed = screen.getByTestId("feedback-missed");
    // downstream 無しの miss が最低 1 件、"No downstream step" の明示 N/A を表示する。
    const affectedCells = within(missed).queryAllByTestId(/feedback-missed-\d+-trace-affected/);
    const texts = affectedCells.map((c) => c.textContent ?? "");
    expect(texts.some((tx) => tx.includes("No downstream step"))).toBe(true);
    // どの affected cell も空ではない（field omission 禁止）。
    for (const tx of texts) expect(tx.trim().length).toBeGreaterThan(0);
  });

  it("3. false positive feedback shows required traceability, no undefined/null/internal id", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1 で distractor（finding-candidate・非 defect）を誤指摘 → false positive。
    await submitGate(user, "approve", ["req-item-distractor"]);
    const falseCard = screen.getByTestId("feedback-false");
    const trace = within(falseCard).getByTestId("feedback-false-0-trace");
    const text = trace.textContent ?? "";
    // required 構造がすべて存在。
    expect(within(falseCard).getByTestId("feedback-false-0-trace-severity")).toBeInTheDocument();
    expect(within(falseCard).getByTestId("feedback-false-0-trace-why")).toBeInTheDocument();
    expect(within(falseCard).getByTestId("feedback-false-0-trace-origin")).toBeInTheDocument();
    expect(within(falseCard).getByTestId("feedback-false-0-trace-affected")).toBeInTheDocument();
    expect(within(falseCard).getByTestId("feedback-false-0-trace-consequence")).toBeInTheDocument();
    // false positive 用の説明文（なぜ FP か / downstream 該当なし）。
    expect(text).toContain("false positive");
    expect(text).toContain("unnecessary flag");
    // undefined / null / internal id が出ない。
    expect(text).not.toMatch(/undefined|null|req-item-|d-j\d|art__|\.body|\.title/);
  });
});

// ===== FIX 2 — UX-RH-001 Learning History normalization =====
describe("UX-RH-001 learning history normalization", () => {
  it("4. history miss with consequence shows full schema", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await guidedToResult(user);
    const findings = screen.getByTestId("history-findings");
    // entry-0 の全 field が存在。
    expect(within(findings).getByTestId("history-entry-0-severity")).toBeInTheDocument();
    expect(within(findings).getByTestId("history-entry-0-why")).toBeInTheDocument();
    expect(within(findings).getByTestId("history-entry-0-origin")).toBeInTheDocument();
    expect(within(findings).getByTestId("history-entry-0-consequence")).toBeInTheDocument();
    expect(within(findings).getByTestId("history-entry-0-revisit")).toBeInTheDocument();
  });

  it("5. every history entry renders all schema fields (missing => explicit N/A, never omitted)", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await guidedToResult(user);
    const findings = screen.getByTestId("history-findings");
    const entries = within(findings).queryAllByTestId(/^history-entry-\d+$/);
    expect(entries.length).toBeGreaterThan(0);
    for (let i = 0; i < entries.length; i++) {
      for (const field of ["severity", "why", "origin", "consequence", "revisit"]) {
        const cell = within(findings).getByTestId(`history-entry-${i}-${field}`);
        expect((cell.textContent ?? "").trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("6. history false positive shows Item/MistakeType/Severity/Why/Origin/Consequence/Revisit", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    // J1 で distractor を誤指摘 → false positive を learning history に残す。
    await guidedToResult(user, { flagJ1: ["req-item-distractor"] });
    const findings = screen.getByTestId("history-findings");
    // false-positive entry を探す（Mistake type ラベル "False flag" を含む entry）。
    const entries = within(findings).queryAllByTestId(/^history-entry-\d+$/);
    const fpIndex = entries.findIndex((e) => (e.textContent ?? "").includes("False flag"));
    expect(fpIndex).toBeGreaterThanOrEqual(0);
    // その entry に全 field。
    for (const field of ["severity", "why", "origin", "consequence", "revisit"]) {
      const cell = within(findings).getByTestId(`history-entry-${fpIndex}-${field}`);
      expect((cell.textContent ?? "").trim().length).toBeGreaterThan(0);
    }
    // false-positive の consequence は明示 N/A。
    const cons = within(findings).getByTestId(`history-entry-${fpIndex}-consequence`);
    expect(cons.textContent ?? "").toContain("unnecessary flag");
    // internal id は出ない。
    expect(findings.textContent ?? "").not.toMatch(/req-item-|d-j\d|art__|undefined|null/);
  });
});

// ===== FIX 3 — UX-NAV-001 Duplicate Home =====
describe("UX-NAV-001 exactly one Home per major screen", () => {
  const homeCount = (): number => screen.queryAllByTestId(/^journey-nav-home$/).length;
  const backHomeCount = (): number => screen.queryAllByTestId("journey-nav-back-home").length;

  it("7. Setup: exactly one Home", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-simulation"));
    expect(homeCount()).toBe(1);
    expect(backHomeCount()).toBe(0);
  });

  it("8. Artifact Review: exactly one Home", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    expect(homeCount()).toBe(1);
    expect(backHomeCount()).toBe(0);
  });

  it("9. Completion: exactly one Home", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    for (let i = 0; i < 6; i++) {
      await submitGate(user, "approve");
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }
    expect(screen.getByTestId("completion-approve")).toBeInTheDocument();
    expect(homeCount()).toBe(1);
    expect(backHomeCount()).toBe(0);
  });

  it("10. Release: exactly one Home", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    for (let i = 0; i < 6; i++) {
      await submitGate(user, "approve");
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }
    await user.click(screen.getByTestId("completion-approve"));
    await user.click(screen.getByTestId("interstitial-continue"));
    expect(screen.getByTestId("release-approve")).toBeInTheDocument();
    expect(homeCount()).toBe(1);
    expect(backHomeCount()).toBe(0);
  });

  it("11. Result: exactly one Home", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await guidedToResult(user);
    expect(screen.getByTestId("result-causal")).toBeInTheDocument();
    expect(homeCount()).toBe(1);
    expect(backHomeCount()).toBe(0);
  });
});

// ===== FIX 4 — UX-MOB-001 Language tap target =====
describe("UX-MOB-001 language control tap target", () => {
  it("12. .lang-switcher select has min-height >= 44px in CSS", () => {
    const css = readFileSync(resolve(process.cwd(), "src/ui/styles.css"), "utf8");
    // .lang-switcher select ブロックの min-height を抽出。
    const block = css.match(/\.lang-switcher select\s*\{([^}]*)\}/);
    expect(block).not.toBeNull();
    const body = block?.[1] ?? "";
    const mh = body.match(/min-height:\s*(\d+)px/)?.[1];
    expect(mh).toBeDefined();
    expect(Number(mh)).toBeGreaterThanOrEqual(44);
  });
});

// ===== Regression guards =====
describe("RC3.1 regression guards", () => {
  it("13. Home -> Resume still works (navigation regression)", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    await user.click(screen.getByTestId("journey-nav-home"));
    expect(screen.getByTestId("journey-resume-card")).toBeInTheDocument();
    await user.click(screen.getByTestId("journey-resume"));
    expect(screen.getByTestId("review-submit")).toBeInTheDocument();
  });

  it("14. Completion approve/return/block semantics unchanged", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    for (let i = 0; i < 6; i++) {
      await submitGate(user, "approve");
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }
    // 3 つの decision ボタンが揃う。
    expect(screen.getByTestId("completion-approve")).toBeInTheDocument();
    expect(screen.getByTestId("completion-return")).toBeInTheDocument();
    expect(screen.getByTestId("completion-block")).toBeInTheDocument();
    // Block → Result（blocked）。
    await user.click(screen.getByTestId("completion-block"));
    expect(screen.getByTestId("result-causal")).toBeInTheDocument();
    expect(screen.queryByTestId("release-approve")).toBeNull();
  });

  it("15. Simulation mandatory rework: critical miss hides Next", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-simulation"));
    await user.selectOptions(screen.getByTestId("setup-struct-dataSensitivity"), "personal-info");
    await user.selectOptions(screen.getByTestId("setup-struct-externalDependency"), "heavy");
    await user.selectOptions(screen.getByTestId("setup-struct-availability"), "critical");
    await user.selectOptions(screen.getByTestId("setup-struct-operationalCriticality"), "high");
    await user.click(screen.getByTestId("setup-begin"));
    await submitGate(user, "approve");
    await user.click(screen.getByTestId("feedback-next"));
    await submitGate(user, "approve");
    await user.click(screen.getByTestId("feedback-next"));
    // J3 で high defect を全 miss して approve（too-lenient）。
    await submitGate(user, "approve");
    expect(screen.getByTestId("feedback-must-fix")).toBeInTheDocument();
    expect(screen.queryByTestId("feedback-next")).toBeNull();
  });
});
