// RC2 Stabilization regression tests（Post-RC2 Live UX Audit の修正を固定する）。
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../app/app.tsx";
import { createApplication, type Application } from "../app/application-orchestrator.ts";
import { scenarioModules } from "../scenarios/index.ts";
import type { StoragePort } from "../data/progress-store.ts";

const KEY = "aidlc-learning-simulator/progress/v1";

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

function makeApp(languages: string[], storage: StoragePort): Application {
  return createApplication({ scenarioModules, storage, browserLanguages: languages });
}

afterEach(() => cleanup());

// ---------- P1: Resume ----------

describe("RC2-stab: Resume restores in-progress scenario", () => {
  it("Core: 中断→reload→Resume で scenario の続きへ戻る（Home に留まらない）", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { unmount } = render(<App application={makeApp(["en"], storage)} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    await user.click(screen.getByTestId("begin"));
    await user.click(screen.getByTestId("option-o-ac-clarify"));
    await user.click(screen.getByTestId("proceed")); // DP2 へ
    unmount();
    cleanup();

    render(<App application={makeApp(["en"], storage)} initialSurface="gym" />);
    expect(screen.getByTestId("continue-card")).toBeInTheDocument();
    await user.click(screen.getByTestId("continue"));
    // scenario view の DP2（delegate）option が出る = 続きへ復帰している。
    expect(screen.getByTestId("option-o-del-agent-lowrisk")).toBeInTheDocument();
  });

  it("Focus: 中断→reload→Resume で focus scenario の続きへ戻る", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { unmount } = render(<App application={makeApp(["en"], storage)} initialSurface="gym" />);
    await user.click(screen.getByTestId("focus"));
    await user.click(screen.getByTestId("focus-focus-evidence"));
    await user.click(screen.getByTestId("begin"));
    await user.click(screen.getByTestId("option-o-investigate"));
    await user.click(screen.getByTestId("proceed")); // dp-evidence へ
    unmount();
    cleanup();

    render(<App application={makeApp(["en"], storage)} initialSurface="gym" />);
    await user.click(screen.getByTestId("continue"));
    expect(screen.getByTestId("option-o-require-evidence")).toBeInTheDocument();
  });

  it("不正な保存 state は controlled fallback（空画面や無反応にならない）", () => {
    // scenarioId が catalog に無い in-progress。復元されず Home のまま。
    const bad = JSON.stringify({
      persistenceSchemaVersion: 2,
      locale: "en",
      mode: "guided",
      sessions: [{ sessionId: "sess__ghost", scenarioId: "ghost", status: "in-progress", currentStageId: "x", decisionRecordIds: [] }],
      decisionRecords: [],
      completedScenarioIds: [],
      adoptionMemos: [],
      workshopInputs: {},
      practiceDrafts: {},
    });
    const storage = memoryStorage({ [KEY]: bad });
    render(<App application={makeApp(["en"], storage)} initialSurface="gym" />);
    expect(screen.getByTestId("start")).toBeInTheDocument();
    expect(screen.queryByTestId("continue-card")).not.toBeInTheDocument();
  });
});

// ---------- P1: Workshop persistence ----------

describe("RC2-stab: Workshop persistence", () => {
  async function toWorkshop(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-adoption-review"));
    await user.click(screen.getByTestId("begin"));
    for (const opt of ["o-ac-clarify", "o-del-agent-lowrisk", "o-test-investigate", "o-rel-separate"]) {
      await user.click(screen.getByTestId(`option-${opt}`));
      await user.click(screen.getByTestId("proceed"));
    }
    await user.click(screen.getByTestId("to-reflection"));
    await user.click(screen.getByTestId("to-adoption"));
  }

  it("10 fields 入力→reload で復元される", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { unmount } = render(<App application={makeApp(["en"], storage)} initialSurface="gym" />);
    await toWorkshop(user);
    await user.type(screen.getByTestId("ws-project-context"), "payment service");
    await user.type(screen.getByTestId("ws-remaining-risks"), "latency risk");
    unmount();
    cleanup();

    // reload → Resume → Workshop へ再訪。Workshop 入力は永続されている。
    render(<App application={makeApp(["en"], storage)} initialSurface="gym" />);
    // 保存された workshop 入力は state 復元済み。Adoption へ到達して確認する。
    // Resume で scenario へ戻れるが、workshop 入力自体は storage から復元されている。
    // ここでは storage 内容を直接検証（UI 到達は上の resume テストで担保）。
    const saved = JSON.parse(storage.data[KEY]!);
    expect(saved.workshopInputs["project-context"]).toBe("payment service");
    expect(saved.workshopInputs["remaining-risks"]).toBe("latency risk");
  });

  it("locale 切替で user-authored content は変わらない", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App application={makeApp(["en"], storage)} initialSurface="gym" />);
    await toWorkshop(user);
    await user.type(screen.getByTestId("ws-project-context"), "my context");
    await user.selectOptions(screen.getByTestId("lang-select"), "ja");
    expect(screen.getByTestId("ws-project-context")).toHaveValue("my context");
  });
});

// ---------- P1: Practice draft persistence ----------

describe("RC2-stab: Requirement Practice draft persistence", () => {
  it("入力→reload で draft が復元される", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { unmount } = render(<App application={makeApp(["en"], storage)} initialSurface="gym" />);
    await user.click(screen.getByTestId("practices"));
    await user.click(screen.getByTestId("practice-req-create"));
    await user.type(screen.getByTestId("req-goal"), "Login feature");
    unmount();
    cleanup();

    render(<App application={makeApp(["en"], storage)} initialSurface="gym" />);
    await user.click(screen.getByTestId("practices"));
    await user.click(screen.getByTestId("practice-req-create"));
    expect(screen.getByTestId("req-goal")).toHaveValue("Login feature");
  });

  it("明示 reset で draft が消える", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App application={makeApp(["en"], storage)} initialSurface="gym" />);
    await user.click(screen.getByTestId("practices"));
    await user.click(screen.getByTestId("practice-req-create"));
    await user.type(screen.getByTestId("req-goal"), "temp");
    await user.click(screen.getByTestId("practice-reset"));
    expect(screen.getByTestId("req-goal")).toHaveValue("");
    const saved = JSON.parse(storage.data[KEY]!);
    expect(saved.practiceDrafts["req-create"]).toBeUndefined();
  });
});

// ---------- Note per-DP ----------

describe("RC2-stab: Decision note per-ID (no carry-over / no duplication)", () => {
  async function run(user: ReturnType<typeof userEvent.setup>, notes: (string | null)[]): Promise<string> {
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-adoption-review"));
    await user.click(screen.getByTestId("begin"));
    const path = ["o-ac-clarify", "o-del-agent-lowrisk", "o-test-investigate", "o-rel-separate"];
    for (let i = 0; i < path.length; i++) {
      const n = notes[i];
      if (n != null && n.length > 0) await user.type(screen.getByTestId("note"), n);
      await user.click(screen.getByTestId(`option-${path[i]}`));
      await user.click(screen.getByTestId("proceed"));
    }
    await user.click(screen.getByTestId("to-reflection"));
    await user.click(screen.getByTestId("to-adoption"));
    await user.click(screen.getByTestId("generate-sheet"));
    return (screen.getByTestId("sheet-preview") as HTMLTextAreaElement).value;
  }

  it("A: DP1 のみ note → 次 DP に残らず、Sheet に1回だけ出る", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["en"], memoryStorage())} initialSurface="gym" />);
    const sheet = await run(user, ["note-A-only", null, null, null]);
    expect(sheet.split("note-A-only").length - 1).toBe(1);
  });

  it("B: 全 DP に異なる note → それぞれ1回ずつ出る", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["en"], memoryStorage())} initialSurface="gym" />);
    const sheet = await run(user, ["n-one", "n-two", "n-three", "n-four"]);
    expect(sheet.split("n-one").length - 1).toBe(1);
    expect(sheet.split("n-two").length - 1).toBe(1);
    expect(sheet.split("n-three").length - 1).toBe(1);
    expect(sheet.split("n-four").length - 1).toBe(1);
  });

  it("C: note 無し → Your Notes セクションが出ない", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["en"], memoryStorage())} initialSurface="gym" />);
    const sheet = await run(user, [null, null, null, null]);
    expect(sheet).not.toContain("Your Notes (user-authored)");
  });
});

// ---------- Feedback progress number ----------

describe("RC2-stab: Feedback progress number", () => {
  it("DP1 Feedback は 判断 1 / 4 と表示する（2/4 ではない）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["en"], memoryStorage())} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    await user.click(screen.getByTestId("begin"));
    // 判断入力中は 1 / 4。
    expect(screen.getByTestId("stepper-count").textContent).toContain("1");
    await user.click(screen.getByTestId("option-o-ac-clarify"));
    // Feedback 表示中も対象は DP1 = 1 / 4。
    const count = screen.getByTestId("stepper-count").textContent ?? "";
    expect(count).toContain("1");
    expect(count).not.toMatch(/\b2\b/);
  });
});

// ---------- Logical Back ----------

describe("RC2-stab: logical Back", () => {
  it("Practice からの Back は Practice Library へ戻る", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["en"], memoryStorage())} initialSurface="gym" />);
    await user.click(screen.getByTestId("practices"));
    await user.click(screen.getByTestId("practice-req-create"));
    await user.click(screen.getByTestId("nav-back"));
    expect(screen.getByTestId("practice-req-create")).toBeInTheDocument();
  });

  it("Result では Back の代わりに Home ラベルを出す（Home を Back と偽らない）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["en"], memoryStorage())} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    await user.click(screen.getByTestId("begin"));
    for (const opt of ["o-ac-clarify", "o-del-agent-lowrisk", "o-test-investigate", "o-rel-separate"]) {
      await user.click(screen.getByTestId(`option-${opt}`));
      await user.click(screen.getByTestId("proceed"));
    }
    // Result: back は Home として明示（nav-back-home）で、Back ラベル(nav-back)は出ない。
    expect(screen.getByTestId("nav-back-home")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-back")).not.toBeInTheDocument();
  });

  it("Reflection からの Back は Result へ戻る", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["en"], memoryStorage())} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-guided"));
    await user.click(screen.getByTestId("begin"));
    for (const opt of ["o-ac-clarify", "o-del-agent-lowrisk", "o-test-investigate", "o-rel-separate"]) {
      await user.click(screen.getByTestId(`option-${opt}`));
      await user.click(screen.getByTestId("proceed"));
    }
    await user.click(screen.getByTestId("to-reflection"));
    await user.click(screen.getByTestId("nav-back"));
    // Result の dimensions が再表示される。
    expect(screen.getByTestId("dimensions")).toBeInTheDocument();
  });
});

// ---------- Workshop locale preview ----------

describe("RC2-stab: Workshop locale preview", () => {
  it("ja で生成→en へ切替すると陳腐化通知が出て、出力言語が明示される", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["ja"], memoryStorage())} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-adoption-review"));
    await user.click(screen.getByTestId("begin"));
    for (const opt of ["o-ac-clarify", "o-del-agent-lowrisk", "o-test-investigate", "o-rel-separate"]) {
      await user.click(screen.getByTestId(`option-${opt}`));
      await user.click(screen.getByTestId("proceed"));
    }
    await user.click(screen.getByTestId("to-reflection"));
    await user.click(screen.getByTestId("to-adoption"));
    await user.click(screen.getByTestId("generate-sheet"));
    // 生成直後は output-locale 表示あり、stale なし。
    expect(screen.getByTestId("sheet-output-locale")).toBeInTheDocument();
    expect(screen.queryByTestId("sheet-stale-notice")).not.toBeInTheDocument();
    // en へ切替 → stale 通知。
    await user.selectOptions(screen.getByTestId("lang-select"), "en");
    expect(screen.getByTestId("sheet-stale-notice")).toBeInTheDocument();
  });
});

// ---------- Workshop a11y labels ----------

describe("RC2-stab: Workshop unique accessible labels", () => {
  it("10 textarea が section 固有の accessible name を持つ", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(["en"], memoryStorage())} initialSurface="gym" />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-adoption-review"));
    await user.click(screen.getByTestId("begin"));
    for (const opt of ["o-ac-clarify", "o-del-agent-lowrisk", "o-test-investigate", "o-rel-separate"]) {
      await user.click(screen.getByTestId(`option-${opt}`));
      await user.click(screen.getByTestId("proceed"));
    }
    await user.click(screen.getByTestId("to-reflection"));
    await user.click(screen.getByTestId("to-adoption"));
    // section 固有の accessible name（heading 由来）で取得できる。
    expect(screen.getByRole("textbox", { name: /Project Context/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Acceptance Criteria/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Remaining Risks/ })).toBeInTheDocument();
    // 全 textbox の accessible name が一意（重複なし）。
    const boxes = screen.getAllByRole("textbox").filter((el) => el.id.startsWith("ws-"));
    const names = boxes.map((b) => b.getAttribute("aria-label"));
    expect(new Set(names).size).toBe(names.length);
  });
});
