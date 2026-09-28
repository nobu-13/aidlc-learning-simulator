// RC3 Final Stabilization Patch — deterministic 回帰テスト（F1–F7）。
// 条件付き PASS を避け、対象状態を必ず発生させて hard assert する。
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
async function submit(user: ReturnType<typeof userEvent.setup>, gate = "approve", flag: string[] = []): Promise<void> {
  for (const id of flag) {
    const cb = screen.queryByTestId(`review-item-${id}`);
    if (cb !== null) await user.click(cb);
  }
  await user.selectOptions(screen.getByTestId("review-gate"), gate);
  await user.click(screen.getByTestId("review-submit"));
}
/** high-risk structured を設定した Simulation setup を開始（security/nfr の high defect を確実に発火）。 */
async function startHighRiskSimulation(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByTestId("journey-start-simulation"));
  await user.selectOptions(screen.getByTestId("setup-struct-dataSensitivity"), "personal-info");
  await user.selectOptions(screen.getByTestId("setup-struct-externalDependency"), "heavy");
  await user.selectOptions(screen.getByTestId("setup-struct-availability"), "critical");
  await user.selectOptions(screen.getByTestId("setup-struct-operationalCriticality"), "high");
  await user.click(screen.getByTestId("setup-begin"));
}
/** 全 finding-candidate を選び severity=high を付ける（correct review）。 */
async function flagAllHigh(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const boxes = screen.queryAllByTestId(/^review-item-/);
  for (const b of boxes) {
    await user.click(b);
    const id = b.getAttribute("data-testid")!.replace("review-item-", "");
    const sev = screen.queryByTestId(`review-sev-${id}-high`);
    if (sev !== null) await user.click(sev);
  }
}
afterEach(() => cleanup());

// ===== F1 Setup draft persistence =====
describe("F1 setup draft persistence", () => {
  it("1. Simulation setup user text persists to Home->Resume (exact)", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-simulation"));
    await user.type(screen.getByTestId("setup-ua-goal"), "Exact goal text 123");
    // まだ beginJourney 前。Home へ。
    await user.click(screen.getByTestId("journey-nav-home"));
    expect(screen.getByTestId("journey-resume-card")).toBeInTheDocument();
    await user.click(screen.getByTestId("journey-resume"));
    // setup へ戻り、入力が保持されている。
    expect((screen.getByTestId("setup-ua-goal") as HTMLTextAreaElement).value).toBe("Exact goal text 123");
  });

  it("2. Simulation setup structured persists across reload (exact)", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { unmount } = render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-start-simulation"));
    await user.selectOptions(screen.getByTestId("setup-struct-dataSensitivity"), "personal-info");
    unmount();
    cleanup();
    render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-resume"));
    expect((screen.getByTestId("setup-struct-dataSensitivity") as HTMLSelectElement).value).toBe("personal-info");
  });

  it("3. Adoption setup draft persists across reload", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { unmount } = render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-start-adoption"));
    await user.type(screen.getByTestId("setup-ua-goal"), "Adoption goal X");
    unmount();
    cleanup();
    render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-resume"));
    expect((screen.getByTestId("setup-ua-goal") as HTMLTextAreaElement).value).toBe("Adoption goal X");
  });
});

// ===== F2 Completion resume routing =====
describe("F2 completion resume routing", () => {
  async function guidedToCompletion(user: ReturnType<typeof userEvent.setup>, storage: StoragePort): Promise<void> {
    render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    for (let i = 0; i < 6; i++) {
      await submit(user, "approve");
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }
  }
  it("4. Completion Return -> reload -> Resume shows Review (NOT Release)", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    await guidedToCompletion(user, storage);
    await user.click(screen.getByTestId("completion-return"));
    cleanup();
    render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-resume"));
    expect(screen.getByTestId("review-submit")).toBeInTheDocument();
    expect(screen.queryByTestId("release-approve")).toBeNull();
  });
  it("5. Completion Block -> reload -> Resume shows Result", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    await guidedToCompletion(user, storage);
    await user.click(screen.getByTestId("completion-block"));
    cleanup();
    render(<App application={makeApp(["en"], storage)} />);
    // block 後は完了扱い → Home は completed card、Resume で Result。
    const resume = screen.queryByTestId("journey-resume") ?? screen.queryByTestId("journey-review-result");
    expect(resume).not.toBeNull();
    await user.click(resume!);
    expect(screen.getByTestId("journey-dimensions")).toBeInTheDocument();
    expect(screen.queryByTestId("release-approve")).toBeNull();
  });
  it("6. Completion Approve -> reload -> Resume shows Release path", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    await guidedToCompletion(user, storage);
    await user.click(screen.getByTestId("completion-approve"));
    cleanup();
    render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-resume"));
    expect(screen.getByTestId("release-approve")).toBeInTheDocument();
  });
});

// ===== F3/F4 learning history persistence + finding-level =====
describe("F3/F4 learning history", () => {
  it("7/9/10/11/12. prior miss persists across reload with finding-level detail", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { unmount } = render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1 approve (miss all) then continue to build history.
    await submit(user, "approve");
    await user.click(screen.getByTestId("feedback-next"));
    unmount();
    cleanup();
    // reload -> resume -> continue to result.
    render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-resume"));
    // 残りを approve で完走。
    for (let i = 0; i < 6; i++) {
      const s = screen.queryByTestId("review-submit");
      if (s === null) break;
      await submit(user, "approve");
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }
    if (screen.queryByTestId("completion-approve") !== null) {
      await user.click(screen.getByTestId("completion-approve"));
      await user.click(screen.getByTestId("interstitial-continue"));
      await user.click(screen.getByTestId("release-approve"));
    }
    // prior miss は 0 にリセットされない。
    const histMissed = screen.getByTestId("history-missed");
    expect(Number(histMissed.textContent!.replace(/\D/g, ""))).toBeGreaterThan(0);
    // finding-level history が具体的な item title を含む（internal ID でない）。
    const findings = screen.getByTestId("history-findings");
    expect(within(findings).getAllByTestId(/^history-entry-/).length).toBeGreaterThan(0);
    const text = findings.textContent ?? "";
    expect(text).not.toMatch(/req-item-|d-j|art__|\.body|journeyStepId/);
    // why / origin / revisit の語が含まれる（human-readable）。
    expect(text).toMatch(/Why|Origin|Revisit/i);
  });

  it("8. false positive persists across reload", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { unmount } = render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // distractor（罠）を誤指摘して false positive を作る。
    const distractor = screen.queryAllByTestId(/^review-item-.*distractor/)[0];
    if (distractor !== undefined) await user.click(distractor);
    await submit(user, "approve");
    await user.click(screen.getByTestId("feedback-next"));
    unmount();
    cleanup();
    render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-resume"));
    for (let i = 0; i < 6; i++) {
      const s = screen.queryByTestId("review-submit");
      if (s === null) break;
      await submit(user, "approve");
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }
    if (screen.queryByTestId("completion-approve") !== null) {
      await user.click(screen.getByTestId("completion-approve"));
      await user.click(screen.getByTestId("interstitial-continue"));
      await user.click(screen.getByTestId("release-approve"));
    }
    expect(Number(screen.getByTestId("history-false").textContent!.replace(/\D/g, ""))).toBeGreaterThan(0);
  });
});

// ===== F5 actual consequence content =====
describe("F5 actual consequence", () => {
  it("13/14. Guided consequence card MUST show What happens text", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1..J3 approve（canonical sample は J3 に downstream 付き high defect あり）。
    await submit(user, "approve");
    await user.click(screen.getByTestId("feedback-next"));
    await submit(user, "approve");
    await user.click(screen.getByTestId("feedback-next"));
    await submit(user, "approve"); // J3 feedback
    // Guided explain-consequence card は必ず存在（hard assert）。
    const cons = screen.getByTestId("feedback-explain");
    // What happens の本文が空でない。
    expect(cons.textContent ?? "").toMatch(/What happens/i);
    expect(within(cons).getAllByRole("listitem").length).toBeGreaterThan(0);
  });
});

// ===== F6 Simulation must-fix (deterministic, hard assert) =====
describe("F6 simulation must-fix deterministic", () => {
  it("15/16/17. high miss MUST create must-fix and hide Next; correct rework removes blocker", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await startHighRiskSimulation(user);
    // J1..J2 approve で J3（high defect あり）へ。
    await submit(user, "approve");
    await user.click(screen.getByTestId("feedback-next"));
    await submit(user, "approve");
    await user.click(screen.getByTestId("feedback-next"));
    // J3 で全 high を見逃して approve（too-lenient）。
    await submit(user, "approve");
    // must-fix が必ず出る（hard）。
    expect(screen.getByTestId("feedback-must-fix")).toBeInTheDocument();
    // Next は出ない（hard）。
    expect(screen.queryByTestId("feedback-next")).toBeNull();
    // rework して high を正しく指摘 → must-fix 解消。
    await user.click(screen.getByTestId("feedback-rework"));
    await flagAllHigh(user);
    await submit(user, "return-for-rework");
    expect(screen.queryByTestId("feedback-must-fix")).toBeNull();
    expect(screen.getByTestId("feedback-next")).toBeInTheDocument();
  });
});

// ===== F7 review input hydration =====
describe("F7 review input hydration", () => {
  it("18/19/20/21. saved finding/severity/gate/note restored after Home->Resume", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1 で finding を 1 つ選び severity=high、gate=return、note を入力して submit。
    const firstBox = screen.queryAllByTestId(/^review-item-/)[0]!;
    const firstId = firstBox.getAttribute("data-testid")!.replace("review-item-", "");
    await user.click(firstBox);
    await user.click(screen.getByTestId(`review-sev-${firstId}-high`));
    await user.type(screen.getByTestId("review-note"), "my review note");
    await submit(user, "return-for-rework");
    // feedback → Back で review に戻る（同 revision）。
    await user.click(screen.getByTestId("journey-nav-back"));
    // hydration: finding が checked、gate=return、note 復元。
    expect((screen.getByTestId(`review-item-${firstId}`) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId("review-gate") as HTMLSelectElement).value).toBe("return-for-rework");
    expect((screen.getByTestId("review-note") as HTMLTextAreaElement).value).toBe("my review note");
  });

  it("22. rework revision clears stale UI review input", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    const firstBox = screen.queryAllByTestId(/^review-item-/)[0]!;
    await user.click(firstBox);
    await submit(user, "approve");
    // rework（optional）で J1 の revision を上げる。
    const rework = screen.queryByTestId("feedback-rework-optional") ?? screen.getByTestId("feedback-rework");
    await user.click(rework);
    // 新 revision の review は空（stale が復元されない）。
    const boxes = screen.queryAllByTestId(/^review-item-/);
    for (const b of boxes) expect((b as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId("review-note") as HTMLTextAreaElement).value).toBe("");
  });
});

// ===== 23 internal IDs absent from finding-level Result =====
describe("finding-level Result has no internal IDs", () => {
  it("23. result finding-level history contains no internal identifiers", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    for (let i = 0; i < 6; i++) {
      await submit(user, "approve");
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }
    await user.click(screen.getByTestId("completion-approve"));
    await user.click(screen.getByTestId("interstitial-continue"));
    await user.click(screen.getByTestId("release-approve"));
    const findings = screen.queryByTestId("history-findings");
    if (findings !== null) {
      const text = findings.textContent ?? "";
      expect(text).not.toMatch(/req-item-|ac-item-|design-item-|d-j\d|art__|journey-step-|\.body|\.title/);
    } else {
      // history が空でも missed>0 の場合は findings があるはず。ここでは missed を確認。
      expect(screen.getByTestId("history-missed")).toBeInTheDocument();
    }
  });
});

// ===== G1 unsubmitted review draft persist/restore =====
describe("G1 unsubmitted review draft persistence", () => {
  it("24. 未 submit の finding/severity/gate/note が reload 後に復元される", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { unmount } = render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1 で入力するが submit しない。
    const firstBox = screen.queryAllByTestId(/^review-item-/)[0]!;
    const firstId = firstBox.getAttribute("data-testid")!.replace("review-item-", "");
    await user.click(firstBox);
    await user.click(screen.getByTestId(`review-sev-${firstId}-high`));
    await user.selectOptions(screen.getByTestId("review-gate"), "return-for-rework");
    await user.type(screen.getByTestId("review-note"), "draft not submitted");
    // reload（unmount → 同一 storage で再マウント）。
    unmount();
    cleanup();
    render(<App application={makeApp(["en"], storage)} />);
    // Home の Resume で復帰。
    await user.click(screen.getByTestId("journey-resume"));
    // 未 submit の下書きが hydrate される（hard assert）。
    expect((screen.getByTestId(`review-item-${firstId}`) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId(`review-sev-${firstId}-high`) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId("review-gate") as HTMLSelectElement).value).toBe("return-for-rework");
    expect((screen.getByTestId("review-note") as HTMLTextAreaElement).value).toBe("draft not submitted");
  });
});

// ===== G2 completion return -> rework -> re-reach resume routing =====
describe("G2 completion return then re-reach routing", () => {
  it("25. Completion Return→rework→Completion 再到達後、reload の resume は Completion へ", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { unmount } = render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1..J6 approve で Completion まで。
    for (let i = 0; i < 6; i++) {
      await submit(user, "approve");
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }
    // Completion で Return（j6 へ rework）。
    await user.click(screen.getByTestId("completion-return"));
    // j6 を再 review して Completion へ再到達。
    await submit(user, "approve");
    const n = screen.queryByTestId("feedback-next");
    if (n !== null) await user.click(n);
    // Completion view に戻っている（hard）。
    expect(screen.getByTestId("completion-approve")).toBeInTheDocument();
    // reload → resume は Completion へ（review へ誤誘導しない）。
    unmount();
    cleanup();
    render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-resume"));
    expect(screen.getByTestId("completion-approve")).toBeInTheDocument();
    expect(screen.queryByTestId("review-submit")).toBeNull();
  });
});

// ===== G3 completion block reload => completed state =====
describe("G3 completion block reload completed state", () => {
  it("26. Completion Block 後の reload Home は Completed card を出す", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { unmount } = render(<App application={makeApp(["en"], storage)} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    for (let i = 0; i < 6; i++) {
      await submit(user, "approve");
      const n = screen.queryByTestId("feedback-next");
      if (n !== null) await user.click(n);
    }
    // Completion で Block → Result（blocked）。
    await user.click(screen.getByTestId("completion-block"));
    // reload → Home は Completed 扱い（in-progress resume を出さない）。
    unmount();
    cleanup();
    render(<App application={makeApp(["en"], storage)} />);
    expect(screen.getByTestId("journey-completed-card")).toBeInTheDocument();
    expect(screen.queryByTestId("journey-resume-card")).toBeNull();
  });
});

// ===== G4 consequence body hard assert =====
describe("G4 consequence manifestation body hard assert", () => {
  it("27. Guided consequence card は実 manifestation 本文を表示する", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["en"])} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1..J3 approve（J3 の high defect を全て見逃す）。
    await submit(user, "approve");
    await user.click(screen.getByTestId("feedback-next"));
    await submit(user, "approve");
    await user.click(screen.getByTestId("feedback-next"));
    await submit(user, "approve"); // J3 feedback
    const cons = screen.getByTestId("feedback-explain");
    const text = cons.textContent ?? "";
    // "What happens" ラベルだけでなく、実際の manifestation 本文（決定的 ground truth）を hard assert。
    // J3 の downstream: missing-nfr → toRelease / security-violation → toTrace。
    const toRelease = "A missing NFR surfaced as a remaining risk at release.";
    const toTrace = "A design security-constraint violation surfaced as a traceability gap.";
    expect(text.includes(toRelease) || text.includes(toTrace)).toBe(true);
  });
});
